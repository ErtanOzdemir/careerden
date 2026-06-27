import { useEffect, useState } from "react";
import { Button } from "../components/ui/button.js";
import { Panel } from "../components/link2cv/panel.js";
import { Field, TextAreaField } from "../components/link2cv/field.js";
import { profilesApi } from "../api/profiles.js";
import type { ApiProfile, ApiUpdateProfilePayload } from "../api/types.js";
import {
  UserRound,
  FileText,
  Briefcase,
  GraduationCap,
  Award,
  FolderGit2,
  Plus,
  Check,
} from "lucide-react";

const sections = [
  { id: "basics", label: "Basic information", icon: UserRound },
  { id: "summary", label: "Professional summary", icon: FileText },
  { id: "skills", label: "Skills", icon: Award },
  { id: "experience", label: "Experience", icon: Briefcase },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "projects", label: "Projects", icon: FolderGit2 },
];

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
              <Field label="Full name" defaultValue={fullName} />
              <Field label="Email" type="email" defaultValue={email} />
              <Field label="Profession" defaultValue={profession} />
              <Field label="Location" defaultValue={location} />
              <Field label="Headline" defaultValue={headline} className="sm:col-span-2" />
            </div>
          </Panel>
        </section>

        <section id="summary" className="scroll-mt-24">
          <Panel className="p-6">
            <SectionTitle icon={FileText} title="Professional summary" />
            <div className="mt-5">
              <TextAreaField label="Summary" rows={4} defaultValue={summary} />
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
                >
                  {skill} ×
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
            <SectionTitle icon={Briefcase} title="Experience" />
            <div className="mt-5 space-y-4">
              {profile.experience.length > 0 ? (
                profile.experience.map((exp, i) => (
                  <div key={i} className="rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{exp.title}</p>
                        <p className="text-xs text-muted-foreground">{exp.company}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {[exp.startDate, exp.endDate].filter(Boolean).join(" - ") || "Present"}
                      </span>
                    </div>
                    {(exp.description || exp.achievements.length > 0) && (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {exp.description ?? exp.achievements.join(" · ")}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No experience added yet.</p>
              )}
            </div>
          </Panel>
        </section>

        <section id="education" className="scroll-mt-24">
          <Panel className="p-6">
            <SectionTitle icon={GraduationCap} title="Education" />
            <div className="mt-5 space-y-3">
              {profile.education.length > 0 ? (
                profile.education.map((edu, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border p-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {[edu.degree, edu.field].filter(Boolean).join(", ") || "Education"}
                      </p>
                      <p className="text-xs text-muted-foreground">{edu.institution}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {[edu.startDate, edu.endDate].filter(Boolean).join(" - ") || "Present"}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No education added yet.</p>
              )}
            </div>
          </Panel>
        </section>

        <section id="projects" className="scroll-mt-24">
          <Panel className="p-6">
            <SectionTitle icon={FolderGit2} title="Projects & certifications" />
            <div className="mt-5 space-y-3">
              {profile.projects.length > 0 ? (
                profile.projects.map((proj, i) => (
                  <div key={i} className="rounded-lg border border-border p-4">
                    <p className="text-sm font-medium text-foreground">{proj.name}</p>
                    {proj.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{proj.description}</p>
                    )}
                    {proj.skills.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {proj.skills.map((s) => (
                          <span
                            key={s}
                            className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[0.7rem] font-medium text-secondary-foreground"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {proj.url && (
                      <a
                        href={proj.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-xs text-primary hover:underline"
                      >
                        {proj.url}
                      </a>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Add projects to strengthen your match analysis.
                  </p>
                </div>
              )}
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
