import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiProviderSettings } from "./AiProviderSettings";

function status(overrides: Partial<AiCredentialsStatus> = {}): AiCredentialsStatus {
  return { encryptionAvailable: true, activeProvider: null, providers: [], ...overrides };
}

function installBridge(initial: AiCredentialsStatus) {
  const bridge = {
    getStatus: vi.fn(async () => initial),
    save: vi.fn(async (input: AiCredentialsInput) =>
      status({
        activeProvider: input.provider,
        providers: [{ provider: input.provider, keyHint: (input.apiKey ?? "0000").slice(-4) }],
      }),
    ),
    remove: vi.fn(async () => status()),
    setActive: vi.fn(async (provider: AiProviderName) =>
      status({ ...initial, activeProvider: provider }),
    ),
    test: vi.fn(async (): Promise<AiCredentialsTestResult> => ({ ok: true })),
  };
  window.electronAPI = { notifyJobApplicationQueued: vi.fn(), aiCredentials: bridge };
  return bridge;
}

describe("AiProviderSettings", () => {
  afterEach(() => {
    cleanup();
    delete window.electronAPI;
  });

  it("explains where keys live when the desktop bridge is unavailable", () => {
    render(<AiProviderSettings />);

    expect(
      screen.getByText("AI provider keys are managed in the Careerden Unplugged desktop app."),
    ).toBeInTheDocument();
  });

  it("selects the active provider and shows only the saved key hint", async () => {
    installBridge(
      status({
        activeProvider: "anthropic",
        providers: [{ provider: "anthropic", model: "claude-sonnet-5-5", keyHint: "9876" }],
      }),
    );

    render(<AiProviderSettings />);

    expect(await screen.findByPlaceholderText("Saved key ending in 9876")).toHaveValue("");
    expect(screen.getByRole("radio", { name: /anthropic/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("Model")).toHaveValue("claude-sonnet-5-5");
    expect(screen.getByLabelText("Anthropic API key")).toHaveAttribute("type", "password");
  });

  it("saves a new key, clears the field, and reports the active provider", async () => {
    const bridge = installBridge(status());
    render(<AiProviderSettings />);
    await waitFor(() => expect(bridge.getStatus).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("radio", { name: /google gemini/i }));
    fireEvent.change(screen.getByLabelText("Google Gemini API key"), {
      target: { value: " gemini-key-4321 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and use" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Google Gemini is now your AI provider.",
    );
    expect(bridge.save).toHaveBeenCalledWith({ provider: "gemini", apiKey: "gemini-key-4321" });
    expect(screen.getByLabelText("Google Gemini API key")).toHaveValue("");
    expect(screen.getByPlaceholderText("Saved key ending in 4321")).toBeInTheDocument();
  });

  it("shows a failed connection test as an alert", async () => {
    const bridge = installBridge(status());
    bridge.test.mockResolvedValue({ ok: false, message: "Incorrect API key provided." });
    render(<AiProviderSettings />);
    await waitFor(() => expect(bridge.getStatus).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("OpenAI API key"), { target: { value: "sk-bad" } });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect API key provided.");
    expect(bridge.test).toHaveBeenCalledWith({ provider: "openai", apiKey: "sk-bad" });
  });

  it("switches to and removes saved keys", async () => {
    const bridge = installBridge(
      status({
        activeProvider: "openai",
        providers: [
          { provider: "openai", keyHint: "1111" },
          { provider: "deepseek", keyHint: "2222" },
        ],
      }),
    );
    render(<AiProviderSettings />);
    await screen.findByPlaceholderText("Saved key ending in 1111");

    fireEvent.click(screen.getByRole("radio", { name: /deepseek/i }));
    fireEvent.click(screen.getByRole("button", { name: "Use saved key" }));
    await waitFor(() => expect(bridge.setActive).toHaveBeenCalledWith("deepseek"));
    fireEvent.click(await screen.findByRole("button", { name: "Remove key" }));

    await waitFor(() => expect(bridge.remove).toHaveBeenCalledWith("deepseek"));
    expect(await screen.findByRole("status")).toHaveTextContent("Removed the DeepSeek key.");
  });

  it("disables saving when secure storage is unavailable", async () => {
    installBridge(status({ encryptionAvailable: false }));
    render(<AiProviderSettings />);

    expect(
      await screen.findByText(
        "Secure storage is unavailable on this system, so API keys cannot be saved.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("OpenAI API key"), { target: { value: "sk-key" } });
    expect(screen.getByRole("button", { name: "Save and use" })).toBeDisabled();
  });

  it("shows the bridge's error message without Electron's IPC prefix", async () => {
    const bridge = installBridge(status());
    bridge.save.mockRejectedValue(
      new Error("Error invoking remote method 'ai-credentials-save': Error: Add a key first"),
    );
    render(<AiProviderSettings />);
    await waitFor(() => expect(bridge.getStatus).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("OpenAI API key"), { target: { value: "sk-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and use" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/^Add a key first$/);
  });

  it("accepts a free-form OpenRouter model id and explains how to choose one", async () => {
    const bridge = installBridge(status());
    render(<AiProviderSettings />);
    await waitFor(() => expect(bridge.getStatus).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("radio", { name: /openrouter/i }));
    expect(screen.getByLabelText("Model")).toHaveAttribute(
      "placeholder",
      "Default: openrouter/auto",
    );
    expect(screen.getByText(/supports structured outputs/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("OpenRouter API key"), {
      target: { value: "sk-or-key" },
    });
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "thinkingmachines/inkling-small:free" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and use" }));

    await waitFor(() =>
      expect(bridge.save).toHaveBeenCalledWith({
        provider: "openrouter",
        apiKey: "sk-or-key",
        model: "thinkingmachines/inkling-small:free",
      }),
    );
  });
});
