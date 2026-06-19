import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import Timeline from "../components/Timeline";
import type { TimelineInterviewInput } from "../components/Timeline";
import ProcessingLog from "../components/ProcessingLog";
import AiMatchCard from "../components/AiMatchCard";
import CompanyLogo from "../components/CompanyLogo";
import { jobApplicationsApi } from "../api/jobApplications";
import { profilesApi } from "../api/profiles";
import { mapApiJobApplicationToUi, mapUiStatusToApi } from "../api/mappers";
import type { ApplicationStatus, JobApplication } from "../types";

const statusOptions: ApplicationStatus[] = ["Applied", "Interviewing", "Offer", "Rejected"];

export default function AppDetail() {
  const { id } = useParams();
  const [app, setApp] = useState<JobApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [isAddingInterview, setIsAddingInterview] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isGeneratingDocuments, setIsGeneratingDocuments] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({ name: "", role: "", email: "" });
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);
  const [interviewNotes, setInterviewNotes] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadApplication() {
      if (!id) {
        setError("Application ID is missing.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const detail = await jobApplicationsApi.get(id);
        const profile = await profilesApi.get(detail.profileId);

        if (isMounted) {
          const mapped = mapApiJobApplicationToUi(detail, profile);
          setApp(mapped);
          setInterviewNotes(mapped.interviewNotes ?? "");
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load application.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadApplication();

    return () => {
      isMounted = false;
    };
  }, [id]);

  async function handleStatusChange(status: ApplicationStatus) {
    if (!id) {
      return;
    }

    try {
      setIsUpdatingStatus(true);
      setError(null);
      await jobApplicationsApi.update(id, { applicationStatus: mapUiStatusToApi(status) });
      await refreshApplication(id);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function refreshApplication(jobApplicationId: string) {
    const detail = await jobApplicationsApi.get(jobApplicationId);
    const profile = await profilesApi.get(detail.profileId);
    const mapped = mapApiJobApplicationToUi(detail, profile);

    setApp(mapped);
    setInterviewNotes(mapped.interviewNotes ?? "");
  }

  async function handleGenerateDocuments() {
    if (!id) {
      return;
    }

    try {
      setIsGeneratingDocuments(true);
      setError(null);
      const detail = await jobApplicationsApi.generateDocuments(id);
      const profile = await profilesApi.get(detail.profileId);
      const mapped = mapApiJobApplicationToUi(detail, profile);

      setApp(mapped);
      setInterviewNotes(mapped.interviewNotes ?? "");
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Failed to create CV.");
    } finally {
      setIsGeneratingDocuments(false);
    }
  }

  async function handleRetryProcessing() {
    if (!id) {
      return;
    }

    try {
      setIsRetrying(true);
      setError(null);
      await jobApplicationsApi.retry(id);
      await refreshApplication(id);
      void monitorProcessing(id);
    } catch (retryError) {
      setError(
        retryError instanceof Error
          ? retryError.message
          : "Failed to retry application processing.",
      );
    } finally {
      setIsRetrying(false);
    }
  }

  async function monitorProcessing(jobApplicationId: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1500));

      try {
        const detail = await jobApplicationsApi.get(jobApplicationId);
        const profile = await profilesApi.get(detail.profileId);
        const mapped = mapApiJobApplicationToUi(detail, profile);

        setApp(mapped);
        setInterviewNotes(mapped.interviewNotes ?? "");

        if (["completed", "failed", "review_ready"].includes(mapped.processingStatus ?? "")) {
          return;
        }
      } catch {
        return;
      }
    }
  }

  async function handleDownloadDocument(documentId: string) {
    if (!id) {
      return;
    }

    try {
      setDownloadingDocumentId(documentId);
      setError(null);

      const document = app?.generatedDocuments?.find((item) => item.id === documentId);

      if (!document) {
        throw new Error("Document not found.");
      }

      const { url } = await jobApplicationsApi.getDocumentDownloadUrl(id, { id: document.id });

      window.open(url, "_blank", "noopener,noreferrer");
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Failed to download file.");
    } finally {
      setDownloadingDocumentId(null);
    }
  }

  async function handleAddInterview(input: TimelineInterviewInput) {
    if (!id) {
      return;
    }

    try {
      setIsAddingInterview(true);
      setError(null);
      await jobApplicationsApi.createInterview(id, {
        scheduledAt: input.scheduledAt,
        title: input.title,
        type: input.type,
      });
      await refreshApplication(id);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Failed to add interview.");
    } finally {
      setIsAddingInterview(false);
    }
  }

  async function handleAddContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!id || !contactForm.name.trim()) {
      return;
    }

    try {
      setIsAddingContact(true);
      setError(null);
      await jobApplicationsApi.createContact(id, {
        email: contactForm.email.trim() || undefined,
        name: contactForm.name.trim(),
        role: contactForm.role.trim() || undefined,
      });
      setContactForm({ name: "", role: "", email: "" });
      setIsContactFormOpen(false);
      await refreshApplication(id);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Failed to add contact.");
    } finally {
      setIsAddingContact(false);
    }
  }

  async function handleSaveInterviewNotes(nextNotes = interviewNotes) {
    if (!id || !app) {
      return;
    }

    try {
      setIsSavingNotes(true);
      setError(null);
      await jobApplicationsApi.update(id, {
        metadata: {
          ...(app.metadata ?? {}),
          interviewNotes: nextNotes.trim(),
        },
      });
      await refreshApplication(id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save interview notes.");
    } finally {
      setIsSavingNotes(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-2xl gap-4 text-secondary">
        Loading application...
      </div>
    );
  }

  if (!app) {
    return (
      <div className="flex flex-col items-center justify-center py-2xl gap-4">
        <span className="material-symbols-outlined text-6xl text-outline">search_off</span>
        <p className="font-headline-md">{error ?? "Application not found"}</p>
        <Link to="/applications" className="text-primary font-label-md hover:underline">
          Back to Applications
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-max-width mx-auto">
      <nav className="flex items-center gap-2 mb-lg text-on-surface-variant pt-lg">
        <Link
          to="/applications"
          className="hover:text-primary transition-colors flex items-center gap-1 font-label-md"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Boards
        </Link>
      </nav>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md mb-2xl">
        <div className="flex min-w-0 items-center gap-md">
          <CompanyLogo
            className="h-14 w-14 shrink-0 text-lg"
            company={app.company}
            logo={app.logo}
          />
          <div className="min-w-0">
            <h2 className="font-display font-headline-lg text-on-surface">{app.role}</h2>
            <p className="font-body-lg text-secondary">
              {app.company} &bull; {app.location}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-sm">
          <div className="bg-surface-container-high px-4 py-2 rounded-lg flex items-center gap-3 border border-outline-variant">
            <span className="font-label-md text-on-surface-variant">Status:</span>
            <select
              value={app.status}
              onChange={(event) => void handleStatusChange(event.target.value as ApplicationStatus)}
              disabled={isUpdatingStatus}
              className="bg-transparent border-none font-bold text-primary focus:ring-0 cursor-pointer p-0 pr-8 outline-none disabled:opacity-60"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <p className="mb-lg text-body-md text-error">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        <div className="lg:col-span-7 space-y-lg">
          {app.description && (
            <section className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm">
              <div className="flex items-center justify-between mb-md">
                <h3 className="font-display font-headline-md flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">description</span>
                  Role Summary
                </h3>
                {app.processingStatusLabel && (
                  <span className="text-label-md text-secondary">{app.processingStatusLabel}</span>
                )}
              </div>
              <div className="font-body-md text-on-surface-variant space-y-md">
                <p>{app.description}</p>
                {app.requirements && (
                  <ul className="list-disc pl-5 space-y-sm">
                    {app.requirements.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          {app.processingLog && (
            <section className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm">
              <div className="flex items-center justify-between mb-lg">
                <h3 className="font-display font-headline-md flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">manage_search</span>
                  Scraping Log
                </h3>
              </div>
              <ProcessingLog
                canRetry={app.processingStatus === "failed"}
                currentStatus={app.processingStatusLabel}
                failureReason={app.processingFailureReason}
                isRetrying={isRetrying}
                items={app.processingLog}
                onRetry={() => void handleRetryProcessing()}
              />
            </section>
          )}

          {app.timeline && (
            <section className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm">
              <div className="flex items-center justify-between mb-lg">
                <h3 className="font-display font-headline-md flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">event_upcoming</span>
                  Interview Timeline
                </h3>
              </div>
              <Timeline
                isAdding={isAddingInterview}
                milestones={app.timeline}
                onAddInterview={handleAddInterview}
              />
            </section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            {app.contacts && (
              <section className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-md">
                  <h3 className="font-display font-headline-md flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">contacts</span>
                    Key Contacts
                  </h3>
                  <button
                    className="text-primary material-symbols-outlined hover:bg-surface-container-high rounded-full p-1 transition-colors cursor-pointer"
                    onClick={() => setIsContactFormOpen((current) => !current)}
                    title="Add contact"
                    type="button"
                  >
                    person_add
                  </button>
                </div>
                {isContactFormOpen && (
                  <form
                    className="mb-md grid grid-cols-1 gap-sm rounded-lg bg-surface-container-low p-sm"
                    onSubmit={(event) => void handleAddContact(event)}
                  >
                    <input
                      className="bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 text-body-md py-1 outline-none"
                      onChange={(event) =>
                        setContactForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Name"
                      required
                      type="text"
                      value={contactForm.name}
                    />
                    <input
                      className="bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 text-body-md py-1 outline-none"
                      onChange={(event) =>
                        setContactForm((current) => ({ ...current, role: event.target.value }))
                      }
                      placeholder="Role"
                      type="text"
                      value={contactForm.role}
                    />
                    <input
                      className="bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 text-body-md py-1 outline-none"
                      onChange={(event) =>
                        setContactForm((current) => ({ ...current, email: event.target.value }))
                      }
                      placeholder="Email"
                      type="email"
                      value={contactForm.email}
                    />
                    <div className="flex gap-2">
                      <button
                        className="flex-1 text-label-md bg-primary text-on-primary rounded py-1 cursor-pointer disabled:opacity-60"
                        disabled={isAddingContact}
                        type="submit"
                      >
                        {isAddingContact ? "Saving..." : "Save"}
                      </button>
                      <button
                        className="px-3 text-label-md bg-surface-variant rounded py-1 cursor-pointer"
                        onClick={() => {
                          setIsContactFormOpen(false);
                          setContactForm({ name: "", role: "", email: "" });
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
                <div className="space-y-md flex-1">
                  {app.contacts.map((contact, i) => (
                    <div key={i} className="flex items-start gap-sm">
                      <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed font-bold">
                        {contact.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-body-md font-bold">{contact.name}</div>
                        <div className="font-label-md text-secondary">{contact.role}</div>
                        {contact.email && (
                          <a
                            className="mt-1 flex min-w-0 items-center gap-1 text-label-sm text-primary hover:underline"
                            href={`mailto:${contact.email}`}
                          >
                            <span className="material-symbols-outlined text-[14px]">mail</span>
                            <span className="truncate">{contact.email}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-md">
                <h3 className="font-display font-headline-md flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">edit_note</span>
                  Interview Notes
                </h3>
                <div className="flex gap-1">
                  <button
                    className="text-secondary hover:text-error material-symbols-outlined text-[20px] transition-colors cursor-pointer"
                    onClick={() => {
                      setInterviewNotes("");
                      void handleSaveInterviewNotes("");
                    }}
                    title="Clear"
                    type="button"
                  >
                    delete
                  </button>
                  <button
                    className="text-primary hover:bg-primary/10 px-2 rounded font-label-md transition-colors cursor-pointer disabled:opacity-60"
                    disabled={isSavingNotes}
                    onClick={() => void handleSaveInterviewNotes()}
                    type="button"
                  >
                    {isSavingNotes ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
              <div className="flex-1 flex flex-col bg-surface-container-low rounded-lg p-sm">
                <div className="flex gap-2 border-b border-outline-variant pb-1 mb-2">
                  <button className="material-symbols-outlined text-[18px] opacity-60 hover:opacity-100 cursor-pointer">
                    format_bold
                  </button>
                  <button className="material-symbols-outlined text-[18px] opacity-60 hover:opacity-100 cursor-pointer">
                    format_italic
                  </button>
                  <button className="material-symbols-outlined text-[18px] opacity-60 hover:opacity-100 cursor-pointer">
                    format_list_bulleted
                  </button>
                </div>
                <textarea
                  className="w-full h-24 p-0 border-none bg-transparent focus:ring-0 text-body-md text-on-surface-variant resize-none custom-scrollbar outline-none"
                  onChange={(event) => setInterviewNotes(event.target.value)}
                  placeholder="Start typing your prep notes..."
                  value={interviewNotes}
                />
              </div>
            </section>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="sticky top-24 space-y-lg">
            {app.aiMatch && (
              <AiMatchCard
                aiMatch={app.aiMatch}
                canCreateCv={app.processingStatus === "review_ready"}
                hasGeneratedDocuments={(app.generatedDocuments?.length ?? 0) > 0}
                isCreatingCv={isGeneratingDocuments}
                onCreateCv={handleGenerateDocuments}
              />
            )}

            <section className="bg-surface-container-high p-lg rounded-xl border border-outline-variant">
              <div className="flex items-center justify-between mb-md">
                <div className="flex items-center gap-md">
                  <div className="w-12 h-12 rounded-lg bg-surface flex items-center justify-center text-primary border border-outline-variant">
                    <span className="material-symbols-outlined">attachment</span>
                  </div>
                  <div>
                    <div className="font-body-md font-bold">Generated documents</div>
                    <div className="font-label-md text-secondary">
                      {app.generatedDocuments?.length
                        ? `${app.generatedDocuments.length} ready for download`
                        : "No generated files yet"}
                    </div>
                  </div>
                </div>
              </div>

              {app.generatedDocuments && app.generatedDocuments.length > 0 ? (
                <div className="space-y-2">
                  {app.generatedDocuments.map((document) => (
                    <div
                      key={document.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="font-body-md font-bold truncate">{document.name}</div>
                        <div className="font-label-md text-secondary">
                          {document.kind === "cv" ? "CV" : "Cover letter"} •{" "}
                          {document.format.toUpperCase()} • {document.createdAt}
                        </div>
                      </div>
                      <button
                        className="inline-flex items-center gap-2 rounded-lg bg-primary text-on-primary px-3 py-2 text-label-md font-bold cursor-pointer disabled:opacity-60"
                        disabled={downloadingDocumentId === document.id}
                        onClick={() => void handleDownloadDocument(document.id)}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {downloadingDocumentId === document.id ? "progress_activity" : "download"}
                        </span>
                        {downloadingDocumentId === document.id ? "Opening..." : "Download"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-outline-variant bg-surface px-4 py-6 text-body-md text-secondary">
                  Create the CV from the AI Match wizard to generate downloadable files.
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
