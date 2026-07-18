import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { JobApplication } from "../types.js";
import type { ApiJobApplicationDetail, ApiProfile } from "../api/types.js";
import AppDetail, {
  CompanyDetailsPanel,
  FollowUpsEmptyState,
  JobDetailsPanel,
} from "./AppDetail.js";

vi.mock("../api/jobApplications.js", () => ({
  jobApplicationsApi: {
    createContact: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock("../api/profiles.js", () => ({
  profilesApi: {
    get: vi.fn(),
    listDocumentTemplates: vi.fn(),
  },
}));

vi.mock("../api/jobApplicationChanges.js", () => ({
  useJobApplicationChanges: vi.fn(),
}));

import { jobApplicationsApi } from "../api/jobApplications.js";
import { profilesApi } from "../api/profiles.js";

describe("AppDetail contacts", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("creates and displays an optional contact phone number", async () => {
    const detail = createApplicationDetail();
    vi.mocked(jobApplicationsApi.get).mockResolvedValue(detail);
    vi.mocked(jobApplicationsApi.createContact).mockResolvedValue(detail.contacts[0]!);
    vi.mocked(profilesApi.get).mockResolvedValue(createProfile());
    vi.mocked(profilesApi.listDocumentTemplates).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/applications/job-1"]}>
        <Routes>
          <Route path="/applications/:id" element={<AppDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Follow-ups & notes" }));
    expect(screen.getByText("+1 555 0101")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
    fireEvent.change(screen.getByPlaceholderText("Name"), {
      target: { value: "  Grace Hopper  " },
    });
    fireEvent.change(screen.getByPlaceholderText("Phone"), {
      target: { value: "  +1 555 0199  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(jobApplicationsApi.createContact).toHaveBeenCalledWith("job-1", {
        email: undefined,
        name: "Grace Hopper",
        phone: "+1 555 0199",
        role: undefined,
      }),
    );
    await waitFor(() => expect(screen.queryByPlaceholderText("Phone")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
    expect(screen.getByPlaceholderText("Phone")).toHaveValue("");
  });

  it("opens the follow-ups view from a timeline deep link", async () => {
    const detail = createApplicationDetail();
    vi.mocked(jobApplicationsApi.get).mockResolvedValue(detail);
    vi.mocked(profilesApi.get).mockResolvedValue(createProfile());
    vi.mocked(profilesApi.listDocumentTemplates).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/applications/job-1?tab=timeline"]}>
        <Routes>
          <Route path="/applications/:id" element={<AppDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Follow-ups")).toBeInTheDocument();
    expect(screen.getByText("Contacts")).toBeInTheDocument();
  });
});

describe("FollowUpsEmptyState", () => {
  afterEach(cleanup);

  it("describes reminders and starts the add flow", () => {
    const onAdd = vi.fn();

    render(<FollowUpsEmptyState onAdd={onAdd} />);

    expect(screen.getByText("No follow-ups scheduled")).toBeInTheDocument();
    expect(screen.getByText(/remind you 10 minutes before/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Schedule your first follow-up" }));
    expect(onAdd).toHaveBeenCalledOnce();
  });
});

describe("JobDetailsPanel", () => {
  afterEach(cleanup);

  it("shows independent salary and interest rows", () => {
    renderPanel();

    expect(screen.getByText("Salary")).toBeInTheDocument();
    expect(screen.queryByText("Company website")).not.toBeInTheDocument();
    expect(screen.getByText("Work style")).toBeInTheDocument();
    expect(screen.getByText("Interest level")).toBeInTheDocument();
    expect(screen.getAllByText("Not set")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Edit salary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit work style" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit interest level" })).toBeInTheDocument();
  });

  it("opens and cancels the interest editor without changing the value", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Edit interest level" }));
    expect(screen.getByPlaceholderText("Select interest level")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit salary" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getAllByText("Not set")).toHaveLength(3);
  });

  it("saves a selected interest level", async () => {
    const onSaveInterest = vi.fn(async () => undefined);
    renderPanel({ onSaveInterest });

    fireEvent.click(screen.getByRole("button", { name: "Edit interest level" }));
    fireEvent.click(screen.getByRole("button", { name: "Open interest level options" }));
    fireEvent.click(await screen.findByText("Highly interested"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaveInterest).toHaveBeenCalledWith("high"));
  });

  it("clears an existing interest level by selecting Not set", async () => {
    const onSaveInterest = vi.fn(async () => undefined);
    renderPanel({
      app: { ...createApplication(), interestLevel: "medium" },
      onSaveInterest,
    });

    expect(screen.getByText("👀 Interested")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit interest level" }));
    fireEvent.click(screen.getByRole("button", { name: "Open interest level options" }));
    fireEvent.click(await screen.findByRole("option", { name: "Not set" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaveInterest).toHaveBeenCalledWith(null));
  });

  it("updates salary as gross or net", async () => {
    const onSaveSalary = vi.fn(async () => undefined);
    renderPanel({
      app: {
        ...createApplication(),
        salaryMinAmount: 90_000,
        salaryCurrency: "EUR",
        salaryPeriod: "yearly",
        salaryType: "gross",
      },
      onSaveSalary,
    });

    expect(screen.getByText("90,000 EUR / year · Gross")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit salary" }));
    fireEvent.click(screen.getByRole("button", { name: "Open salary type options" }));
    fireEvent.click(await screen.findByRole("option", { name: "Net" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(onSaveSalary).toHaveBeenCalledWith({
        salaryMinAmount: 90_000,
        salaryMaxAmount: null,
        salaryCurrency: "EUR",
        salaryPeriod: "yearly",
        salaryType: "net",
      }),
    );
  });

  it("updates and clears work style", async () => {
    const onSaveWorkStyle = vi.fn(async () => undefined);
    renderPanel({
      app: { ...createApplication(), workStyle: "remote" },
      onSaveWorkStyle,
    });

    expect(screen.getByText("Remote")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit work style" }));
    fireEvent.click(screen.getByRole("button", { name: "Open work style options" }));
    fireEvent.click(await screen.findByRole("option", { name: "Hybrid" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaveWorkStyle).toHaveBeenCalledWith("hybrid"));

    fireEvent.click(screen.getByRole("button", { name: "Edit work style" }));
    fireEvent.click(screen.getByRole("button", { name: "Open work style options" }));
    fireEvent.click(await screen.findByRole("option", { name: "Not set" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaveWorkStyle).toHaveBeenCalledWith(null));
  });
});

describe("CompanyDetailsPanel", () => {
  afterEach(cleanup);

  it("omits the panel when the company details are blank", () => {
    const { container } = render(<CompanyDetailsPanel description="   " websiteUrl="   " />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the company website in a new tab when no description exists", () => {
    render(<CompanyDetailsPanel websiteUrl="https://www.acme.example/careers" />);

    expect(screen.getByRole("heading", { name: "Company details" })).toBeInTheDocument();
    const companyWebsite = screen.getByRole("link", {
      name: "https://www.acme.example/careers",
    });
    expect(companyWebsite).toHaveAttribute("href", "https://www.acme.example/careers");
    expect(companyWebsite).toHaveAttribute("target", "_blank");
    expect(companyWebsite).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows a short description without an expansion control", () => {
    render(<CompanyDetailsPanel description="  Acme builds reliable products.  " />);

    expect(screen.getByText("Acme builds reliable products.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("collapses and expands a long description accessibly", () => {
    const description = `Acme builds reliable products. ${"Product teams use them every day. ".repeat(12)}`;
    render(<CompanyDetailsPanel description={description} />);

    const text = screen.getByText(/Acme builds reliable products/);
    const expandButton = screen.getByRole("button", { name: "Show more" });
    expect(text).toHaveClass("line-clamp-5");
    expect(expandButton).toHaveAttribute("aria-expanded", "false");
    expect(expandButton).toHaveAttribute("aria-controls", text.id);

    fireEvent.click(expandButton);

    expect(text).not.toHaveClass("line-clamp-5");
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});

function renderPanel({
  app = createApplication(),
  onSaveInterest = vi.fn(async () => undefined),
  onSaveSalary = vi.fn(async () => undefined),
  onSaveWorkStyle = vi.fn(async () => undefined),
}: {
  app?: JobApplication;
  onSaveInterest?: (interestLevel: "high" | "low" | "medium" | null) => Promise<void>;
  onSaveSalary?: (input: {
    salaryCurrency: string | null;
    salaryMaxAmount: number | null;
    salaryMinAmount: number | null;
    salaryPeriod: "hourly" | "monthly" | "yearly" | null;
    salaryType: "gross" | "net" | null;
  }) => Promise<void>;
  onSaveWorkStyle?: (workStyle: "hybrid" | "on_site" | "remote" | null) => Promise<void>;
} = {}) {
  return render(
    <JobDetailsPanel
      app={app}
      isSavingInterest={false}
      isSavingSalary={false}
      isSavingWorkStyle={false}
      onSaveInterest={onSaveInterest}
      onSaveSalary={onSaveSalary}
      onSaveWorkStyle={onSaveWorkStyle}
    />,
  );
}

function createApplication(): JobApplication {
  return {
    id: "job-1",
    company: "Acme",
    companyWebsiteUrl: "https://www.acme.example/careers",
    domain: "linkedin.com",
    role: "Engineer",
    location: "Remote",
    dateApplied: "Jul 12, 2026",
    dateLabel: "Today",
    status: "Saved",
    tags: [],
  };
}

function createApplicationDetail(): ApiJobApplicationDetail {
  return {
    applicationPackPreferences: { language: "auto", tone: "professional" },
    contacts: [
      {
        createdAt: "2026-07-17T08:00:00.000Z",
        id: "contact-1",
        jobApplicationId: "job-1",
        name: "Sarah Hughes",
        phone: "+1 555 0101",
        role: "Recruiter",
        updatedAt: "2026-07-17T08:00:00.000Z",
      },
    ],
    createdAt: "2026-07-17T08:00:00.000Z",
    documentContent: null,
    documents: [],
    events: [],
    followUps: [],
    id: "job-1",
    matchAnalysis: null,
    profileId: "profile-1",
    profileReadiness: { state: "ready", warnings: [] },
    scrapeBundle: null,
    sourceUrl: "https://www.linkedin.com/jobs/view/1",
    status: "completed",
    tracking: {
      applicationStatus: "saved",
      companyName: "Acme",
      metadata: {},
      roleTitle: "Frontend Engineer",
      tags: [],
    },
    updatedAt: "2026-07-17T08:00:00.000Z",
  };
}

function createProfile(): ApiProfile {
  return {
    autoGenerateDocuments: false,
    autoRunMatchAnalysis: true,
    certifications: [],
    createdAt: "2026-07-17T08:00:00.000Z",
    education: [],
    email: "ada@example.com",
    experience: [],
    followUpRemindersEnabled: true,
    fullName: "Ada Lovelace",
    id: "profile-1",
    links: [],
    projects: [],
    skills: [],
    updatedAt: "2026-07-17T08:00:00.000Z",
  };
}
