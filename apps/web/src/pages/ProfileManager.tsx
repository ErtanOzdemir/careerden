import { useEffect, useState } from "react";
import { Button } from "../components/ui/button.js";
import { Panel } from "../components/link2cv/panel.js";
import { Field, TextAreaField } from "../components/link2cv/field.js";
import { profilesApi } from "../api/profiles.js";
import type {
  ApiProfile,
  ApiUpdateProfilePayload,
  ApiProfileExperience,
  ApiProfileEducation,
  ApiProfileProject,
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
];

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

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [profession, setProfession] = useState("");
  const [location, setLocation] = useState("");
  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
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
          setSummary(p.summary ?? "");
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

  async function handleSave() {
    if (!profile) return;
    try {
      setIsSaving(true);
      setError(null);
      setSaved(false);
      const payload: ApiUpdateProfilePayload = {
        fullName: fullName.trim() || undefined,
        email: email.trim() || undefined,
        profession: profession.trim() || undefined,
        location: location.trim() || undefined,
        headline: headline.trim() || undefined,
        summary: summary.trim() || undefined,
        skills: skills.filter(Boolean),
        experience,
        education,
        projects,
        certifications: certifications.filter(Boolean),
      };
      await profilesApi.update(profile.id, payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setIsSaving(false);
    }
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
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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

        <section id="basics" className="scroll-mt-24">
          <Panel className="p-6">
            <SectionTitle icon={UserRound} title="Basic information" />
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
          </Panel>
        </section>

        <section id="summary" className="scroll-mt-24">
          <Panel className="p-6">
            <SectionTitle icon={FileText} title="Professional summary" />
            <div className="mt-5">
              <TextAreaField
                label="Summary"
                rows={4}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>
          </Panel>
        </section>

        <section id="skills" className="scroll-mt-24">
          <Panel className="p-6">
            <SectionTitle icon={Award} title="Skills" />
            <div className="mt-5 flex flex-wrap gap-2">
              {skills.map((skill) => (
                <button
                  key={skill}
                  onClick={() => removeSkill(skill)}
                  className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
                  type="button"
                >
                  {skill} <X className="inline size-3" />
                </button>
              ))}
              <div className="flex items-center gap-1">
                <input
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
            </div>
          </Panel>
        </section>

        <section id="experience" className="scroll-mt-24">
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
                    onChange={(updated) =>
                      setExperience((prev) => prev.map((e, idx) => (idx === i ? updated : e)))
                    }
                    onRemove={() => setExperience((prev) => prev.filter((_, idx) => idx !== i))}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No experience added yet.</p>
              )}
            </div>
          </Panel>
        </section>

        <section id="education" className="scroll-mt-24">
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
                    onChange={(updated) =>
                      setEducation((prev) => prev.map((e, idx) => (idx === i ? updated : e)))
                    }
                    onRemove={() => setEducation((prev) => prev.filter((_, idx) => idx !== i))}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No education added yet.</p>
              )}
            </div>
          </Panel>
        </section>

        <section id="projects" className="scroll-mt-24">
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
                        onChange={(updated) =>
                          setProjects((prev) => prev.map((p, idx) => (idx === i ? updated : p)))
                        }
                        onRemove={() => setProjects((prev) => prev.filter((_, idx) => idx !== i))}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No projects added yet.</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Certifications</h3>
                <div className="flex flex-wrap gap-2">
                  {certifications.map((cert) => (
                    <button
                      key={cert}
                      onClick={() => removeCert(cert)}
                      className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
                      type="button"
                    >
                      {cert} <X className="inline size-3" />
                    </button>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
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
                </div>
              </div>
            </div>
          </Panel>
        </section>

        <div className="flex justify-end gap-2 pb-2">
          <Button variant="ghost">Discard changes</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save profile"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExperienceEditor({
  experience,
  onChange,
  onRemove,
}: {
  experience: ApiProfileExperience;
  onChange: (e: ApiProfileExperience) => void;
  onRemove: () => void;
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
              <TextAreaField
                label="Description"
                rows={3}
                value={experience.description ?? ""}
                onChange={(e) =>
                  onChange({ ...experience, description: e.target.value || undefined })
                }
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
              {experience.description && (
                <p className="mt-1 text-sm text-muted-foreground">{experience.description}</p>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsEditing((v) => !v)}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
            type="button"
          >
            {isEditing ? <Save className="size-4" /> : <Pencil className="size-4" />}
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 rounded-md hover:bg-danger-soft text-muted-foreground hover:text-destructive"
            type="button"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function EducationEditor({
  education,
  onChange,
  onRemove,
}: {
  education: ApiProfileEducation;
  onChange: (e: ApiProfileEducation) => void;
  onRemove: () => void;
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
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsEditing((v) => !v)}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
            type="button"
          >
            {isEditing ? <Save className="size-4" /> : <Pencil className="size-4" />}
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 rounded-md hover:bg-danger-soft text-muted-foreground hover:text-destructive"
            type="button"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectEditor({
  project,
  onChange,
  onRemove,
}: {
  project: ApiProfileProject;
  onChange: (p: ApiProfileProject) => void;
  onRemove: () => void;
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
              <TextAreaField
                label="Description"
                rows={2}
                value={project.description ?? ""}
                onChange={(e) => onChange({ ...project, description: e.target.value || undefined })}
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
              {project.description && (
                <p className="mt-1 text-xs text-muted-foreground">{project.description}</p>
              )}
              {project.url && <p className="mt-1 text-xs text-primary truncate">{project.url}</p>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsEditing((v) => !v)}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
            type="button"
          >
            {isEditing ? <Save className="size-4" /> : <Pencil className="size-4" />}
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 rounded-md hover:bg-danger-soft text-muted-foreground hover:text-destructive"
            type="button"
          >
            <Trash2 className="size-4" />
          </button>
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
