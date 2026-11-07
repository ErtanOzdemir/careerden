import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { AddJobDialog } from "./AddJobDialog";
import type { ManualJobPrefill } from "./add-job-request";

vi.mock("../api/profiles.js", () => ({
  profilesApi: {
    me: vi.fn(),
  },
}));

vi.mock("../api/jobApplications.js", () => ({
  jobApplicationsApi: {
    create: vi.fn(),
    createManual: vi.fn(),
  },
}));

import { jobApplicationsApi } from "../api/jobApplications.js";
import { profilesApi } from "../api/profiles.js";

describe("AddJobDialog", () => {
  afterEach(() => {
    cleanup();
    delete window.electronAPI;
    vi.clearAllMocks();
  });

  it("opens manual entry filled in from a failed LinkedIn import", () => {
    renderDialog({
      companyName: "Acme",
      jobUrl: "https://www.linkedin.com/jobs/view/1",
      roleTitle: "Engineer",
    });

    expect(screen.getByLabelText(/Company name/)).toHaveValue("Acme");
    expect(screen.getByLabelText(/Job title/)).toHaveValue("Engineer");
    expect(screen.getByLabelText(/Job description/)).toHaveValue("");
  });

  it("disables LinkedIn import in the browser while keeping manual entry available", () => {
    renderDialog();

    expect(screen.getByLabelText(/Company name/)).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /LinkedIn/ }));
    expect(screen.getByLabelText("LinkedIn job URL")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Import from LinkedIn" })).toBeDisabled();
    expect(screen.getByText(/Continue in the desktop app/i)).toBeInTheDocument();
  });

  it("queues an Electron LinkedIn job and opens its application page", async () => {
    const notifyJobApplicationQueued = vi.fn(async () => undefined);
    window.electronAPI = {
      closeWindow: vi.fn(),
      maximizeWindow: vi.fn(),
      minimizeWindow: vi.fn(),
      platform: "darwin",
      notifyJobApplicationQueued,
    };
    vi.mocked(profilesApi.me).mockResolvedValue({ id: "profile-1" } as never);
    vi.mocked(jobApplicationsApi.create).mockResolvedValue({ id: "job-1" } as never);

    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: /LinkedIn/ }));
    fireEvent.change(screen.getByLabelText("LinkedIn job URL"), {
      target: { value: "https://www.linkedin.com/jobs/view/123" },
    });
    fireEvent.click(screen.getByText("Application document preferences"));
    fireEvent.change(screen.getByLabelText("Application pack language"), {
      target: { value: "tr" },
    });
    fireEvent.change(screen.getByLabelText("Application pack tone"), {
      target: { value: "concise" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import from LinkedIn" }));

    await screen.findByText("Application job-1");
    expect(jobApplicationsApi.create).toHaveBeenCalledWith({
      profileId: "profile-1",
      sourceUrl: "https://www.linkedin.com/jobs/view/123",
      applicationPackPreferences: { language: "tr", tone: "concise" },
    });
    expect(notifyJobApplicationQueued).toHaveBeenCalledOnce();
  });

  it("submits pasted manual details and opens the created application", async () => {
    vi.mocked(profilesApi.me).mockResolvedValue({ id: "profile-1" } as never);
    vi.mocked(jobApplicationsApi.createManual).mockResolvedValue({ id: "manual-1" } as never);

    renderDialog();

    fireEvent.change(screen.getByLabelText(/Company name/), {
      target: { value: "Example Inc" },
    });
    fireEvent.change(screen.getByLabelText(/Job title/), {
      target: { value: "Backend Engineer" },
    });
    fireEvent.change(screen.getByLabelText(/Job description/), {
      target: { value: "Build TypeScript services." },
    });
    fireEvent.click(screen.getByText("Add company details"));
    fireEvent.change(screen.getByLabelText("Location"), {
      target: { value: "Remote" },
    });
    fireEvent.change(screen.getByLabelText("Company website"), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add application" }));

    await screen.findByText("Application manual-1");
    expect(jobApplicationsApi.createManual).toHaveBeenCalledWith({
      profileId: "profile-1",
      companyName: "Example Inc",
      roleTitle: "Backend Engineer",
      jobDescription: "Build TypeScript services.",
      companyWebsiteUrl: "https://example.com",
      jobLocation: "Remote",
      applicationPackPreferences: { language: "auto", tone: "professional" },
    });
  });

  it("shows an API error without navigating away", async () => {
    vi.mocked(profilesApi.me).mockResolvedValue({ id: "profile-1" } as never);
    vi.mocked(jobApplicationsApi.createManual).mockRejectedValue(new Error("Upload failed"));

    renderDialog();
    fireEvent.change(screen.getByLabelText(/Company name/), {
      target: { value: "Example Inc" },
    });
    fireEvent.change(screen.getByLabelText(/Job title/), {
      target: { value: "Backend Engineer" },
    });
    fireEvent.change(screen.getByLabelText(/Job description/), {
      target: { value: "Build services." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add application" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Upload failed"));
    expect(screen.queryByText(/Application manual-/)).not.toBeInTheDocument();
  });
});

function renderDialog(manualPrefill?: ManualJobPrefill) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route
          path="/"
          element={<AddJobDialog open manualPrefill={manualPrefill} onClose={vi.fn()} />}
        />
        <Route path="/applications/:id" element={<ApplicationDestination />} />
      </Routes>
    </MemoryRouter>,
  );
}

function ApplicationDestination() {
  const { id } = useParams();
  return <p>Application {id}</p>;
}
