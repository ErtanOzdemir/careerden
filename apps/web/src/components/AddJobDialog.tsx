import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Check,
  ChevronDown,
  ClipboardPaste,
  ExternalLink,
  FileText,
  Monitor,
  Sparkles,
  Upload,
} from "lucide-react";
import { jobApplicationsApi } from "../api/jobApplications.js";
import { profilesApi } from "../api/profiles.js";
import {
  manualPastePrefillFromUrl,
  type ManualPastePrefill,
  type OpenAddJobRequest,
} from "../lib/linkedin-import-fallback.js";
import { Modal } from "./careerden/modal.js";
import { Button, buttonVariants } from "./ui/button.js";

const acceptedLogoTypes = ["image/jpeg", "image/png", "image/webp"];
const maximumLogoSize = 5 * 1024 * 1024;
type AddMethod = "manual" | "linkedin";

interface ManualFormState {
  companyDescription: string;
  companyName: string;
  companyWebsiteUrl: string;
  jobDescription: string;
  jobLocation: string;
  jobUrl: string;
  roleTitle: string;
}

const emptyManualForm: ManualFormState = {
  companyDescription: "",
  companyName: "",
  companyWebsiteUrl: "",
  jobDescription: "",
  jobLocation: "",
  jobUrl: "",
  roleTitle: "",
};

