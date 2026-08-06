import { useEffect, useState } from "react";
import { Button } from "../components/ui/button.js";
import { Panel } from "../components/careerden/panel.js";
import { Field } from "../components/careerden/field.js";
import RichTextEditor, { RichTextViewer } from "../components/RichTextEditor.js";
import { profilesApi } from "../api/profiles.js";
import { emptyRichDocument, richDocumentFromText } from "@careerden/contracts";
import type {
  ApiProfile,
  ApiUpdateProfilePayload,
  ApiProfileExperience,
  ApiProfileEducation,
  ApiProfileProject,
  RichDocument,
} from "../api/types.js";
import {
  UserRound,
  FileText,
  Briefcase,
  GraduationCap,
  Award,
  FolderGit2,
  Plus,
  Check,
  Trash2,
  Pencil,
  Save,
  X,
} from "lucide-react";

const sections = [
  { id: "basics", label: "Basic information", icon: UserRound },
  { id: "summary", label: "Professional summary", icon: FileText },
  { id: "skills", label: "Skills", icon: Award },
  { id: "experience", label: "Experience", icon: Briefcase },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "projects", label: "Projects & certifications", icon: FolderGit2 },
] as const;

type SectionId = (typeof sections)[number]["id"];

function emptyExperience(): ApiProfileExperience {
  return {
    title: "",
    company: "",
    startDate: "",
    endDate: "",
    description: "",
  };
}

function emptyEducation(): ApiProfileEducation {
  return { institution: "", degree: "", field: "", startDate: "", endDate: "" };
}

function emptyProject(): ApiProfileProject {
  return { name: "", description: "", url: "", skills: [], achievements: [] };
}

