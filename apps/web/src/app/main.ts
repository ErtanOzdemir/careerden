import "../styles.css";

type ProfileExperienceInput = {
  company: string;
  title: string;
  achievements: string[];
};

type Profile = {
  id: string;
  fullName: string;
  email: string;
  headline?: string;
  location?: string;
  summary?: string;
  skills: string[];
  experience: ProfileExperienceInput[];
};

type JobApplication = {
  id: string;
  sourceUrl: string;
  status: string;
  failureReason?: string;
  documents?: Array<{
    id: string;
    kind: "cv" | "cover_letter";
    fileName: string;
  }>;
};

type LinkedInSessionStatus = "missing" | "login_in_progress" | "connected" | "expired";
type PendingAction = "profile" | "job" | "linkedin_start" | "linkedin_save";
type MessageTone = "info" | "error";

const apiBaseUrl = "http://localhost:3000";
const profileStorageKey = "link2cv.profile";
const state: {
  profile?: Profile;
  jobs: JobApplication[];
  linkedInStatus: LinkedInSessionStatus;
  messageTone: MessageTone;
  message?: string;
  pendingAction?: PendingAction;
} = {
  profile: loadProfile(),
  jobs: [],
  linkedInStatus: "missing",
  messageTone: "info",
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found");
}

const appRoot = app;

render();
void refreshLinkedInStatus();
void refreshJobs();

function render() {
  appRoot.innerHTML = `
    <section class="layout">
      <aside class="sidebar">
        <h1>Link2CV</h1>
        <nav>
          <a href="#profile">Profile</a>
          <a href="#linkedin">LinkedIn</a>
          <a href="#jobs" aria-current="page">Jobs</a>
        </nav>
      </aside>

      <main class="content">
        <section class="panel" id="profile">
          <div class="section-header">
            <div>
              <h2>Profile</h2>
              <p>${state.profile ? `Saved for ${escapeHtml(state.profile.fullName)}` : "Enter your details before adding jobs."}</p>
            </div>
            <span class="status ${state.profile ? "status-ok" : ""}">${state.profile ? "saved" : "required"}</span>
          </div>

          <form id="profile-form" class="form-grid">
            <label>
              Full name
              <input name="fullName" value="${escapeAttribute(state.profile?.fullName ?? "")}" required />
            </label>
            <label>
              Email
              <input name="email" type="email" value="${escapeAttribute(state.profile?.email ?? "")}" required />
            </label>
            <label>
              Headline
              <input name="headline" value="${escapeAttribute(state.profile?.headline ?? "")}" />
            </label>
            <label>
              Location
              <input name="location" value="${escapeAttribute(state.profile?.location ?? "")}" />
            </label>
            <label class="wide">
              Summary
              <textarea name="summary" rows="4">${escapeHtml(state.profile?.summary ?? "")}</textarea>
            </label>
            <label class="wide">
              Skills
              <textarea name="skills" rows="3">${escapeHtml(state.profile?.skills.join(", ") ?? "")}</textarea>
            </label>
            <label>
              Company
              <input name="company" value="${escapeAttribute(state.profile?.experience[0]?.company ?? "")}" />
            </label>
            <label>
              Role
              <input name="title" value="${escapeAttribute(state.profile?.experience[0]?.title ?? "")}" />
            </label>
            <label class="wide">
              Achievements
              <textarea name="achievements" rows="4">${escapeHtml(state.profile?.experience[0]?.achievements.join("\\n") ?? "")}</textarea>
            </label>
            <div class="actions wide">
              <button type="submit">Save Profile</button>
            </div>
          </form>
        </section>

        <section class="panel" id="linkedin">
          <div class="section-header">
            <div>
              <h2>LinkedIn Session</h2>
              <p>${linkedInStatusCopy(state.linkedInStatus)}</p>
            </div>
            <span class="status ${state.linkedInStatus === "connected" ? "status-ok" : ""}">${state.linkedInStatus.replaceAll("_", " ")}</span>
          </div>
          <p class="hint">This opens a separate browser window from the backend process. If no window appears, the backend cannot launch a visible browser in this environment.</p>
          <div class="actions">
            <button type="button" id="start-linkedin-session" ${state.pendingAction ? "disabled" : ""}>${state.pendingAction === "linkedin_start" ? "Opening..." : "Open LinkedIn Login Window"}</button>
            <button type="button" id="save-linkedin-session" class="secondary" ${state.pendingAction ? "disabled" : ""}>${state.pendingAction === "linkedin_save" ? "Saving..." : "I Logged In, Save Session"}</button>
          </div>
        </section>

        <section class="panel" id="jobs">
          <div class="section-header">
            <div>
              <h2>Job Applications</h2>
              <p>${state.profile ? "Paste a LinkedIn job URL to start matching." : "Save your profile first."}</p>
            </div>
          </div>

          <form id="job-form" class="job-form">
            <input name="sourceUrl" placeholder="https://www.linkedin.com/jobs/view/..." ${state.profile ? "" : "disabled"} required />
            <button type="submit" ${state.profile ? "" : "disabled"}>Add Job</button>
          </form>

          ${state.message ? `<p class="message ${state.messageTone === "error" ? "message-error" : ""}">${escapeHtml(state.message)}</p>` : ""}

          <table>
            <thead>
              <tr>
                <th>Job URL</th>
                <th>Status</th>
                <th>Documents</th>
              </tr>
            </thead>
            <tbody>
              ${renderJobRows()}
            </tbody>
          </table>
        </section>
      </main>
    </section>
  `;

  document.querySelector("#profile-form")?.addEventListener("submit", onProfileSubmit);
  document.querySelector("#job-form")?.addEventListener("submit", onJobSubmit);
  document
    .querySelector("#start-linkedin-session")
    ?.addEventListener("click", onStartLinkedInSession);
  document
    .querySelector("#save-linkedin-session")
    ?.addEventListener("click", onSaveLinkedInSession);
  document.querySelectorAll<HTMLButtonElement>("[data-download-document]").forEach((button) => {
    button.addEventListener("click", () => {
      void downloadDocument(button.dataset.jobId ?? "", button.dataset.downloadDocument ?? "");
    });
  });
}

