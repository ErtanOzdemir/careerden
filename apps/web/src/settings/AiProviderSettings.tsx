import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, KeyRound, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "../components/ui/button.js";
import { Panel } from "../components/careerden/panel.js";
import { cn } from "../lib/utils.js";
import { AiProviderLogo } from "./AiProviderLogo.js";

export const aiProviderPath = "/ai-provider";

const providers: Array<{
  id: AiProviderName;
  label: string;
  defaultModel: string;
  keysUrl: string;
  // Shown under the model field when the provider needs guidance on choosing one.
  modelHint?: { text: string; linkLabel: string; url: string };
}> = [
  {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4.1-mini",
    keysUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-haiku-5-5",
    keysUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    keysUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    defaultModel: "deepseek-chat",
    keysUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: "openrouter/auto",
    keysUrl: "https://openrouter.ai/keys",
    modelHint: {
      text: "Enter any OpenRouter model id, such as one ending in :free. Choose a model that supports structured outputs, and note that some free models only work in approved apps.",
      linkLabel: "Browse models",
      url: "https://openrouter.ai/models?supported_parameters=structured_outputs",
    },
  },
];

type Feedback = { tone: "success" | "warning" | "error"; message: string } | null;

export type AiCredentialsBridge = NonNullable<NonNullable<Window["electronAPI"]>["aiCredentials"]>;

// Local edition only: the user's own AI provider key, kept by the desktop app in the OS keychain.
export function AiProviderSettings() {
  const bridge = window.electronAPI?.aiCredentials;

  if (!bridge) {
    return (
      <Panel>
        <Header />
        <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
          AI provider keys are managed in the Careerden Unplugged desktop app.
        </p>
      </Panel>
    );
  }

  return <AiProviderPanel bridge={bridge} />;
}

