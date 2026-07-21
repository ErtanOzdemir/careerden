import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { supportApi } from "../api/support.js";
import Support from "./Support.js";

vi.mock("../api/support.js", () => ({
  supportApi: { submit: vi.fn() },
}));

describe("Support", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(supportApi.submit).mockReset();
  });

  it("shows the support reasons and contact email", async () => {
    render(<Support />);

    expect(screen.getByRole("link", { name: /support@careerden\.example/i })).toHaveAttribute(
      "href",
      "mailto:support@careerden.example",
    );
    fireEvent.click(screen.getByRole("button", { name: "Open support reason options" }));
    expect(await screen.findByRole("option", { name: "Bug report" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Feature request" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Other" })).toBeInTheDocument();
  });

  it("validates required support details without submitting", async () => {
    render(<Support />);

    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Select a support reason.");

    await selectReason("Other");
    fireEvent.change(screen.getByLabelText("Detailed description"), {
      target: { value: "Short" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Description must be at least 10 characters.",
    );
    expect(supportApi.submit).not.toHaveBeenCalled();
  });

  it("submits trimmed details, confirms success, and resets the form", async () => {
    vi.mocked(supportApi.submit).mockResolvedValue({ accepted: true });
    render(<Support />);

    await selectReason("Bug report");
    fireEvent.change(screen.getByLabelText("Detailed description"), {
      target: { value: "  The preview stays blank after generation.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    await waitFor(() =>
      expect(supportApi.submit).toHaveBeenCalledWith({
        reason: "bug_report",
        description: "The preview stays blank after generation.",
      }),
    );
    const success = await screen.findByRole("status");
    expect(success).toHaveTextContent("Your support request has been received.");
    expect(success).toHaveClass("bg-success-soft/50", "text-success", "border-success/20");
    expect(screen.getByPlaceholderText("Select a reason")).toHaveValue("");
    expect(screen.getByLabelText("Detailed description")).toHaveValue("");
  });

  it("shows API failures and retains the entered details", async () => {
    vi.mocked(supportApi.submit).mockRejectedValue(new Error("Support service unavailable"));
    render(<Support />);

    await selectReason("Feature request");
    fireEvent.change(screen.getByLabelText("Detailed description"), {
      target: { value: "Please add another document layout." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Support service unavailable");
    expect(screen.getByPlaceholderText("Select a reason")).toHaveValue("Feature request");
    expect(screen.getByLabelText("Detailed description")).toHaveValue(
      "Please add another document layout.",
    );
  });
});

async function selectReason(label: string) {
  fireEvent.click(screen.getByRole("button", { name: "Open support reason options" }));
  fireEvent.click(await screen.findByRole("option", { name: label }));
}