async function onProfileSubmit(event: Event) {
  event.preventDefault();
  state.pendingAction = "profile";
  state.message = "Saving profile...";
  state.messageTone = "info";
  render();

  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  const company = String(data.get("company") ?? "").trim();
  const title = String(data.get("title") ?? "").trim();
  const achievements = splitLines(String(data.get("achievements") ?? ""));
  const payload = {
    fullName: String(data.get("fullName") ?? "").trim(),
    email: String(data.get("email") ?? "").trim(),
    headline: optionalString(data.get("headline")),
    location: optionalString(data.get("location")),
    summary: optionalString(data.get("summary")),
    skills: splitCsv(String(data.get("skills") ?? "")),
    experience:
      company && title
        ? [
            {
              company,
              title,
              achievements,
            },
          ]
        : [],
  };

  try {
    const profile = await postJson<Profile>("/profiles", payload);
    state.profile = profile;
    state.message = "Profile saved.";
    state.messageTone = "info";
    localStorage.setItem(profileStorageKey, JSON.stringify(profile));
    await refreshJobs();
  } catch (error) {
    state.message = errorMessage(error);
    state.messageTone = "error";
  } finally {
    state.pendingAction = undefined;
    render();
  }
}

async function onJobSubmit(event: Event) {
  event.preventDefault();

  if (!state.profile) {
    state.message = "Save your profile before adding jobs.";
    state.messageTone = "error";
    render();
    return;
  }

  state.pendingAction = "job";
  state.message = "Submitting job...";
  state.messageTone = "info";
  render();

  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);

  try {
    await postJson<JobApplication>("/job-applications", {
      profileId: state.profile.id,
      sourceUrl: String(data.get("sourceUrl") ?? "").trim(),
    });

    form.reset();
    state.message = "Job submitted.";
    state.messageTone = "info";
    await refreshJobs();
  } catch (error) {
    state.message = errorMessage(error);
    state.messageTone = "error";
  } finally {
    state.pendingAction = undefined;
    render();
  }
}

async function onStartLinkedInSession() {
  state.pendingAction = "linkedin_start";
  state.message = "Opening LinkedIn login window...";
  state.messageTone = "info";
  render();

  try {
    const result = await postJson<{ status: LinkedInSessionStatus; message?: string }>(
      "/linkedin-session/start",
      {},
    );

    state.linkedInStatus = result.status;
    state.message = result.message ?? linkedInStatusCopy(result.status);
    state.messageTone = result.status === "missing" ? "error" : "info";
  } catch (error) {
    state.message = errorMessage(error);
    state.messageTone = "error";
  } finally {
    state.pendingAction = undefined;
    render();
  }
}

