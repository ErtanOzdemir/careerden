import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddJobDialog } from "./AddJobDialog";

vi.mock("../api/profiles.js", () => ({
  profilesApi: {
    me: vi.fn(),
  },
}));

vi.mock("../api/jobApplications.js", () => ({
  jobApplicationsApi: {
    create: vi.fn(),
  },
}));

import { jobApplicationsApi } from "../api/jobApplications.js";
import { profilesApi } from "../api/profiles.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("AddJobDialog", () => {
  afterEach(() => {
    cleanup();
    delete window.electronAPI;
    vi.restoreAllMocks();
  });

  it("queues an Electron job and allows another URL without waiting for scraping", async () => {
    const create = deferred<{ id: string }>();
    const notifyJobApplicationQueued = vi.fn(async () => undefined);

    window.electronAPI = {
      closeWindow: vi.fn(),
      getLinkedInSessionStatus: vi.fn(),
      maximizeWindow: vi.fn(),
      minimizeWindow: vi.fn(),
      platform: "darwin",
      saveLinkedInSession: vi.fn(),
      notifyJobApplicationQueued,
      startLinkedInSession: vi.fn(),
    };
    vi.mocked(profilesApi.me).mockResolvedValue({ id: "profile-1" } as never);
    vi.mocked(jobApplicationsApi.create).mockReturnValue(create.promise as never);

    render(<AddJobDialog open onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Job posting URL"), {
      target: { value: "https://www.linkedin.com/jobs/view/123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add & process" }));

    expect(screen.getByRole("button", { name: "Adding..." })).toBeDisabled();

    create.resolve({ id: "job-1" });

    await waitFor(() => {
      expect(screen.getByText("Job queued for processing.")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Job posting URL")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Job posting URL"), {
      target: { value: "https://www.linkedin.com/jobs/view/456" },
    });
    expect(screen.getByRole("button", { name: "Add & process" })).toBeEnabled();
    expect(notifyJobApplicationQueued).toHaveBeenCalledOnce();
  });
});