export function AiProviderPanel({
  bridge,
  onStatusChange,
}: {
  bridge: AiCredentialsBridge;
  onStatusChange?: (status: AiCredentialsStatus) => void;
}) {
  const keyInputId = useId();
  const modelInputId = useId();
  const [status, setStatus] = useState<AiCredentialsStatus | null>(null);
  const [provider, setProvider] = useState<AiProviderName>("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | "remove" | "activate" | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let active = true;
    void bridge.getStatus().then(
      (next) => {
        if (!active) return;
        setStatus(next);
        const selected = next.activeProvider ?? "openai";
        setProvider(selected);
        setModel(next.providers.find((entry) => entry.provider === selected)?.model ?? "");
      },
      () => active && setFeedback({ tone: "error", message: "Could not read AI settings." }),
    );
    return () => {
      active = false;
    };
  }, [bridge]);

  useEffect(() => {
    if (status) onStatusChange?.(status);
  }, [onStatusChange, status]);

  const providerInfo = providers.find((entry) => entry.id === provider) ?? providers[0];
  const saved = status?.providers.find((entry) => entry.provider === provider);
  const modelHint = providerInfo.modelHint;

  function selectProvider(next: AiProviderName) {
    setProvider(next);
    setApiKey("");
    setModel(status?.providers.find((entry) => entry.provider === next)?.model ?? "");
    setFeedback(null);
  }

  async function run(action: NonNullable<typeof busy>, work: () => Promise<Feedback>) {
    setBusy(action);
    setFeedback(null);
    try {
      setFeedback(await work());
    } catch (error) {
      setFeedback({ tone: "error", message: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  function input(): AiCredentialsInput {
    return {
      provider,
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      ...(model.trim() ? { model: model.trim() } : {}),
    };
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The desktop app checks the key with the provider first and rejects one that cannot work.
    void run("save", async () => {
      const { warning, ...next } = await bridge.save(input());
      setStatus(next);
      setApiKey("");
      return warning
        ? { tone: "warning", message: warning }
        : { tone: "success", message: `${providerInfo.label} is now your AI provider.` };
    });
  }

  return (
    <Panel>
      <Header />
      <div className="space-y-4 border-t border-border px-5 py-4">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
          Keys are encrypted with your system keychain and never leave this device. AI requests go
          straight from this computer to the provider you choose.
        </p>

        {status && !status.encryptionAvailable && (
          <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            Secure storage is unavailable on this system, so API keys cannot be saved.
          </p>
        )}

        <div role="radiogroup" aria-label="AI provider" className="flex flex-wrap gap-1.5">
          {providers.map((entry) => {
            const entrySaved = status?.providers.find((item) => item.provider === entry.id);
            return (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={provider === entry.id}
                onClick={() => selectProvider(entry.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  provider === entry.id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <AiProviderLogo provider={entry.id} className="size-4 shrink-0 text-foreground" />
                {entry.label}
                {status?.activeProvider === entry.id ? (
                  <CheckCircle2 aria-label="active" className="size-3.5 text-success" />
                ) : entrySaved ? (
                  <KeyRound aria-label="saved" className="size-3.5" />
                ) : null}
              </button>
            );
          })}
        </div>

        <form className="space-y-4" onSubmit={handleSave}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor={keyInputId} className="text-sm font-medium text-foreground">
                {providerInfo.label} API key
              </label>
              <input
                id={keyInputId}
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={saved ? `Saved key ending in ${saved.keyHint}` : "Paste your API key"}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={modelInputId} className="text-sm font-medium text-foreground">
                Model
              </label>
              <input
                id={modelInputId}
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder={`Default: ${providerInfo.defaultModel}`}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"
              />
              {modelHint && (
                <p className="text-xs text-muted-foreground">
                  {modelHint.text}{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => void window.electronAPI?.openExternal?.(modelHint.url)}
                  >
                    {modelHint.linkLabel}
                  </button>
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={busy !== null || (!apiKey.trim() && !saved) || !status?.encryptionAvailable}
            >
              {busy === "save" ? "Checking key…" : "Save and use"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy !== null || (!apiKey.trim() && !saved)}
              onClick={() =>
                void run("test", async () => {
                  const result = await bridge.test(input());
                  return result.ok
                    ? {
                        tone: "success",
                        message: `${providerInfo.label} responded. The key works.`,
                      }
                    : { tone: "error", message: result.message };
                })
              }
            >
              {busy === "test" ? "Testing…" : "Test connection"}
            </Button>
            {saved && status?.activeProvider !== provider && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() =>
                  void run("activate", async () => {
                    setStatus(await bridge.setActive(provider));
                    return {
                      tone: "success",
                      message: `${providerInfo.label} is now your AI provider.`,
                    };
                  })
                }
              >
                Use saved key
              </Button>
            )}
            {saved && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy !== null}
                onClick={() =>
                  void run("remove", async () => {
                    setStatus(await bridge.remove(provider));
                    return { tone: "success", message: `Removed the ${providerInfo.label} key.` };
                  })
                }
              >
                Remove key
              </Button>
            )}
            <button
              type="button"
              className="ml-auto text-sm text-primary hover:underline"
              onClick={() => void window.electronAPI?.openExternal?.(providerInfo.keysUrl)}
            >
              Get a {providerInfo.label} key
            </button>
          </div>
        </form>

        {feedback && (
          <p
            role={feedback.tone === "error" ? "alert" : "status"}
            className={cn(
              "text-sm",
              feedback.tone === "error" && "text-destructive",
              feedback.tone === "warning" && "text-foreground",
              feedback.tone === "success" && "text-success",
            )}
          >
            {feedback.message}
          </p>
        )}
      </div>
    </Panel>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2.5 px-5 py-4">
      <KeyRound className="size-4 text-muted-foreground" />
      <h2 className="text-sm font-semibold text-foreground">AI provider &amp; API Keys</h2>
    </div>
  );
}

// Electron prefixes IPC errors with the channel name; show only the handler's message.
function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") ||
    "Something went wrong."
  );
}