async function onSaveLinkedInSession() {
  state.pendingAction = "linkedin_save";
  state.message = "Checking LinkedIn login session...";
  state.messageTone = "info";
  render();

  try {
    const result = await postJson<{ status: LinkedInSessionStatus; message?: string }>(
      "/linkedin-session/save",
      {},
    );

    state.linkedInStatus = result.status;
    state.message = result.message ?? linkedInStatusCopy(result.status);
    state.messageTone = result.status === "connected" ? "info" : "error";
  } catch (error) {
    state.message = errorMessage(error);
    state.messageTone = "error";
  } finally {
    state.pendingAction = undefined;
    render();
  }
}

async function refreshLinkedInStatus() {
  const result = await getJson<{ status: LinkedInSessionStatus; message?: string }>(
    "/linkedin-session/status",
  ).catch((error) => {
    state.message = errorMessage(error);
    state.messageTone = "error";
    return undefined;
  });

  if (result) {
    state.linkedInStatus = result.status;
    if (result.message) {
      state.message = result.message;
      state.messageTone = "info";
    }
    render();
  }
}

async function refreshJobs() {
  if (!state.profile) {
    state.jobs = [];
    render();
    return;
  }

  state.jobs = await getJson<JobApplication[]>(
    `/job-applications?profileId=${encodeURIComponent(state.profile.id)}`,
  ).catch(() => []);
  render();
}

async function downloadDocument(jobId: string, documentId: string) {
  if (!jobId || !documentId) {
    state.message = "Document is not available yet.";
    state.messageTone = "error";
    render();
    return;
  }

  state.message = "Preparing document download...";
  state.messageTone = "info";
  render();

  try {
    const result = await getJson<{ url: string }>(
      `/job-applications/${encodeURIComponent(jobId)}/documents/${encodeURIComponent(documentId)}/download`,
    );

    window.location.href = result.url;
  } catch (error) {
    state.message = errorMessage(error);
    state.messageTone = "error";
    render();
  }
}

function renderJobRows(): string {
  if (state.jobs.length === 0) {
    return `
      <tr>
        <td colspan="3">No jobs yet.</td>
      </tr>
    `;
  }

  return state.jobs
    .map(
      (job) => `
        <tr>
          <td>
            <a href="${escapeAttribute(job.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(job.sourceUrl)}</a>
            ${job.failureReason ? `<p class="error">${escapeHtml(job.failureReason)}</p>` : ""}
          </td>
          <td><span class="status ${job.status === "completed" ? "status-ok" : ""}">${escapeHtml(job.status)}</span></td>
          <td class="document-actions">
            ${renderDocumentButton(job, "cv", "CV")}
            ${renderDocumentButton(job, "cover_letter", "Cover Letter")}
          </td>
        </tr>
      `,
    )
    .join("");
}

function renderDocumentButton(
  job: JobApplication,
  kind: "cv" | "cover_letter",
  label: string,
): string {
  const document = job.documents?.find((item) => item.kind === kind);

  return `
    <button
      type="button"
      class="secondary"
      data-job-id="${escapeAttribute(job.id)}"
      data-download-document="${escapeAttribute(document?.id ?? "")}"
      ${document ? "" : "disabled"}
    >
      ${label}
    </button>
  `;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`);

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }

  return (await response.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }

  return (await response.json()) as T;
}

function loadProfile(): Profile | undefined {
  const value = localStorage.getItem(profileStorageKey);

  return value ? (JSON.parse(value) as Profile) : undefined;
}

function optionalString(value: FormDataEntryValue | null): string | undefined {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function linkedInStatusCopy(status: LinkedInSessionStatus): string {
  if (status === "connected") {
    return "Ready for LinkedIn job scraping.";
  }

  if (status === "login_in_progress") {
    return "Finish login in the opened browser window, then save.";
  }

  if (status === "expired") {
    return "Reconnect before adding new jobs.";
  }

  return "Connect before scraping private job details.";
}

async function responseErrorMessage(response: Response): Promise<string> {
  const text = await response.text();

  if (!text) {
    return `${response.status} ${response.statusText}`;
  }

  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string };
    return parsed.error ?? parsed.message ?? text;
  } catch {
    return text;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