export default function ProfileManager() {
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>("basics");
  const [isEditingBasics, setIsEditingBasics] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [isEditingCertifications, setIsEditingCertifications] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [profession, setProfession] = useState("");
  const [location, setLocation] = useState("");
  const [headline, setHeadline] = useState("");
  const [summaryRichText, setSummaryRichText] = useState(emptyRichDocument);
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [experience, setExperience] = useState<ApiProfileExperience[]>([]);
  const [education, setEducation] = useState<ApiProfileEducation[]>([]);
  const [projects, setProjects] = useState<ApiProfileProject[]>([]);
  const [certifications, setCertifications] = useState<string[]>([]);
  const [newCert, setNewCert] = useState("");

  useEffect(() => {
    let isMounted = true;
    profilesApi
      .me()
      .then((p) => {
        if (isMounted) {
          setProfile(p);
          setFullName(p.fullName ?? "");
          setEmail(p.email ?? "");
          setProfession(p.profession ?? "");
          setLocation(p.location ?? "");
          setHeadline(p.headline ?? "");
          setSummaryRichText(p.summaryRichText ?? richDocumentFromText(p.summary ?? ""));
          setSkills(p.skills ?? []);
          setExperience(p.experience ?? []);
          setEducation(p.education ?? []);
          setProjects(p.projects ?? []);
          setCertifications(p.certifications ?? []);
        }
      })
      .catch((e) => {
        if (isMounted) setError(e.message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!profile || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const closestVisibleSection = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) =>
              Math.abs(left.boundingClientRect.top - 96) -
              Math.abs(right.boundingClientRect.top - 96),
          )[0]?.target.id as SectionId | undefined;

        if (closestVisibleSection) setActiveSection(closestVisibleSection);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: [0, 0.1, 0.5] },
    );

    for (const section of sections) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, [profile]);

  async function savePartial(payload: ApiUpdateProfilePayload): Promise<ApiProfile | null> {
    if (!profile) return null;
    try {
      setIsSaving(true);
      setError(null);
      setSaved(false);
      const updated = await profilesApi.update(profile.id, payload);
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function saveBasics() {
    const updated = await savePartial({
      fullName: fullName.trim(),
      email: email.trim(),
      profession: profession.trim(),
      location: location.trim(),
      headline: headline.trim(),
    });
    if (updated) setIsEditingBasics(false);
  }

  function cancelBasics() {
    if (!profile) return;
    setFullName(profile.fullName ?? "");
    setEmail(profile.email ?? "");
    setProfession(profile.profession ?? "");
    setLocation(profile.location ?? "");
    setHeadline(profile.headline ?? "");
    setIsEditingBasics(false);
  }

  function addSkill() {
    const s = newSkill.trim();
    if (s && !skills.includes(s)) {
      setSkills((prev) => [...prev, s]);
      setNewSkill("");
    }
  }

  function removeSkill(skill: string) {
    setSkills((prev) => prev.filter((s) => s !== skill));
  }

  function addCert() {
    const c = newCert.trim();
    if (c && !certifications.includes(c)) {
      setCertifications((prev) => [...prev, c]);
      setNewCert("");
    }
  }

  function removeCert(cert: string) {
    setCertifications((prev) => prev.filter((c) => c !== cert));
  }

  if (isLoading) return <div className="py-16 text-center text-muted-foreground">Loading...</div>;
  if (!profile)
    return <div className="py-16 text-center text-destructive">{error ?? "Not found"}</div>;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]">
      <nav className="hidden lg:block">
        <div className="sticky top-24 space-y-1">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={activeSection === s.id ? "location" : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted hover:text-foreground ${
                activeSection === s.id ? "bg-muted text-foreground" : "text-muted-foreground"
              }`}
            >
              <s.icon className="size-4" />
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="space-y-6">
        <Panel className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-accent text-xl font-semibold text-accent-foreground">
            {getInitials(fullName)}
          </div>
          <div className="flex-1">
            <p className="text-base font-semibold text-foreground">{fullName || "Your name"}</p>
            <p className="text-sm text-muted-foreground">
              {[profession, location].filter(Boolean).join(" · ") || "Add your details"}
            </p>
            {saved && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
                <Check className="size-3.5" />
                Profile saved
              </p>
            )}
          </div>
        </Panel>

        {error && (
          <div className="rounded-xl border border-destructive/20 bg-danger-soft p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <section
          id="basics"
          className="scroll-mt-24"
          onFocusCapture={() => setActiveSection("basics")}
          onMouseEnter={() => setActiveSection("basics")}
        >
          <Panel className="p-6">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle icon={UserRound} title="Basic information" />
              <SectionEditActions
                editing={isEditingBasics}
                isSaving={isSaving}
                label="basic information"
                onCancel={cancelBasics}
                onEdit={() => setIsEditingBasics(true)}
                onSave={() => void saveBasics()}
              />
            </div>
            {isEditingBasics ? (
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <Field
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Field
                  label="Profession"
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                />
                <Field
                  label="Location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <Field
                  label="Headline"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="sm:col-span-2"
                />
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <ProfileValue label="Full name" value={fullName} />
                <ProfileValue label="Email" value={email} />
                <ProfileValue label="Profession" value={profession} />
                <ProfileValue label="Location" value={location} />
                <ProfileValue className="sm:col-span-2" label="Headline" value={headline} />
              </div>
            )}
          </Panel>
        </section>

        <section
          id="summary"
          className="scroll-mt-24"
          onFocusCapture={() => setActiveSection("summary")}
          onMouseEnter={() => setActiveSection("summary")}
        >
          <Panel className="p-6">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle icon={FileText} title="Professional summary" />
              <SectionEditActions
                editing={isEditingSummary}
                isSaving={isSaving}
                label="professional summary"
                onCancel={() => {
                  setSummaryRichText(
                    profile.summaryRichText ?? richDocumentFromText(profile.summary ?? ""),
                  );
                  setIsEditingSummary(false);
                }}
                onEdit={() => setIsEditingSummary(true)}
                onSave={() => {
                  void savePartial({ summaryRichText }).then((updated) => {
                    if (updated) {
                      setSummaryRichText(
                        updated.summaryRichText ?? richDocumentFromText(updated.summary ?? ""),
                      );
                      setIsEditingSummary(false);
                    }
                  });
                }}
              />
            </div>
            <div className="mt-5">
              {isEditingSummary ? (
                <RichTextField
                  label="Summary"
                  value={summaryRichText}
                  onChange={setSummaryRichText}
                />
              ) : profile.summary ? (
                <RichTextViewer ariaLabel="Professional summary" value={summaryRichText} />
              ) : (
                <p className="text-sm text-muted-foreground">No professional summary added yet.</p>
              )}
            </div>
          </Panel>
        </section>

        <section
          id="skills"
          className="scroll-mt-24"
          onFocusCapture={() => setActiveSection("skills")}
          onMouseEnter={() => setActiveSection("skills")}
        >
          <Panel className="p-6">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle icon={Award} title="Skills" />
              <SectionEditActions
                editing={isEditingSkills}
                isSaving={isSaving}
                label="skills"
                onCancel={() => {
                  setSkills(profile.skills);
                  setNewSkill("");
                  setIsEditingSkills(false);
                }}
                onEdit={() => setIsEditingSkills(true)}
                onSave={() => {
                  void savePartial({ skills: skills.filter(Boolean) }).then((updated) => {
                    if (updated) {
                      setSkills(updated.skills);
                      setNewSkill("");
                      setIsEditingSkills(false);
                    }
                  });
                }}
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {skills.map((skill) =>
                isEditingSkills ? (
                  <button
                    key={skill}
                    onClick={() => removeSkill(skill)}
                    className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
                    type="button"
                  >
                    {skill} <X className="inline size-3" />
                  </button>
                ) : (
                  <span
                    key={skill}
                    className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
                  >
                    {skill}
                  </span>
                ),
              )}
              {isEditingSkills && (
                <div className="flex items-center gap-1">
                  <input
                    aria-label="New skill"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSkill()}
                    placeholder="Add skill"
                    className="w-24 rounded-full border border-dashed border-border bg-transparent px-3 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                  />
                  <button
                    onClick={addSkill}
                    className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    type="button"
                  >
                    <Plus className="size-3" />
                    Add
                  </button>
                </div>
              )}
              {!isEditingSkills && skills.length === 0 && (
                <p className="text-sm text-muted-foreground">No skills added yet.</p>
              )}
            </div>
          </Panel>
        </section>

        <section
          id="experience"
          className="scroll-mt-24"
          onFocusCapture={() => setActiveSection("experience")}
          onMouseEnter={() => setActiveSection("experience")}
        >
          <Panel className="p-6">
            <div className="flex items-center justify-between">
              <SectionTitle icon={Briefcase} title="Experience" />
              <Button
                size="xs"
                onClick={() => setExperience((prev) => [...prev, emptyExperience()])}
              >
                <Plus className="size-3.5" /> Add
              </Button>
            </div>
            <div className="mt-5 space-y-4">
              {experience.length > 0 ? (
                experience.map((exp, i) => (
                  <ExperienceEditor
                    key={i}
                    experience={exp}
                    isSaving={isSaving}
                    onChange={(updated) =>
                      setExperience((prev) => prev.map((e, idx) => (idx === i ? updated : e)))
                    }
                    onCancel={() => {
                      const persisted = profile.experience[i];
                      setExperience((prev) =>
                        persisted
                          ? prev.map((item, idx) => (idx === i ? persisted : item))
                          : prev.filter((_, idx) => idx !== i),
                      );
                    }}
                    onSave={async () => {
                      const updated = await savePartial({ experience });
                      if (updated) setExperience(updated.experience);
                      return Boolean(updated);
                    }}
                    onRemove={() => {
                      const next = experience.filter((_, idx) => idx !== i);
                      void savePartial({ experience: next }).then((updated) => {
                        if (updated) setExperience(updated.experience);
                      });
                    }}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No experience added yet.</p>
              )}
            </div>
          </Panel>
        </section>

        <section
          id="education"
          className="scroll-mt-24"
          onFocusCapture={() => setActiveSection("education")}
          onMouseEnter={() => setActiveSection("education")}
        >
          <Panel className="p-6">
            <div className="flex items-center justify-between">
              <SectionTitle icon={GraduationCap} title="Education" />
              <Button size="xs" onClick={() => setEducation((prev) => [...prev, emptyEducation()])}>
                <Plus className="size-3.5" /> Add
              </Button>
            </div>
            <div className="mt-5 space-y-4">
              {education.length > 0 ? (
                education.map((edu, i) => (
                  <EducationEditor
                    key={i}
                    education={edu}
                    isSaving={isSaving}
                    onChange={(updated) =>
                      setEducation((prev) => prev.map((e, idx) => (idx === i ? updated : e)))
                    }
                    onCancel={() => {
                      const persisted = profile.education[i];
                      setEducation((prev) =>
                        persisted
                          ? prev.map((item, idx) => (idx === i ? persisted : item))
                          : prev.filter((_, idx) => idx !== i),
                      );
                    }}
                    onSave={async () => {
                      const updated = await savePartial({ education });
                      if (updated) setEducation(updated.education);
                      return Boolean(updated);
                    }}
                    onRemove={() => {
                      const next = education.filter((_, idx) => idx !== i);
                      void savePartial({ education: next }).then((updated) => {
                        if (updated) setEducation(updated.education);
                      });
                    }}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No education added yet.</p>
              )}
            </div>
          </Panel>
        </section>

        <section
          id="projects"
          className="scroll-mt-24"
          onFocusCapture={() => setActiveSection("projects")}
          onMouseEnter={() => setActiveSection("projects")}
        >
          <Panel className="p-6">
            <div className="flex items-center justify-between">
              <SectionTitle icon={FolderGit2} title="Projects & certifications" />
            </div>

            <div className="mt-5 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Projects</h3>
                  <Button
                    size="xs"
                    onClick={() => setProjects((prev) => [...prev, emptyProject()])}
                  >
                    <Plus className="size-3.5" /> Add project
                  </Button>
                </div>
                <div className="space-y-4">
                  {projects.length > 0 ? (
                    projects.map((proj, i) => (
                      <ProjectEditor
                        key={i}
                        project={proj}
                        isSaving={isSaving}
                        onChange={(updated) =>
                          setProjects((prev) => prev.map((p, idx) => (idx === i ? updated : p)))
                        }
                        onCancel={() => {
                          const persisted = profile.projects[i];
                          setProjects((prev) =>
                            persisted
                              ? prev.map((item, idx) => (idx === i ? persisted : item))
                              : prev.filter((_, idx) => idx !== i),
                          );
                        }}
                        onSave={async () => {
                          const updated = await savePartial({ projects });
                          if (updated) setProjects(updated.projects);
                          return Boolean(updated);
                        }}
                        onRemove={() => {
                          const next = projects.filter((_, idx) => idx !== i);
                          void savePartial({ projects: next }).then((updated) => {
                            if (updated) setProjects(updated.projects);
                          });
                        }}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No projects added yet.</p>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">Certifications</h3>
                  <SectionEditActions
                    editing={isEditingCertifications}
                    isSaving={isSaving}
                    label="certifications"
                    onCancel={() => {
                      setCertifications(profile.certifications);
                      setNewCert("");
                      setIsEditingCertifications(false);
                    }}
                    onEdit={() => setIsEditingCertifications(true)}
                    onSave={() => {
                      void savePartial({
                        certifications: certifications.filter(Boolean),
                      }).then((updated) => {
                        if (updated) {
                          setCertifications(updated.certifications);
                          setNewCert("");
                          setIsEditingCertifications(false);
                        }
                      });
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {certifications.map((cert) =>
                    isEditingCertifications ? (
                      <button
                        key={cert}
                        onClick={() => removeCert(cert)}
                        className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
                        type="button"
                      >
                        {cert} <X className="inline size-3" />
                      </button>
                    ) : (
                      <span
                        key={cert}
                        className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
                      >
                        {cert}
                      </span>
                    ),
                  )}
                  {isEditingCertifications && (
                    <div className="flex items-center gap-1">
                      <input
                        aria-label="New certification"
                        value={newCert}
                        onChange={(e) => setNewCert(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addCert()}
                        placeholder="Add certification"
                        className="w-36 rounded-full border border-dashed border-border bg-transparent px-3 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                      />
                      <button
                        onClick={addCert}
                        className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        type="button"
                      >
                        <Plus className="size-3" />
                        Add
                      </button>
                    </div>
                  )}
                  {!isEditingCertifications && certifications.length === 0 && (
                    <p className="text-sm text-muted-foreground">No certifications added yet.</p>
                  )}
                </div>
              </div>
            </div>
          </Panel>
        </section>
      </div>
    </div>
  );
}

function ExperienceEditor({
  experience,
  isSaving,
  onCancel,
  onChange,
  onRemove,
  onSave,
}: {
  experience: ApiProfileExperience;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (e: ApiProfileExperience) => void;
  onRemove: () => void;
  onSave: () => Promise<boolean>;
}) {
  const [isEditing, setIsEditing] = useState(!experience.title);

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-3">
              <Field
                label="Title"
                value={experience.title}
                onChange={(e) => onChange({ ...experience, title: e.target.value })}
              />
              <Field
                label="Company"
                value={experience.company}
                onChange={(e) => onChange({ ...experience, company: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Start date"
                  value={experience.startDate ?? ""}
                  onChange={(e) =>
                    onChange({ ...experience, startDate: e.target.value || undefined })
                  }
                  placeholder="2020-01"
                />
                <Field
                  label="End date"
                  value={experience.endDate ?? ""}
                  onChange={(e) =>
                    onChange({ ...experience, endDate: e.target.value || undefined })
                  }
                  placeholder="Present"
                />
              </div>
              <RichTextField
                label="Description"
                value={
                  experience.descriptionRichText ??
                  richDocumentFromText(experience.description ?? "")
                }
                onChange={(descriptionRichText) => onChange({ ...experience, descriptionRichText })}
              />
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-foreground">{experience.title}</p>
              <p className="text-xs text-muted-foreground">{experience.company}</p>
              <span className="text-xs text-muted-foreground">
                {[experience.startDate, experience.endDate].filter(Boolean).join(" — ") ||
                  "Dates not set"}
              </span>
              {(experience.descriptionRichText || experience.description) && (
                <div className="mt-1">
                  <RichTextViewer
                    ariaLabel={`${experience.title} description`}
                    value={
                      experience.descriptionRichText ??
                      richDocumentFromText(experience.description ?? "")
                    }
                  />
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isEditing ? (
            <>
              <button
                aria-label="Cancel experience changes"
                onClick={() => {
                  onCancel();
                  setIsEditing(false);
                }}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                type="button"
              >
                <X className="size-4" />
              </button>
              <button
                aria-label="Delete experience"
                disabled={isSaving}
                onClick={onRemove}
                className="p-1.5 rounded-md hover:bg-danger-soft text-muted-foreground hover:text-destructive disabled:opacity-50"
                type="button"
              >
                <Trash2 className="size-4" />
              </button>
              <button
                aria-label="Save experience"
                disabled={isSaving}
                onClick={() => void onSave().then((didSave) => didSave && setIsEditing(false))}
                className="p-1.5 rounded-md hover:bg-muted text-primary disabled:opacity-50"
                type="button"
              >
                <Save className="size-4" />
              </button>
            </>
          ) : (
            <button
              aria-label="Edit experience"
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
              type="button"
            >
              <Pencil className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EducationEditor({
  education,
  isSaving,
  onCancel,
  onChange,
  onRemove,
  onSave,
}: {
  education: ApiProfileEducation;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (e: ApiProfileEducation) => void;
  onRemove: () => void;
  onSave: () => Promise<boolean>;
}) {
  const [isEditing, setIsEditing] = useState(!education.institution);

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-3">
              <Field
                label="Institution"
                value={education.institution}
                onChange={(e) => onChange({ ...education, institution: e.target.value })}
              />
              <Field
                label="Degree"
                value={education.degree ?? ""}
                onChange={(e) => onChange({ ...education, degree: e.target.value || undefined })}
              />
              <Field
                label="Field of study"
                value={education.field ?? ""}
                onChange={(e) => onChange({ ...education, field: e.target.value || undefined })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Start date"
                  value={education.startDate ?? ""}
                  onChange={(e) =>
                    onChange({ ...education, startDate: e.target.value || undefined })
                  }
                  placeholder="2020-01"
                />
                <Field
                  label="End date"
                  value={education.endDate ?? ""}
                  onChange={(e) => onChange({ ...education, endDate: e.target.value || undefined })}
                  placeholder="Present"
                />
              </div>
              <RichTextField
                label="Description"
                value={
                  education.descriptionRichText ?? richDocumentFromText(education.description ?? "")
                }
                onChange={(descriptionRichText) => onChange({ ...education, descriptionRichText })}
              />
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-foreground">
                {[education.degree, education.field].filter(Boolean).join(", ") || "Education"}
              </p>
              <p className="text-xs text-muted-foreground">{education.institution}</p>
              <span className="text-xs text-muted-foreground">
                {[education.startDate, education.endDate].filter(Boolean).join(" — ") ||
                  "Dates not set"}
              </span>
              {(education.descriptionRichText || education.description) && (
                <div className="mt-1">
                  <RichTextViewer
                    ariaLabel={`${education.institution} description`}
                    value={
                      education.descriptionRichText ??
                      richDocumentFromText(education.description ?? "")
                    }
                  />
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isEditing ? (
            <>
              <button
                aria-label="Cancel education changes"
                onClick={() => {
                  onCancel();
                  setIsEditing(false);
                }}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                type="button"
              >
                <X className="size-4" />
              </button>
              <button
                aria-label="Delete education"
                disabled={isSaving}
                onClick={onRemove}
                className="p-1.5 rounded-md hover:bg-danger-soft text-muted-foreground hover:text-destructive disabled:opacity-50"
                type="button"
              >
                <Trash2 className="size-4" />
              </button>
              <button
                aria-label="Save education"
                disabled={isSaving}
                onClick={() => void onSave().then((didSave) => didSave && setIsEditing(false))}
                className="p-1.5 rounded-md hover:bg-muted text-primary disabled:opacity-50"
                type="button"
              >
                <Save className="size-4" />
              </button>
            </>
          ) : (
            <button
              aria-label="Edit education"
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
              type="button"
            >
              <Pencil className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectEditor({
  project,
  isSaving,
  onCancel,
  onChange,
  onRemove,
  onSave,
}: {
  project: ApiProfileProject;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (p: ApiProfileProject) => void;
  onRemove: () => void;
  onSave: () => Promise<boolean>;
}) {
  const [isEditing, setIsEditing] = useState(!project.name);

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-3">
              <Field
                label="Project name"
                value={project.name}
                onChange={(e) => onChange({ ...project, name: e.target.value })}
              />
              <RichTextField
                label="Description"
                value={
                  project.descriptionRichText ?? richDocumentFromText(project.description ?? "")
                }
                onChange={(descriptionRichText) => onChange({ ...project, descriptionRichText })}
              />
              <Field
                label="URL"
                value={project.url ?? ""}
                onChange={(e) => onChange({ ...project, url: e.target.value || undefined })}
                placeholder="https://"
              />
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-foreground">{project.name}</p>
              {(project.descriptionRichText || project.description) && (
                <div className="mt-1 text-xs">
                  <RichTextViewer
                    ariaLabel={`${project.name} description`}
                    value={
                      project.descriptionRichText ?? richDocumentFromText(project.description ?? "")
                    }
                  />
                </div>
              )}
              {project.url && <p className="mt-1 text-xs text-primary truncate">{project.url}</p>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isEditing ? (
            <>
              <button
                aria-label="Cancel project changes"
                onClick={() => {
                  onCancel();
                  setIsEditing(false);
                }}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                type="button"
              >
                <X className="size-4" />
              </button>
              <button
                aria-label="Delete project"
                disabled={isSaving}
                onClick={onRemove}
                className="p-1.5 rounded-md hover:bg-danger-soft text-muted-foreground hover:text-destructive disabled:opacity-50"
                type="button"
              >
                <Trash2 className="size-4" />
              </button>
              <button
                aria-label="Save project"
                disabled={isSaving}
                onClick={() => void onSave().then((didSave) => didSave && setIsEditing(false))}
                className="p-1.5 rounded-md hover:bg-muted text-primary disabled:opacity-50"
                type="button"
              >
                <Save className="size-4" />
              </button>
            </>
          ) : (
            <button
              aria-label="Edit project"
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
              type="button"
            >
              <Pencil className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof UserRound; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="size-4" />
      </span>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  );
}

function SectionEditActions({
  editing,
  isSaving,
  label,
  onCancel,
  onEdit,
  onSave,
}: {
  editing: boolean;
  isSaving: boolean;
  label: string;
  onCancel: () => void;
  onEdit: () => void;
  onSave: () => void;
}) {
  return editing ? (
    <div className="flex items-center gap-1.5">
      <Button
        aria-label={`Cancel ${label} changes`}
        size="xs"
        variant="ghost"
        onClick={onCancel}
        disabled={isSaving}
      >
        Cancel
      </Button>
      <Button aria-label={`Save ${label}`} size="xs" onClick={onSave} disabled={isSaving}>
        <Save className="size-3.5" />
        {isSaving ? "Saving..." : "Save"}
      </Button>
    </div>
  ) : (
    <Button aria-label={`Edit ${label}`} size="xs" variant="ghost" onClick={onEdit}>
      <Pencil className="size-3.5" />
      Edit
    </Button>
  );
}

function ProfileValue({
  className,
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value || "Not added"}</p>
    </div>
  );
}

function RichTextField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: RichDocument) => void;
  value: RichDocument;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <RichTextEditor ariaLabel={label} onChange={onChange} value={value} />
    </div>
  );
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "P"
  );
}