export function AddJobDialog({
  linkedInImportEnabled = true,
  open,
  onClose,
  request,
}: {
  // When false, the LinkedIn tab routes to the manual paste flow instead of importing. A feature
  // flag for LinkedIn import only has to set this.
  linkedInImportEnabled?: boolean;
  open: boolean;
  onClose: () => void;
  // Opens the dialog on a prefilled form, for example after a failed LinkedIn import.
  request?: OpenAddJobRequest;
}) {
  const navigate = useNavigate();
  const [method, setMethod] = useState<AddMethod>("manual");
  const [url, setUrl] = useState("");
  const [manual, setManual] = useState(emptyManualForm);
  const [companyLogo, setCompanyLogo] = useState<File>();
  const [logoPreview, setLogoPreview] = useState<string>();
  const [language, setLanguage] = useState("auto");
  const [tone, setTone] = useState<"concise" | "creative" | "professional">("professional");
  const [savingMethod, setSavingMethod] = useState<AddMethod | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The LinkedIn posting the pasted details come from, when LinkedIn import could not be used.
  const [pasteSourceUrl, setPasteSourceUrl] = useState<string>();
  const isElectron = Boolean(window.electronAPI);
  const completedFields = completedRequiredFields(manual);

  useEffect(() => {
    if (!companyLogo) {
      setLogoPreview(undefined);
      return;
    }
    const preview = URL.createObjectURL(companyLogo);
    setLogoPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [companyLogo]);

  useEffect(() => {
    if (open && request) {
      openPasteForm(request.prefill, true);
    }
  }, [open, request]);

  function openPasteForm(prefill: ManualPastePrefill, replaceForm = false) {
    setMethod("manual");
    setError(null);
    setPasteSourceUrl(prefill.jobUrl);
    setManual((current) => {
      const base = replaceForm ? emptyManualForm : current;
      return {
        ...base,
        jobUrl: prefill.jobUrl,
        companyName: base.companyName || (prefill.companyName ?? ""),
        roleTitle: base.roleTitle || (prefill.roleTitle ?? ""),
      };
    });
  }

  function switchToPaste() {
    if (url.trim()) {
      openPasteForm(manualPastePrefillFromUrl(url));
    } else {
      setMethod("manual");
      setError(null);
    }
  }

  function reset() {
    setMethod("manual");
    setPasteSourceUrl(undefined);
    setUrl("");
    setManual(emptyManualForm);
    setCompanyLogo(undefined);
    setError(null);
    setLanguage("auto");
    setTone("professional");
    setSavingMethod(null);
  }

  function close() {
    reset();
    onClose();
  }

  function finish(applicationId: string) {
    close();
    navigate(`/applications/${applicationId}`);
  }

  async function submitLinkedIn() {
    if (!isElectron || !url.trim()) return;
    try {
      setSavingMethod("linkedin");
      setError(null);
      const profile = await profilesApi.me();
      const application = await jobApplicationsApi.create({
        profileId: profile.id,
        sourceUrl: url.trim(),
        applicationPackPreferences: { language, tone },
      });
      void window.electronAPI?.notifyJobApplicationQueued();
      finish(application.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to add LinkedIn job.");
    } finally {
      setSavingMethod(null);
    }
  }

  async function submitManual() {
    if (!isManualFormComplete(manual)) return;
    try {
      setSavingMethod("manual");
      setError(null);
      const profile = await profilesApi.me();
      const application = await jobApplicationsApi.createManual({
        profileId: profile.id,
        companyName: manual.companyName.trim(),
        roleTitle: manual.roleTitle.trim(),
        jobDescription: manual.jobDescription.trim(),
        ...optionalText("companyDescription", manual.companyDescription),
        ...optionalText("companyWebsiteUrl", manual.companyWebsiteUrl),
        ...optionalText("jobLocation", manual.jobLocation),
        ...optionalText("jobUrl", manual.jobUrl),
        ...(companyLogo ? { companyLogo } : {}),
        applicationPackPreferences: { language, tone },
      });
      finish(application.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to add manual application.");
    } finally {
      setSavingMethod(null);
    }
  }

  function updateLogo(file?: File) {
    if (!file) {
      setCompanyLogo(undefined);
    } else if (!acceptedLogoTypes.includes(file.type)) {
      setError("Company logo must be a PNG, JPEG, or WebP image.");
    } else if (file.size > maximumLogoSize) {
      setError("Company logo must not exceed 5 MB.");
    } else {
      setError(null);
      setCompanyLogo(file);
    }
  }

  const updateManual = (field: keyof ManualFormState, value: string) =>
    setManual((current) => ({ ...current, [field]: value }));

  return (
    <Modal
      open={open}
      onClose={close}
      className="flex h-[min(52rem,calc(100vh-2rem))] max-w-3xl flex-col overflow-hidden p-0 shadow-xl"
    >
      <header className="shrink-0 border-b border-border bg-muted/25 px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
        <div className="pr-10">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Add job application
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose how you want to bring the job into Careerden.
          </p>
        </div>
        <div
          className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-border bg-background p-1"
          aria-label="Job entry method"
        >
          <MethodButton
            active={method === "manual"}
            icon={<ClipboardPaste />}
            label="Manual entry"
            description="Paste the job details"
            onClick={() => {
              setMethod("manual");
              setError(null);
            }}
          />
          <MethodButton
            active={method === "linkedin"}
            badge={!isElectron ? "Desktop" : undefined}
            icon={<LinkedInIcon />}
            label="LinkedIn"
            description="Import automatically"
            onClick={() => {
              setMethod("linkedin");
              setError(null);
            }}
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && (
          <div
            role="alert"
            className="mx-5 mt-5 rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-sm text-destructive sm:mx-6"
          >
            {error}
            {method === "linkedin" && url.trim() && (
              <Button className="mt-2.5 flex" variant="outline" size="sm" onClick={switchToPaste}>
                <ClipboardPaste className="size-3.5" />
                Paste the description instead
              </Button>
            )}
          </div>
        )}
        {method === "manual" ? (
          <ManualEntry
            companyLogo={companyLogo}
            completedFields={completedFields}
            logoPreview={logoPreview}
            manual={manual}
            onLogoChange={updateLogo}
            onManualChange={updateManual}
            pasteSourceUrl={pasteSourceUrl}
            saving={savingMethod !== null}
          />
        ) : (
          <LinkedInEntry
            disabled={!isElectron || savingMethod !== null}
            importEnabled={linkedInImportEnabled}
            isElectron={isElectron}
            onUrlChange={setUrl}
            url={url}
          />
        )}
        <OutputPreferences
          language={language}
          onLanguageChange={setLanguage}
          onToneChange={setTone}
          tone={tone}
        />
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-background px-5 py-4 sm:px-6">
        <p className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          {method === "manual" ? (
            <>
              {completedFields === 3 && <Check className="size-3.5 text-success" />}
              {completedFields} of 3 required fields complete
            </>
          ) : (
            <>
              <Sparkles className="size-3.5" />
              Role and company details are extracted for you
            </>
          )}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" onClick={close} disabled={savingMethod !== null}>
            Cancel
          </Button>
          {method === "linkedin" && !linkedInImportEnabled ? (
            <Button size="lg" onClick={switchToPaste} disabled={savingMethod !== null}>
              <ClipboardPaste className="size-3.5" />
              Paste the description instead
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() => void (method === "manual" ? submitManual() : submitLinkedIn())}
              disabled={
                savingMethod !== null ||
                (method === "manual" ? !isManualFormComplete(manual) : !isElectron || !url.trim())
              }
            >
              {savingMethod
                ? method === "manual"
                  ? "Adding application..."
                  : "Importing..."
                : method === "manual"
                  ? "Add application"
                  : "Import from LinkedIn"}
            </Button>
          )}
        </div>
      </footer>
    </Modal>
  );
}

function MethodButton({
  active,
  badge,
  description,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  badge?: string;
  description: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-w-0 items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-center outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring/50 ${
        active
          ? "bg-foreground text-background shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-md [&_svg]:size-4 ${
          active ? "bg-background/15" : "bg-muted"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="flex items-center justify-center gap-2 text-sm font-medium">
          {label}
          {badge && (
            <span className="rounded bg-background/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              {badge}
            </span>
          )}
        </span>
        <span className={`hidden text-xs sm:block ${active ? "text-background/65" : ""}`}>
          {description}
        </span>
      </span>
    </button>
  );
}

function ManualEntry({
  companyLogo,
  completedFields,
  logoPreview,
  manual,
  onLogoChange,
  onManualChange,
  pasteSourceUrl,
  saving,
}: {
  companyLogo?: File;
  completedFields: number;
  logoPreview?: string;
  manual: ManualFormState;
  onLogoChange: (file?: File) => void;
  onManualChange: (field: keyof ManualFormState, value: string) => void;
  pasteSourceUrl?: string;
  saving: boolean;
}) {
  return (
    <div className="px-5 py-5 sm:px-6 sm:py-6">
      {pasteSourceUrl && <PasteFromLinkedInHint sourceUrl={pasteSourceUrl} />}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Paste the job details</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Start with the essentials. You can enrich the company profile if you want.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {completedFields}/3 required
        </span>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <TextField
          id="manual-company-name"
          label="Company name"
          maxLength={200}
          onChange={(value) => onManualChange("companyName", value)}
          placeholder="e.g. Acme"
          required
          value={manual.companyName}
        />
        <TextField
          id="manual-role-title"
          label="Job title"
          maxLength={200}
          onChange={(value) => onManualChange("roleTitle", value)}
          placeholder="e.g. Product Designer"
          required
          value={manual.roleTitle}
        />
      </div>
      <TextAreaField
        id="manual-job-description"
        label="Job description"
        maxLength={250_000}
        onChange={(value) => onManualChange("jobDescription", value)}
        placeholder="Paste the full job description here. Careerden will identify the skills and requirements."
        required
        rows={9}
        value={manual.jobDescription}
      />
      <div className="-mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Sparkles className="size-3.5" />
          Requirements will be extracted automatically
        </span>
        <span>{manual.jobDescription.length.toLocaleString()} characters</span>
      </div>
      <OptionalCompanyDetails
        companyLogo={companyLogo}
        logoPreview={logoPreview}
        manual={manual}
        onLogoChange={onLogoChange}
        onManualChange={onManualChange}
        saving={saving}
      />
    </div>
  );
}

function PasteFromLinkedInHint({ sourceUrl }: { sourceUrl: string }) {
  return (
    <div
      role="note"
      className="mb-5 flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3.5"
    >
      <LinkedInIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          Open the posting on LinkedIn, copy the description, paste it here.
        </p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <span className="shrink-0">Source link kept:</span>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={sourceUrl}
            className="inline-flex min-w-0 items-center gap-1 font-medium text-primary hover:underline"
          >
            <span className="truncate">{sourceUrl}</span>
            <ExternalLink className="size-3 shrink-0" />
          </a>
        </p>
      </div>
    </div>
  );
}

function OptionalCompanyDetails({
  companyLogo,
  logoPreview,
  manual,
  onLogoChange,
  onManualChange,
  saving,
}: {
  companyLogo?: File;
  logoPreview?: string;
  manual: ManualFormState;
  onLogoChange: (file?: File) => void;
  onManualChange: (field: keyof ManualFormState, value: string) => void;
  saving: boolean;
}) {
  return (
    <details className="group mt-5 rounded-xl border border-border bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-foreground marker:hidden">
        <span className="flex items-center gap-2.5">
          <Building2 className="size-4 text-muted-foreground" />
          Add company details
          <span className="text-xs font-normal text-muted-foreground">Optional</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border px-4 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="manual-location"
            label="Location"
            maxLength={200}
            onChange={(value) => onManualChange("jobLocation", value)}
            placeholder="Istanbul, Remote..."
            value={manual.jobLocation}
          />
          <TextField
            id="manual-company-website"
            label="Company website"
            onChange={(value) => onManualChange("companyWebsiteUrl", value)}
            placeholder="https://example.com"
            type="url"
            value={manual.companyWebsiteUrl}
          />
        </div>
        <TextAreaField
          id="manual-company-description"
          label="Company description"
          maxLength={50_000}
          onChange={(value) => onManualChange("companyDescription", value)}
          placeholder="What does the company do?"
          rows={3}
          value={manual.companyDescription}
        />
        <div className="mt-4">
          <TextField
            id="manual-job-url"
            label="Original posting or application URL"
            onChange={(value) => onManualChange("jobUrl", value)}
            placeholder="https://..."
            type="url"
            value={manual.jobUrl}
          />
        </div>
        <LogoPicker
          companyLogo={companyLogo}
          logoPreview={logoPreview}
          onLogoChange={onLogoChange}
          saving={saving}
        />
      </div>
    </details>
  );
}

function LogoPicker({
  companyLogo,
  logoPreview,
  onLogoChange,
  saving,
}: {
  companyLogo?: File;
  logoPreview?: string;
  onLogoChange: (file?: File) => void;
  saving: boolean;
}) {
  return (
    <div className="mt-4">
      <span className="text-sm font-medium text-foreground">Company logo</span>
      <div className="mt-2 flex items-center gap-3 rounded-lg border border-dashed border-border bg-background p-3">
        {logoPreview ? (
          <img
            src={logoPreview}
            alt="Company logo preview"
            className="size-12 rounded-lg border border-border bg-background object-contain"
          />
        ) : (
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Building2 className="size-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {companyLogo?.name ?? "Upload a company logo"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">PNG, JPEG, or WebP · Max 5 MB</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <label className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Upload className="size-3.5" />
            {companyLogo ? "Replace" : "Choose"}
            <input
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => onLogoChange(event.target.files?.[0])}
              disabled={saving}
            />
          </label>
          {companyLogo && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onLogoChange()}>
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function LinkedInEntry({
  disabled,
  importEnabled,
  isElectron,
  onUrlChange,
  url,
}: {
  disabled: boolean;
  importEnabled: boolean;
  isElectron: boolean;
  onUrlChange: (value: string) => void;
  url: string;
}) {
  return (
    <div className="px-5 py-8 sm:px-10 sm:py-10">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted text-foreground">
          <LinkedInIcon className="size-5" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-foreground">Import from LinkedIn</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Paste a job link and Careerden will collect the role, company, description, and
          requirements.
        </p>
      </div>

      {!importEnabled && (
        <div
          role="note"
          className="mx-auto mt-5 flex max-w-xl items-start gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3.5"
        >
          <ClipboardPaste className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">LinkedIn import is turned off</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Add the link and paste the job description instead. Careerden keeps the link with the
              application.
            </p>
          </div>
        </div>
      )}

      {importEnabled && !isElectron && (
        <div className="mx-auto mt-5 flex max-w-xl items-start gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3.5">
          <Monitor className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Continue in the desktop app</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              LinkedIn import runs securely in Careerden Desktop. Manual entry remains available in
              your browser.
            </p>
          </div>
        </div>
      )}

      <label htmlFor="job-url" className="mx-auto mt-5 block max-w-xl text-sm font-medium">
        LinkedIn job URL
        <div className="relative mt-1.5">
          <LinkedInIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="job-url"
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            disabled={importEnabled && disabled}
            placeholder="https://www.linkedin.com/jobs/view/..."
            className="h-11 w-full rounded-lg border border-input bg-background pr-3 pl-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-70"
          />
        </div>
      </label>

      <div className="mx-auto mt-5 grid max-w-xl gap-2 sm:grid-cols-3">
        {["Paste the link", "We extract details", "Review your match"].map((text, index) => (
          <div
            key={text}
            className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-background font-medium text-foreground shadow-xs">
              {index + 1}
            </span>
            {text}
          </div>
        ))}
      </div>
    </div>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04s-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12Zm1.78 13.02H3.56V9h3.56v11.45Z" />
    </svg>
  );
}

function OutputPreferences({
  language,
  onLanguageChange,
  onToneChange,
  tone,
}: {
  language: string;
  onLanguageChange: (value: string) => void;
  onToneChange: (value: "concise" | "creative" | "professional") => void;
  tone: "concise" | "creative" | "professional";
}) {
  return (
    <details className="group mx-5 mb-5 rounded-xl border border-border sm:mx-6 sm:mb-6">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-foreground marker:hidden">
        <span className="flex items-center gap-2.5">
          <FileText className="size-4 text-muted-foreground" />
          Application document preferences
          <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
            {language === "auto" ? "Auto language" : language.toUpperCase()} ·{" "}
            {tone[0]?.toUpperCase()}
            {tone.slice(1)} tone
          </span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-3 border-t border-border px-4 py-4 sm:grid-cols-2">
        <label className="text-xs font-medium text-muted-foreground">
          Language
          <select
            aria-label="Application pack language"
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            onChange={(event) => onLanguageChange(event.target.value)}
            value={language}
          >
            <option value="auto">Auto-detect</option>
            <option value="en">English</option>
            <option value="tr">Turkish</option>
            <option value="de">German</option>
            <option value="fr">French</option>
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Tone
          <select
            aria-label="Application pack tone"
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            onChange={(event) => onToneChange(event.target.value as typeof tone)}
            value={tone}
          >
            <option value="professional">Professional</option>
            <option value="concise">Concise</option>
            <option value="creative">Creative</option>
          </select>
        </label>
      </div>
    </details>
  );
}

function TextField({
  id,
  label,
  maxLength,
  onChange,
  placeholder,
  required = false,
  type = "text",
  value,
}: {
  id: string;
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "url";
  value: string;
}) {
  return (
    <label htmlFor={id} className="text-sm font-medium text-foreground">
      {label}
      {required && <span className="ml-1 text-xs font-normal text-muted-foreground">Required</span>}
      <input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"
      />
    </label>
  );
}

function TextAreaField(props: {
  id: string;
  label: string;
  maxLength: number;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  rows: number;
  value: string;
}) {
  const { id, label, maxLength, onChange, placeholder, required = false, rows, value } = props;
  return (
    <label htmlFor={id} className="mt-4 block text-sm font-medium text-foreground">
      {label}
      {required && <span className="ml-1 text-xs font-normal text-muted-foreground">Required</span>}
      <textarea
        id={id}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        rows={rows}
        className="mt-1.5 w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"
      />
    </label>
  );
}

function completedRequiredFields(form: ManualFormState): number {
  return [form.companyName, form.roleTitle, form.jobDescription].filter((value) =>
    Boolean(value.trim()),
  ).length;
}

function isManualFormComplete(form: ManualFormState): boolean {
  return completedRequiredFields(form) === 3;
}

function optionalText<Key extends string>(key: Key, value: string): Partial<Record<Key, string>> {
  const trimmed = value.trim();
  return trimmed ? ({ [key]: trimmed } as Record<Key, string>) : {};
}
