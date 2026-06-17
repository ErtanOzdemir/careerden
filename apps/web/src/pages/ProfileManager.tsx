import { useEffect, useState } from "react";
import type { Profile, SkillCategory } from "../types";
import { requireDefaultProfileId } from "../api/config";
import { mapApiProfileToUi } from "../api/mappers";
import { profilesApi } from "../api/profiles";

type Tab = "experiences" | "skills" | "education" | "documents";

const tabs: { key: Tab; label: string }[] = [
  { key: "experiences", label: "EXPERIENCES" },
  { key: "skills", label: "SKILLS" },
  { key: "education", label: "EDUCATION" },
  { key: "documents", label: "DOCUMENTS" },
];

const skillIconColors: Record<string, string> = {
  design_services: "text-primary",
  code: "text-tertiary",
  groups: "text-secondary",
};

export default function ProfileManager() {
  const [activeTab, setActiveTab] = useState<Tab>("experiences");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        setIsLoading(true);
        setError(null);
        const apiProfile = await profilesApi.get(requireDefaultProfileId());

        if (isMounted) {
          setProfile(mapApiProfileToUi(apiProfile));
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load profile.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="animate-fade-in max-w-max-width mx-auto py-2xl text-center text-secondary">
        Loading profile...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="animate-fade-in max-w-max-width mx-auto py-2xl text-center text-error">
        {error ?? "Profile data is unavailable."}
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-max-width mx-auto py-xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-lg mb-xl">
        <div>
          <h2 className="font-display text-display text-on-surface">Profile Manager</h2>
          <p className="font-body-lg text-on-surface-variant mt-sm">
            Curate your professional presence and assets.
          </p>
        </div>
        <div className="flex gap-md">
          <button className="flex items-center gap-2 px-lg py-sm border border-outline-variant rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-all cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">share</span>
            <span className="font-label-md">Public Link</span>
          </button>
          <button className="flex items-center gap-2 px-lg py-sm bg-primary text-on-primary rounded-lg hover:shadow-lg transition-all cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">cloud_upload</span>
            <span className="font-label-md">Quick Add</span>
          </button>
        </div>
      </div>

      <section className="bg-white/70 backdrop-blur border border-outline-variant rounded-2xl p-lg mb-xl flex flex-col md:flex-row gap-lg items-center md:items-start shadow-sm">
        <div className="relative group">
          <div className="w-32 h-32 rounded-2xl overflow-hidden bg-surface-container-highest border-4 border-white shadow-md">
            <div className="w-full h-full bg-primary-container flex items-center justify-center text-4xl font-bold text-on-primary">
              {profile.fullName.charAt(0)}
            </div>
          </div>
          <button className="absolute -bottom-2 -right-2 p-2 bg-primary text-on-primary rounded-full shadow-lg scale-90 group-hover:scale-100 transition-transform cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </button>
        </div>
        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-wrap justify-center md:justify-start items-center gap-md mb-xs">
            <h3 className="font-headline-lg text-headline-lg text-on-surface">
              {profile.fullName}
            </h3>
            <span className="px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold uppercase tracking-wider">
              {profile.title}
            </span>
          </div>
          <p className="font-body-md text-on-surface-variant max-w-[42rem]">{profile.headline}</p>
          <div className="flex flex-wrap justify-center md:justify-start gap-lg mt-md">
            <div className="flex items-center gap-2 text-outline">
              <span className="material-symbols-outlined text-[18px]">location_on</span>
              <span className="font-label-md">{profile.location}</span>
            </div>
            <div className="flex items-center gap-2 text-outline">
              <span className="material-symbols-outlined text-[18px]">mail</span>
              <span className="font-label-md">{profile.email}</span>
            </div>
            <div className="flex items-center gap-2 text-outline">
              <span className="material-symbols-outlined text-[18px]">link</span>
              <span className="font-label-md">{profile.portfolio}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="border-b border-outline-variant mb-lg overflow-x-auto">
        <nav className="flex gap-xl min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-md font-label-md transition-all cursor-pointer ${
                activeTab === tab.key
                  ? "text-primary border-b-2 border-primary"
                  : "text-on-surface-variant hover:text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "experiences" && (
        <div className="space-y-md animate-fade-in">
          <div className="flex justify-between items-center mb-sm">
            <h4 className="font-headline-md text-on-surface">Work History</h4>
            <button className="text-primary font-label-md flex items-center gap-1 hover:underline cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Add New Position
            </button>
          </div>
          <div className="grid grid-cols-1 gap-md">
            {profile.experiences.map((exp) => (
              <article
                key={exp.id}
                className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col md:flex-row gap-lg group hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary">{exp.icon}</span>
                </div>
                <div className="flex-1">
                  <div className="flex flex-col md:flex-row justify-between items-start mb-sm">
                    <div>
                      <h5 className="font-headline-md text-on-surface">{exp.title}</h5>
                      <div className="flex items-center gap-2 text-outline mt-1">
                        <span className="font-label-md text-secondary">{exp.company}</span>
                        <span className="text-xs">&bull;</span>
                        <span className="font-label-md">{exp.period}</span>
                      </div>
                    </div>
                    <button className="mt-md md:mt-0 p-2 text-secondary hover:bg-surface-container hover:text-primary rounded-lg transition-colors cursor-pointer">
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                  </div>
                  <ul className="space-y-sm">
                    {exp.achievements.map((ach, i) => (
                      <li key={i} className="flex gap-3 text-on-surface-variant">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        <p className="font-body-md">{ach}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {activeTab === "skills" && (
        <div className="space-y-xl animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
            {profile.skills.map((cat: SkillCategory) => (
              <div key={cat.name} className="bg-surface-container-low p-lg rounded-2xl">
                <div className="flex items-center gap-3 mb-lg">
                  <span
                    className={`material-symbols-outlined ${skillIconColors[cat.icon] || "text-primary"}`}
                  >
                    {cat.icon}
                  </span>
                  <h4 className="font-headline-md text-on-surface">{cat.name}</h4>
                </div>
                <div className="flex flex-wrap gap-sm">
                  {cat.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-md py-1.5 bg-white border border-outline-variant rounded-lg font-label-md text-on-surface-variant hover:border-primary cursor-default"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "education" && (
        <div className="space-y-md animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            {profile.education.map((edu) => (
              <div
                key={edu.id}
                className="p-lg border border-outline-variant rounded-xl bg-surface flex gap-lg items-start"
              >
                <div className="w-12 h-12 bg-secondary-fixed rounded-lg flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-on-secondary-fixed">
                    {edu.icon}
                  </span>
                </div>
                <div>
                  <h5 className="font-headline-md text-on-surface">{edu.degree}</h5>
                  <p className="font-body-md text-secondary">{edu.institution}</p>
                  <p className="font-label-md text-outline mt-sm">{edu.period}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
            {profile.documents.map((doc) => (
              <div
                key={doc.id}
                className="group border border-outline-variant rounded-xl p-lg bg-surface hover:border-primary transition-all relative overflow-hidden"
              >
                {doc.isMaster && (
                  <div className="absolute top-0 right-0 p-2">
                    <span className="px-2 py-0.5 bg-primary text-on-primary text-[10px] font-bold rounded-bl-lg tracking-tighter uppercase">
                      Master Copy
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-md mb-lg">
                  <div className="p-sm bg-error-container rounded-lg">
                    <span className="material-symbols-outlined text-error">picture_as_pdf</span>
                  </div>
                  <div>
                    <h5 className="font-label-md text-on-surface truncate pr-8">{doc.name}</h5>
                    <p className="text-[10px] text-outline">
                      Uploaded {doc.uploaded} &bull; {doc.size}
                    </p>
                  </div>
                </div>
                <div className="flex gap-sm">
                  <button className="flex-1 py-2 bg-surface-container text-on-surface font-label-md rounded-lg hover:bg-secondary-container transition-all cursor-pointer">
                    View
                  </button>
                  <button className="flex-1 py-2 border border-outline-variant text-on-surface-variant font-label-md rounded-lg hover:bg-surface-container transition-all cursor-pointer">
                    {doc.isMaster ? "Replace" : "Delete"}
                  </button>
                </div>
              </div>
            ))}
            <button className="border-2 border-dashed border-outline-variant rounded-xl p-lg flex flex-col items-center justify-center gap-sm hover:bg-surface-container-low hover:border-primary text-outline hover:text-primary transition-all cursor-pointer">
              <span className="material-symbols-outlined text-[32px]">add_circle</span>
              <span className="font-label-md">Upload New Document</span>
            </button>
          </div>
        </div>
      )}

      <button className="fixed bottom-margin-mobile right-margin-mobile lg:bottom-margin-desktop lg:right-margin-desktop w-14 h-14 bg-primary text-on-primary rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-[60] cursor-pointer">
        <span className="material-symbols-outlined text-[28px]">save</span>
      </button>
    </div>
  );
}
