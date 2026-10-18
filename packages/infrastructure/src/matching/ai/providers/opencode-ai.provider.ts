import { Buffer } from "node:buffer";
import type { AiGenerateParams, AiProvider } from "@careerden/domain";
import { asSchema } from "ai";
import { AiOutputValidationError } from "../generate-with-output-schema.js";

export interface OpencodeAiProviderConfig {
  baseUrl: string;
  username: string;
  password: string;
  /** Model ID inside OpenCode's `opencode` (Zen) provider, for example a free model. */
  model: string;
  /** Reasoning-effort variant of the model, for example `low`; omit for the model default. */
  variant?: string;
  timeoutMs: number;
  /** Agent defined in the server's opencode.json; `careerden` has no tools and a neutral prompt. */
  agent: string;
  fetch?: typeof fetch;
}

interface OpencodeAssistantMessage {
  type: "assistant";
  content?: Array<{ type: string; text?: string }>;
  error?: { type?: string; message?: string; status?: number };
}

const opencodeProviderId = "opencode";

/**
 * Calls a self-hosted OpenCode v2 server (`opencode serve`). The v2 session API has no per-request
 * system prompt or JSON-schema output, so both travel in the prompt text and the reply is validated
 * here. Every call opens a throwaway session and deletes it afterwards: nothing outlives the
 * request and no candidate data stays on the server.
 *
 * Talks to the HTTP API directly because the published SDK lags the v2 server (no session delete).
 */
export class OpencodeAiProvider implements AiProvider {
  private readonly authorization: string;
  private readonly fetch: typeof fetch;

  constructor(private readonly config: OpencodeAiProviderConfig) {
    this.authorization = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
    this.fetch = config.fetch ?? globalThis.fetch;
  }

  async generate<T>(params: AiGenerateParams<T>): Promise<T> {
    const signal = AbortSignal.timeout(this.config.timeoutMs);
    const schema = await asSchema(params.outputSchema).jsonSchema;
    const session = await this.request<{ data: { id: string } }>("POST", "/api/session", signal, {
      agent: this.config.agent,
      model: {
        providerID: opencodeProviderId,
        id: this.config.model,
        ...(this.config.variant ? { variant: this.config.variant } : {}),
      },
    });
    const sessionID = session.data.id;

    try {
      await this.request("POST", `/api/session/${sessionID}/prompt`, signal, {
        text: promptText(params.system, params.prompt, schema),
      });
      await this.request("POST", `/api/experimental/session/${sessionID}/wait`, signal);
      const messages = await this.request<{ data: Array<{ type: string }> }>(
        "GET",
        `/api/session/${sessionID}/message?limit=20`,
        signal,
      );
      const reply = messages.data.find(
        (message): message is OpencodeAssistantMessage => message.type === "assistant",
      );
      if (!reply) throw new Error("OpenCode returned no assistant message");
      if (reply.error) {
        throw new Error(
          `OpenCode ${reply.error.type ?? "error"}${reply.error.status ? ` ${reply.error.status}` : ""}: ${reply.error.message ?? "request failed"}`,
        );
      }

      const text = (reply.content ?? [])
        .filter((part) => part.type === "text")
        .map((part) => part.text ?? "")
        .join("");
      try {
        return params.outputSchema.parse(JSON.parse(extractJson(text)));
      } catch (parseError) {
        throw new AiOutputValidationError(parseError);
      }
    } finally {
      await this.deleteSession(sessionID);
    }
  }

  private async deleteSession(sessionID: string): Promise<void> {
    try {
      // Not tied to the request signal: a timed-out prompt must still clean up its session.
      await this.request("DELETE", `/api/session/${sessionID}`, AbortSignal.timeout(10_000));
    } catch (error) {
      console.warn("OpenCode session cleanup failed", {
        sessionID,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async request<R = unknown>(
    method: string,
    path: string,
    signal: AbortSignal,
    body?: unknown,
  ): Promise<R> {
    const response = await this.fetch(new URL(path, this.config.baseUrl), {
      method,
      signal,
      headers: {
        Authorization: this.authorization,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      throw new Error(`OpenCode ${method} ${path.split("?")[0]} failed with ${response.status}`);
    }
    const raw = await response.text();
    return (raw ? JSON.parse(raw) : undefined) as R;
  }
}

function promptText(system: string, prompt: string, schema: unknown): string {
  return [
    "INSTRUCTIONS:",
    system,
    "Do not use any tools. Reply with only one JSON object that matches this JSON Schema, with no prose or code fences:",
    JSON.stringify(schema),
    "",
    "INPUT:",
    prompt,
  ].join("\n");
}

/** Models sometimes wrap JSON in fences or prose despite instructions; keep the outermost object. */
function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}
