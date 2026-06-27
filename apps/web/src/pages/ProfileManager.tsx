import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FormEvent, ReactNode } from "react";
import type {
  ApiDocumentTemplate,
  ApiDocumentTemplateField,
  ApiDocumentTemplateVariableAliases,
  ApiProfile,
  ApiProfileEducation,
  ApiProfileExperience,
  ApiSelectedEducationTemplateField,
  ApiSelectedExperienceTemplateField,
  ApiUpdateProfilePayload,
} from "../api/types";
import type { SkillCategory } from "../types";
import { mapApiProfileToUi } from "../api/mappers";
import { profilesApi } from "../api/profiles";

type Tab = "experiences" | "skills" | "education" | "documents";

type EditingIndex = number | "new" | null;
type SimpleTemplateField = Exclude<
  ApiDocumentTemplateField,
  "selected_education" | "selected_experiences"
>;

interface ExperienceDraft {
  achievements: string;
  company: string;
  description: string;
  endDate: string;
  skills: string;
  startDate: string;
  title: string;
}

interface EducationDraft {
  achievements: string;
  degree: string;
  endDate: string;
  field: string;
  institution: string;
  startDate: string;
}

interface ProfileDetailsDraft {
  email: string;
  fullName: string;
  links: string[];
  location: string;
  profession: string;
  summary: string;
}

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

const emptyExperienceDraft: ExperienceDraft = {
  achievements: "",
  company: "",
  description: "",
  endDate: "",
  skills: "",
  startDate: "",
  title: "",
};

const emptyEducationDraft: EducationDraft = {
  achievements: "",
  degree: "",
  endDate: "",
  field: "",
  institution: "",
  startDate: "",
};

const emptyProfileDetailsDraft: ProfileDetailsDraft = {
  email: "",
  fullName: "",
  links: [],
  location: "",
  profession: "",
  summary: "",
};

export default function ProfileManager() {
  const [activeTab, setActiveTab] = useState<Tab>("experiences");
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [documentTemplates, setDocumentTemplates] = useState<ApiDocumentTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const [isSavingTemplateVariables, setIsSavingTemplateVariables] = useState(false);
  const [isEditingProfileDetails, setIsEditingProfileDetails] = useState(false);
  const [profileDetailsDraft, setProfileDetailsDraft] =
    useState<ProfileDetailsDraft>(emptyProfileDetailsDraft);
  const [editingExperienceIndex, setEditingExperienceIndex] = useState<EditingIndex>(null);
  const [experienceDraft, setExperienceDraft] = useState<ExperienceDraft>(emptyExperienceDraft);
  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [skillsDraft, setSkillsDraft] = useState("");
  const [editingEducationIndex, setEditingEducationIndex] = useState<EditingIndex>(null);
  const [educationDraft, setEducationDraft] = useState<EducationDraft>(emptyEducationDraft);
  const templateVariableSaveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        setIsLoading(true);
        setError(null);
        const apiProfile = await profilesApi.me();
        const templates = await profilesApi.listDocumentTemplates(apiProfile.id);

        if (isMounted) {
          setProfile(apiProfile);
          setDocumentTemplates(templates);
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

  useEffect(() => {
    return () => {
      if (templateVariableSaveTimeoutRef.current !== null) {
        window.clearTimeout(templateVariableSaveTimeoutRef.current);
      }
    };
  }, []);

  async function saveProfile(
    payload: ApiUpdateProfilePayload,
    message: string,
  ): Promise<ApiProfile | null> {
    if (!profile) {
      return null;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveMessage(null);
      const updatedProfile = await profilesApi.update(profile.id, payload);
      setProfile(updatedProfile);
      setSaveMessage(message);
      return updatedProfile;
    } catch (saveProfileError) {
      setSaveError(
        saveProfileError instanceof Error ? saveProfileError.message : "Failed to save profile.",
      );
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTemplateUpload(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      setIsUploadingTemplate(true);
      setSaveError(null);
      if (!profile) {
        return;
      }

      const template = await profilesApi.uploadDocumentTemplate(profile.id, file);
      setDocumentTemplates((current) => [template, ...current]);
      setSaveMessage("CV template uploaded.");
    } catch (uploadError) {
      setSaveError(
        uploadError instanceof Error ? uploadError.message : "Failed to upload CV template.",
      );
    } finally {
      setIsUploadingTemplate(false);
    }
  }

  function getDefaultTemplate(): ApiDocumentTemplate | undefined {
    return documentTemplates.find((template) => template.isDefault) ?? documentTemplates[0];
  }

  function updateDefaultTemplateAliases(
    updater: (aliases: ApiDocumentTemplateVariableAliases) => ApiDocumentTemplateVariableAliases,
  ) {
    const activeTemplateId = getDefaultTemplate()?.id;
    const activeTemplate = getDefaultTemplate();

    if (!activeTemplateId || !activeTemplate) {
      return;
    }

    const nextAliases = updater(normalizeVariableAliases(activeTemplate.variableAliases));

    setDocumentTemplates((current) => {
      const template = current.find((t) => t.id === activeTemplateId);

      if (!template) {
        return current;
      }

      return current.map((t) =>
        t.id === activeTemplateId ? { ...t, variableAliases: nextAliases } : t,
      );
    });

    scheduleTemplateAliasSave(activeTemplateId, nextAliases);
  }

  function handleSimpleVariableChange(field: SimpleTemplateField, variableName: string) {
    updateDefaultTemplateAliases((aliases) => ({
      ...aliases,
      fields: compactRecord({
        ...aliases.fields,
        [field]: variableName,
      }),
    }));
  }

  function handleExperienceVariableChange(
    itemIndex: number,
    field: ApiSelectedExperienceTemplateField,
    variableName: string,
  ) {
    updateDefaultTemplateAliases((aliases) => {
      const items = [...(aliases.selectedExperiences?.items ?? [])];
      items[itemIndex] = {
        fields: compactRecord({
          ...(items[itemIndex]?.fields ?? {}),
          [field]: variableName,
        }),
      };

      return {
        ...aliases,
        selectedExperiences: {
          fields: aliases.selectedExperiences?.fields ?? {},
          items,
        },
      };
    });
  }

  function handleEducationVariableChange(
    itemIndex: number,
    field: ApiSelectedEducationTemplateField,
    variableName: string,
  ) {
    updateDefaultTemplateAliases((aliases) => {
      const items = [...(aliases.selectedEducation?.items ?? [])];
      items[itemIndex] = {
        fields: compactRecord({
          ...(items[itemIndex]?.fields ?? {}),
          [field]: variableName,
        }),
      };

      return {
        ...aliases,
        selectedEducation: {
          fields: aliases.selectedEducation?.fields ?? {},
          items,
        },
      };
    });
  }

  function handleLinkVariableChange(itemIndex: number, variableName: string) {
    updateDefaultTemplateAliases((aliases) => {
      const linkItems = [...(aliases.linkItems ?? [])];
      linkItems[itemIndex] = variableName.trim() ? { variableName } : {};

      return {
        ...aliases,
        linkItems,
      };
    });
  }

  function handleLinkVariableRemove(itemIndex: number) {
    updateDefaultTemplateAliases((aliases) => ({
      ...aliases,
      linkItems: (aliases.linkItems ?? []).filter((_, index) => index !== itemIndex),
    }));
  }

  async function handleSaveTemplateVariables() {
    const activeTemplate = getDefaultTemplate();

    if (!activeTemplate) {
      setSaveError("Upload a DOCX template before adding template variables.");
      return;
    }

    if (templateVariableSaveTimeoutRef.current !== null) {
      window.clearTimeout(templateVariableSaveTimeoutRef.current);
      templateVariableSaveTimeoutRef.current = null;
    }

    await persistTemplateAliases(
      activeTemplate.id,
      normalizeVariableAliases(activeTemplate.variableAliases),
      true,
    );
  }

  function scheduleTemplateAliasSave(
    templateId: string,
    variableAliases: ApiDocumentTemplateVariableAliases,
  ) {
    if (templateVariableSaveTimeoutRef.current !== null) {
      window.clearTimeout(templateVariableSaveTimeoutRef.current);
    }

    templateVariableSaveTimeoutRef.current = window.setTimeout(() => {
      templateVariableSaveTimeoutRef.current = null;
      void persistTemplateAliases(templateId, variableAliases, false);
    }, 350);
  }

  async function persistTemplateAliases(
    templateId: string,
    variableAliases: ApiDocumentTemplateVariableAliases,
    showSuccessMessage: boolean,
  ) {
    try {
      if (showSuccessMessage) {
        setIsSavingTemplateVariables(true);
        setSaveMessage(null);
      }

      if (!profile) {
        return;
      }

      setSaveError(null);
      const updated = await profilesApi.updateDocumentTemplateVariableAliases(
        profile.id,
        templateId,
        variableAliases,
      );

      setDocumentTemplates((current) =>
        current.map((template) => (template.id === updated.id ? updated : template)),
      );

      if (showSuccessMessage) {
        setSaveMessage("Template variables saved.");
      }
    } catch (variableError) {
      setSaveError(
        variableError instanceof Error
          ? variableError.message
          : "Failed to save template variables.",
      );
    } finally {
      if (showSuccessMessage) {
        setIsSavingTemplateVariables(false);
      }
    }
  }

  async function handleSetDefaultTemplate(template: ApiDocumentTemplate) {
    try {
      setIsSaving(true);
      setSaveError(null);
      if (!profile) {
        return;
      }

      const updated = await profilesApi.setDefaultDocumentTemplate(profile.id, template.id);
      setDocumentTemplates((current) =>
        current.map((item) => ({ ...item, isDefault: item.id === updated.id })),
      );
      setSaveMessage("Default CV template updated.");
    } catch (defaultError) {
      setSaveError(
        defaultError instanceof Error ? defaultError.message : "Failed to set default template.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function startEditProfileDetails() {
    if (!profile) return;

    setProfileDetailsDraft({
      email: profile.email,
      fullName: profile.fullName,
      links: [...(profile.links ?? [])],
      location: profile.location ?? "",
      profession: profile.profession ?? "",
      summary: profile.summary ?? "",
    });
    setIsEditingProfileDetails(true);
    setSaveError(null);
    setSaveMessage(null);
  }

  function cancelProfileDetailsEdit() {
    setIsEditingProfileDetails(false);
    setProfileDetailsDraft(emptyProfileDetailsDraft);
  }

  async function submitProfileDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const updatedProfile = await saveProfile(
      toProfileDetailsPayload(profileDetailsDraft),
      "Profile details saved.",
    );

    if (updatedProfile) {
      cancelProfileDetailsEdit();
    }
  }

  function startNewExperience() {
    setActiveTab("experiences");
    setEditingExperienceIndex("new");
    setExperienceDraft(emptyExperienceDraft);
    setSaveError(null);
    setSaveMessage(null);
  }

  function startEditExperience(index: number) {
    if (!profile) return;

    setEditingExperienceIndex(index);
    setExperienceDraft(fromApiExperience(profile.experience[index]));
    setSaveError(null);
    setSaveMessage(null);
  }

  function cancelExperienceEdit() {
    setEditingExperienceIndex(null);
    setExperienceDraft(emptyExperienceDraft);
  }

  async function submitExperience(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) return;

    const nextExperience = [...profile.experience];
    const updatedExperience = toApiExperience(experienceDraft);

    if (editingExperienceIndex === "new") {
      nextExperience.push(updatedExperience);
    } else if (typeof editingExperienceIndex === "number") {
      nextExperience[editingExperienceIndex] = updatedExperience;
    }

    const updatedProfile = await saveProfile(
      { experience: nextExperience },
      editingExperienceIndex === "new" ? "Experience added." : "Experience saved.",
    );

    if (updatedProfile) {
      cancelExperienceEdit();
    }
  }

  async function removeExperience(index: number) {
    if (!profile) return;

    const updatedProfile = await saveProfile(
      { experience: profile.experience.filter((_, itemIndex) => itemIndex !== index) },
      "Experience removed.",
    );

    if (updatedProfile) {
      updateDefaultTemplateAliases((aliases) => ({
        ...aliases,
        selectedExperiences: {
          fields: aliases.selectedExperiences?.fields ?? {},
          items: (aliases.selectedExperiences?.items ?? []).filter(
            (_, itemIndex) => itemIndex !== index,
          ),
        },
      }));
      cancelExperienceEdit();
    }
  }

  function startEditSkills() {
    if (!profile) return;

    setActiveTab("skills");
    setIsEditingSkills(true);
    setSkillsDraft(profile.skills.join("\n"));
    setSaveError(null);
    setSaveMessage(null);
  }

  function cancelSkillsEdit() {
    setIsEditingSkills(false);
    setSkillsDraft("");
  }

  async function submitSkills(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const updatedProfile = await saveProfile({ skills: splitList(skillsDraft) }, "Skills saved.");

    if (updatedProfile) {
      cancelSkillsEdit();
    }
  }

  function startNewEducation() {
    setActiveTab("education");
    setEditingEducationIndex("new");
    setEducationDraft(emptyEducationDraft);
    setSaveError(null);
    setSaveMessage(null);
  }

  function startEditEducation(index: number) {
    if (!profile) return;

    setEditingEducationIndex(index);
    setEducationDraft(fromApiEducation(profile.education[index]));
    setSaveError(null);
    setSaveMessage(null);
  }

  function cancelEducationEdit() {
    setEditingEducationIndex(null);
    setEducationDraft(emptyEducationDraft);
  }

  async function submitEducation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) return;

    const nextEducation = [...profile.education];
    const updatedEducation = toApiEducation(educationDraft);

    if (editingEducationIndex === "new") {
      nextEducation.push(updatedEducation);
    } else if (typeof editingEducationIndex === "number") {
      nextEducation[editingEducationIndex] = updatedEducation;
    }

    const updatedProfile = await saveProfile(
      { education: nextEducation },
      editingEducationIndex === "new" ? "Education added." : "Education saved.",
    );

    if (updatedProfile) {
      cancelEducationEdit();
    }
  }

  async function removeEducation(index: number) {
    if (!profile) return;

    const updatedProfile = await saveProfile(
      { education: profile.education.filter((_, itemIndex) => itemIndex !== index) },
      "Education removed.",
    );

    if (updatedProfile) {
      updateDefaultTemplateAliases((aliases) => ({
        ...aliases,
        selectedEducation: {
          fields: aliases.selectedEducation?.fields ?? {},
          items: (aliases.selectedEducation?.items ?? []).filter(
            (_, itemIndex) => itemIndex !== index,
          ),
        },
      }));
      cancelEducationEdit();
    }
  }

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

  const uiProfile = mapApiProfileToUi(profile);
  const activeTemplate = getDefaultTemplate();
  const variableAliases = normalizeVariableAliases(activeTemplate?.variableAliases);
  const experienceTemplateVariableIndex =
    editingExperienceIndex === "new" ? profile.experience.length : editingExperienceIndex;
  const educationTemplateVariableIndex =
    editingEducationIndex === "new" ? profile.education.length : editingEducationIndex;

  return (
    <div className="animate-fade-in max-w-max-width mx-auto py-xl">
      <div className="mb-xl">
        <div>
          <h2 className="font-display text-display text-on-surface">Profile Manager</h2>
          <p className="font-body-lg text-on-surface-variant mt-sm">
            Curate your professional presence and assets.
          </p>
        </div>
      </div>

      <section className="bg-white/70 backdrop-blur border border-outline-variant rounded-2xl p-lg mb-lg flex flex-col md:flex-row gap-lg items-center md:items-start shadow-sm">
        <div className="relative group">
          <div className="w-32 h-32 rounded-2xl overflow-hidden bg-surface-container-highest border-4 border-white shadow-md">
            <div className="w-full h-full bg-primary-container flex items-center justify-center text-4xl font-bold text-on-primary">
              {uiProfile.fullName.charAt(0)}
            </div>
          </div>
        </div>
        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-wrap justify-center md:justify-start items-center gap-md mb-xs">
            <h3 className="font-headline-lg text-headline-lg text-on-surface">
              {uiProfile.fullName}
            </h3>
            {uiProfile.title && (
              <span className="px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold uppercase tracking-wider">
                {uiProfile.title}
              </span>
            )}
          </div>
          <p className="font-body-md text-on-surface-variant max-w-[42rem]">{uiProfile.headline}</p>
          <div className="flex flex-wrap justify-center md:justify-start gap-lg mt-md">
            <div className="flex items-center gap-2 text-outline">
              <span className="material-symbols-outlined text-[18px]">location_on</span>
              <span className="font-label-md">{uiProfile.location}</span>
            </div>
            <div className="flex items-center gap-2 text-outline">
              <span className="material-symbols-outlined text-[18px]">mail</span>
              <span className="font-label-md">{uiProfile.email}</span>
            </div>
            <div className="flex items-center gap-2 text-outline">
              <span className="material-symbols-outlined text-[18px]">link</span>
              <span className="font-label-md">{uiProfile.portfolio}</span>
            </div>
          </div>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-outline-variant bg-white px-md py-2 text-label-md font-bold text-on-surface-variant hover:bg-surface-container-low"
          onClick={startEditProfileDetails}
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">edit</span>
          Edit Details
        </button>
      </section>

      {isEditingProfileDetails && (
        <ProfileDetailsForm
          draft={profileDetailsDraft}
          isSaving={isSaving}
          onCancel={cancelProfileDetailsEdit}
          onChange={setProfileDetailsDraft}
          onLinkTemplateVariableRemove={handleLinkVariableRemove}
          onLinkTemplateVariableChange={handleLinkVariableChange}
          onSubmit={submitProfileDetails}
          onTemplateVariableChange={handleSimpleVariableChange}
          linkTemplateVariables={variableAliases.linkItems ?? []}
          templateVariables={variableAliases.fields}
          templateVariablesDisabled={!activeTemplate}
        />
      )}

      {(saveError || saveMessage) && (
        <div
          className={`mb-lg rounded-lg border px-lg py-md font-body-md ${
            saveError
              ? "border-error-container bg-error-container text-on-error-container"
              : "border-secondary-container bg-secondary-container text-on-secondary-container"
          }`}
        >
          {saveError ?? saveMessage}
        </div>
      )}

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

      {activeTemplate && (
        <div className="mb-lg flex justify-end">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-outline-variant bg-white px-md py-2 text-label-md font-bold text-on-surface-variant hover:bg-surface-container-low disabled:opacity-60"
            disabled={isSaving || isSavingTemplateVariables}
            onClick={() => void handleSaveTemplateVariables()}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            {isSaving ? "Saving..." : "Save Template Variables"}
          </button>
        </div>
      )}

      {activeTab === "experiences" && (
        <div className="space-y-md animate-fade-in">
          <div className="flex justify-between items-center mb-sm">
            <h4 className="font-headline-md text-on-surface">Work History</h4>
            <button
              onClick={startNewExperience}
              className="text-primary font-label-md flex items-center gap-1 hover:underline cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Add New Position
            </button>
          </div>

          {editingExperienceIndex !== null && (
            <ExperienceForm
              draft={experienceDraft}
              isSaving={isSaving}
              mode={editingExperienceIndex === "new" ? "Add Position" : "Edit Position"}
              onCancel={cancelExperienceEdit}
              onChange={setExperienceDraft}
              onTemplateVariableChange={(field, variableName) =>
                handleExperienceVariableChange(
                  experienceTemplateVariableIndex ?? 0,
                  field,
                  variableName,
                )
              }
              onSubmit={submitExperience}
              templateVariablesDisabled={!activeTemplate}
              templateVariables={
                variableAliases.selectedExperiences?.items?.[experienceTemplateVariableIndex ?? 0]
                  ?.fields ??
                variableAliases.selectedExperiences?.fields ??
                {}
              }
            />
          )}

          <div className="grid grid-cols-1 gap-md">
            {uiProfile.experiences.map((exp, index) => (
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
                    <div className="mt-md md:mt-0 flex gap-sm">
                      <button
                        onClick={() => startEditExperience(index)}
                        className="p-2 text-secondary hover:bg-surface-container hover:text-primary rounded-lg transition-colors cursor-pointer"
                        title="Edit position"
                      >
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                      <button
                        onClick={() => void removeExperience(index)}
                        className="p-2 text-error hover:bg-error-container rounded-lg transition-colors cursor-pointer"
                        title="Remove position"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
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
            {uiProfile.experiences.length === 0 && (
              <div className="border border-dashed border-outline-variant rounded-xl p-lg text-outline">
                No work history yet.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "skills" && (
        <div className="space-y-xl animate-fade-in">
          <div className="flex justify-between items-center">
            <h4 className="font-headline-md text-on-surface">Skills</h4>
            <button
              onClick={startEditSkills}
              className="text-primary font-label-md flex items-center gap-1 hover:underline cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
              Edit Skills
            </button>
          </div>

          {isEditingSkills && (
            <form
              onSubmit={(event) => void submitSkills(event)}
              className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg space-y-md"
            >
              <label className="block">
                <FieldLabel
                  label="Skills"
                  variableControl={
                    <TemplateVariableControl
                      disabled={!activeTemplate}
                      onChange={(value) => handleSimpleVariableChange("skills", value)}
                      value={variableAliases.fields.skills ?? ""}
                    />
                  }
                />
                <textarea
                  rows={8}
                  value={skillsDraft}
                  onChange={(event) => setSkillsDraft(event.target.value)}
                  className="mt-sm w-full rounded-lg border border-outline-variant bg-white px-md py-sm text-on-surface"
                />
              </label>
              <div className="flex flex-wrap justify-end gap-sm">
                <button
                  type="button"
                  onClick={cancelSkillsEdit}
                  className="px-lg py-sm border border-outline-variant text-on-surface-variant rounded-lg hover:bg-surface-container transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-lg py-sm bg-primary text-on-primary rounded-lg hover:shadow-md transition-all disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save Skills"}
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
            {uiProfile.skills.map((cat: SkillCategory) => (
              <div key={cat.name} className="bg-surface-container-low p-lg rounded-2xl">
                <div className="flex items-center gap-3 mb-lg">
                  <span
                    className={`material-symbols-outlined ${
                      skillIconColors[cat.icon] || "text-primary"
                    }`}
                  >
                    {cat.icon}
                  </span>
                  <h4 className="font-headline-md text-on-surface">{cat.name}</h4>
                </div>
                <div className="flex flex-wrap gap-sm">
                  {cat.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-md py-1.5 bg-white border border-outline-variant rounded-lg font-label-md text-on-surface-variant"
                    >
                      {skill}
                    </span>
                  ))}
                  {cat.skills.length === 0 && (
                    <span className="font-body-md text-outline">No skills yet.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "education" && (
        <div className="space-y-md animate-fade-in">
          <div className="flex justify-between items-center mb-sm">
            <h4 className="font-headline-md text-on-surface">Education</h4>
            <button
              onClick={startNewEducation}
              className="text-primary font-label-md flex items-center gap-1 hover:underline cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Add Education
            </button>
          </div>

          {editingEducationIndex !== null && (
            <EducationForm
              draft={educationDraft}
              isSaving={isSaving}
              mode={editingEducationIndex === "new" ? "Add Education" : "Edit Education"}
              onCancel={cancelEducationEdit}
              onChange={setEducationDraft}
              onTemplateVariableChange={(field, variableName) =>
                handleEducationVariableChange(
                  educationTemplateVariableIndex ?? 0,
                  field,
                  variableName,
                )
              }
              onSubmit={submitEducation}
              templateVariablesDisabled={!activeTemplate}
              templateVariables={
                variableAliases.selectedEducation?.items?.[educationTemplateVariableIndex ?? 0]
                  ?.fields ??
                variableAliases.selectedEducation?.fields ??
                {}
              }
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            {uiProfile.education.map((edu, index) => (
              <div
                key={edu.id}
                className="p-lg border border-outline-variant rounded-xl bg-surface flex gap-lg items-start"
              >
                <div className="w-12 h-12 bg-secondary-fixed rounded-lg flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-on-secondary-fixed">
                    {edu.icon}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between gap-md">
                    <div>
                      <h5 className="font-headline-md text-on-surface">{edu.degree}</h5>
                      <p className="font-body-md text-secondary">{edu.institution}</p>
                      <p className="font-label-md text-outline mt-sm">{edu.period}</p>
                    </div>
                    <div className="flex gap-sm">
                      <button
                        onClick={() => startEditEducation(index)}
                        className="p-2 text-secondary hover:bg-surface-container hover:text-primary rounded-lg transition-colors cursor-pointer"
                        title="Edit education"
                      >
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                      <button
                        onClick={() => void removeEducation(index)}
                        className="p-2 text-error hover:bg-error-container rounded-lg transition-colors cursor-pointer"
                        title="Remove education"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {uiProfile.education.length === 0 && (
              <div className="border border-dashed border-outline-variant rounded-xl p-lg text-outline">
                No education yet.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="animate-fade-in">
          <div className="mb-lg flex flex-col gap-sm rounded-xl border border-outline-variant bg-white/70 p-lg md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-display font-headline-md">CV DOCX Template</h3>
              <p className="text-body-sm text-on-surface-variant">
                Upload a DOCX with placeholders that match the variable names entered in the profile
                fields.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-lg py-sm text-label-md font-bold text-on-primary transition-opacity hover:opacity-90">
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              {isUploadingTemplate ? "Uploading..." : "Upload DOCX"}
              <input
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                disabled={isUploadingTemplate}
                onChange={(event) => void handleTemplateUpload(event.target.files?.[0])}
                type="file"
              />
            </label>
          </div>

          <div className="space-y-lg">
            {documentTemplates.map((template) => {
              return (
                <section
                  key={template.id}
                  className="rounded-xl border border-outline-variant bg-surface p-lg shadow-sm"
                >
                  <div className="mb-md flex flex-col gap-sm md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-sm">
                        <h4 className="truncate font-body-md font-bold">{template.fileName}</h4>
                        {template.isDefault && (
                          <span className="rounded-full bg-primary-container px-2 py-0.5 text-[10px] font-bold uppercase text-on-primary-container">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-label-sm text-outline">
                        {Math.round(template.size / 1024)} KB
                      </p>
                    </div>
                    <div className="flex gap-sm">
                      {!template.isDefault && (
                        <button
                          className="rounded-lg border border-outline-variant px-md py-2 text-label-md font-bold text-on-surface-variant hover:bg-surface-container-low disabled:opacity-60"
                          disabled={isSaving}
                          onClick={() => void handleSetDefaultTemplate(template)}
                          type="button"
                        >
                          Set Default
                        </button>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}

            {documentTemplates.length === 0 && (
              <div className="rounded-xl border border-dashed border-outline-variant p-xl text-center text-outline">
                No CV templates uploaded yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ExperienceForm(props: {
  draft: ExperienceDraft;
  isSaving: boolean;
  mode: string;
  onCancel: () => void;
  onChange: (draft: ExperienceDraft) => void;
  onTemplateVariableChange: (
    field: ApiSelectedExperienceTemplateField,
    variableName: string,
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  templateVariables: Partial<Record<ApiSelectedExperienceTemplateField, string>>;
  templateVariablesDisabled: boolean;
}) {
  const {
    draft,
    isSaving,
    mode,
    onCancel,
    onChange,
    onSubmit,
    onTemplateVariableChange,
    templateVariables,
    templateVariablesDisabled,
  } = props;

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg space-y-md"
    >
      <h5 className="font-headline-md text-on-surface">{mode}</h5>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <label className="block">
          <FieldLabel
            label="Title"
            variableControl={
              <TemplateVariableControl
                disabled={templateVariablesDisabled}
                onChange={(value) => onTemplateVariableChange("title", value)}
                value={templateVariables.title ?? ""}
              />
            }
          />
          <input
            required
            value={draft.title}
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
            className="mt-sm w-full rounded-lg border border-outline-variant bg-white px-md py-sm text-on-surface"
          />
        </label>
        <label className="block">
          <FieldLabel
            label="Company"
            variableControl={
              <TemplateVariableControl
                disabled={templateVariablesDisabled}
                onChange={(value) => onTemplateVariableChange("company", value)}
                value={templateVariables.company ?? ""}
              />
            }
          />
          <input
            required
            value={draft.company}
            onChange={(event) => onChange({ ...draft, company: event.target.value })}
            className="mt-sm w-full rounded-lg border border-outline-variant bg-white px-md py-sm text-on-surface"
          />
        </label>
        <label className="block">
          <FieldLabel
            label="Start"
            variableControl={
              <TemplateVariableControl
                disabled={templateVariablesDisabled}
                onChange={(value) => onTemplateVariableChange("start_date", value)}
                value={templateVariables.start_date ?? ""}
              />
            }
          />
          <input
            value={draft.startDate}
            onChange={(event) => onChange({ ...draft, startDate: event.target.value })}
            className="mt-sm w-full rounded-lg border border-outline-variant bg-white px-md py-sm text-on-surface"
          />
        </label>
        <label className="block">
          <FieldLabel
            label="End"
            variableControl={
              <TemplateVariableControl
                disabled={templateVariablesDisabled}
                onChange={(value) => onTemplateVariableChange("end_date", value)}
                value={templateVariables.end_date ?? ""}
              />
            }
          />
          <input
            value={draft.endDate}
            onChange={(event) => onChange({ ...draft, endDate: event.target.value })}
            className="mt-sm w-full rounded-lg border border-outline-variant bg-white px-md py-sm text-on-surface"
          />
        </label>
        <div className="block md:col-span-2">
          <FieldLabel
            label="Period"
            variableControl={
              <TemplateVariableControl
                disabled={templateVariablesDisabled}
                onChange={(value) => onTemplateVariableChange("period", value)}
                value={templateVariables.period ?? ""}
              />
            }
          />
          <div className="mt-sm w-full rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm text-on-surface-variant">
            {formatPeriodPreview(draft.startDate, draft.endDate)}
          </div>
        </div>
        <label className="block md:col-span-2">
          <FieldLabel
            label="Description"
            variableControl={
              <TemplateVariableControl
                disabled={templateVariablesDisabled}
                onChange={(value) => onTemplateVariableChange("description", value)}
                value={templateVariables.description ?? ""}
              />
            }
          />
          <textarea
            rows={3}
            value={draft.description}
            onChange={(event) => onChange({ ...draft, description: event.target.value })}
            className="mt-sm w-full rounded-lg border border-outline-variant bg-white px-md py-sm text-on-surface"
          />
        </label>
        <label className="block md:col-span-2">
          <FieldLabel
            label="Achievements"
            variableControl={
              <TemplateVariableControl
                disabled={templateVariablesDisabled}
                onChange={(value) => onTemplateVariableChange("achievements", value)}
                value={templateVariables.achievements ?? ""}
              />
            }
          />
          <textarea
            rows={5}
            value={draft.achievements}
            onChange={(event) => onChange({ ...draft, achievements: event.target.value })}
            className="mt-sm w-full rounded-lg border border-outline-variant bg-white px-md py-sm text-on-surface"
          />
        </label>
        <label className="block md:col-span-2">
          <FieldLabel
            label="Related Skills"
            variableControl={
              <TemplateVariableControl
                disabled={templateVariablesDisabled}
                onChange={(value) => onTemplateVariableChange("skills", value)}
                value={templateVariables.skills ?? ""}
              />
            }
          />
          <input
            value={draft.skills}
            onChange={(event) => onChange({ ...draft, skills: event.target.value })}
            className="mt-sm w-full rounded-lg border border-outline-variant bg-white px-md py-sm text-on-surface"
          />
        </label>
      </div>
      <div className="flex flex-wrap justify-end gap-sm">
        <button
          type="button"
          onClick={onCancel}
          className="px-lg py-sm border border-outline-variant text-on-surface-variant rounded-lg hover:bg-surface-container transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-lg py-sm bg-primary text-on-primary rounded-lg hover:shadow-md transition-all disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}

function EducationForm(props: {
  draft: EducationDraft;
  isSaving: boolean;
  mode: string;
  onCancel: () => void;
  onChange: (draft: EducationDraft) => void;
  onTemplateVariableChange: (
    field: ApiSelectedEducationTemplateField,
    variableName: string,
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  templateVariables: Partial<Record<ApiSelectedEducationTemplateField, string>>;
  templateVariablesDisabled: boolean;
}) {
  const {
    draft,
    isSaving,
    mode,
    onCancel,
    onChange,
    onSubmit,
    onTemplateVariableChange,
    templateVariables,
    templateVariablesDisabled,
  } = props;

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg space-y-md"
    >
      <h5 className="font-headline-md text-on-surface">{mode}</h5>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <label className="block">
          <FieldLabel
            label="Institution"
            variableControl={
              <TemplateVariableControl
                disabled={templateVariablesDisabled}
                onChange={(value) => onTemplateVariableChange("institution", value)}
                value={templateVariables.institution ?? ""}
              />
            }
          />
          <input
            required
            value={draft.institution}
            onChange={(event) => onChange({ ...draft, institution: event.target.value })}
            className="mt-sm w-full rounded-lg border border-outline-variant bg-white px-md py-sm text-on-surface"
          />
        </label>
        <label className="block">
          <FieldLabel
            label="Degree"
            variableControl={
              <TemplateVariableControl
                disabled={templateVariablesDisabled}
                onChange={(value) => onTemplateVariableChange("degree", value)}
                value={templateVariables.degree ?? ""}
              />
            }
          />
          <input
            value={draft.degree}
            onChange={(event) => onChange({ ...draft, degree: event.target.value })}
            className="mt-sm w-full rounded-lg border border-outline-variant bg-white px-md py-sm text-on-surface"
          />
        </label>
        <label className="block">
          <FieldLabel
            label="Field"
            variableControl={
              <TemplateVariableControl
                disabled={templateVariablesDisabled}
                onChange={(value) => onTemplateVariableChange("field", value)}
                value={templateVariables.field ?? ""}
              />
            }
          />
          <input
            value={draft.field}
            onChange={(event) => onChange({ ...draft, field: event.target.value })}
            className="mt-sm w-full rounded-lg border border-outline-variant bg-white px-md py-sm text-on-surface"
          />
        </label>
        <label className="block">
          <FieldLabel
            label="Start"
            variableControl={
              <TemplateVariableControl
                disabled={templateVariablesDisabled}
                onChange={(value) => onTemplateVariableChange("start_date", value)}
                value={templateVariables.start_date ?? ""}
              />
            }
          />
          <input
            value={draft.startDate}
            onChange={(event) => onChange({ ...draft, startDate: event.target.value })}
            className="mt-sm w-full rounded-lg border border-outline-variant bg-white px-md py-sm text-on-surface"
          />
        </label>
        <label className="block">
          <FieldLabel
            label="End"
            variableControl={
              <TemplateVariableControl
                disabled={templateVariablesDisabled}
                onChange={(value) => onTemplateVariableChange("end_date", value)}
                value={templateVariables.end_date ?? ""}
              />
            }
          />
          <input
            value={draft.endDate}
            onChange={(event) => onChange({ ...draft, endDate: event.target.value })}
            className="mt-sm w-full rounded-lg border border-outline-variant bg-white px-md py-sm text-on-surface"
          />
        </label>
        <div className="block md:col-span-2">
          <FieldLabel
            label="Period"
            variableControl={
              <TemplateVariableControl
                disabled={templateVariablesDisabled}
                onChange={(value) => onTemplateVariableChange("period", value)}
                value={templateVariables.period ?? ""}
              />
            }
          />
          <div className="mt-sm w-full rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm text-on-surface-variant">
            {formatPeriodPreview(draft.startDate, draft.endDate)}
          </div>
        </div>
        <label className="block md:col-span-2">
          <FieldLabel
            label="Achievements"
            variableControl={
              <TemplateVariableControl
                disabled={templateVariablesDisabled}
                onChange={(value) => onTemplateVariableChange("achievements", value)}
                value={templateVariables.achievements ?? ""}
              />
            }
          />
          <textarea
            rows={4}
            value={draft.achievements}
            onChange={(event) => onChange({ ...draft, achievements: event.target.value })}
            className="mt-sm w-full rounded-lg border border-outline-variant bg-white px-md py-sm text-on-surface"
          />
        </label>
      </div>
      <div className="flex flex-wrap justify-end gap-sm">
        <button
          type="button"
          onClick={onCancel}
          className="px-lg py-sm border border-outline-variant text-on-surface-variant rounded-lg hover:bg-surface-container transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-lg py-sm bg-primary text-on-primary rounded-lg hover:shadow-md transition-all disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}

function fromApiExperience(experience?: ApiProfileExperience): ExperienceDraft {
  return {
    achievements: (experience?.achievements ?? []).join("\n"),
    company: experience?.company ?? "",
    description: experience?.description ?? "",
    endDate: experience?.endDate ?? "",
    skills: (experience?.skills ?? []).join(", "),
    startDate: experience?.startDate ?? "",
    title: experience?.title ?? "",
  };
}

function toApiExperience(draft: ExperienceDraft): ApiProfileExperience {
  return {
    achievements: splitLines(draft.achievements),
    company: draft.company.trim(),
    description: optionalString(draft.description),
    endDate: optionalString(draft.endDate),
    skills: splitList(draft.skills),
    startDate: optionalString(draft.startDate),
    title: draft.title.trim(),
  };
}

function fromApiEducation(education?: ApiProfileEducation): EducationDraft {
  return {
    achievements: (education?.achievements ?? []).join("\n"),
    degree: education?.degree ?? "",
    endDate: education?.endDate ?? "",
    field: education?.field ?? "",
    institution: education?.institution ?? "",
    startDate: education?.startDate ?? "",
  };
}

function toApiEducation(draft: EducationDraft): ApiProfileEducation {
  return {
    achievements: splitLines(draft.achievements),
    degree: optionalString(draft.degree),
    endDate: optionalString(draft.endDate),
    field: optionalString(draft.field),
    institution: draft.institution.trim(),
    startDate: optionalString(draft.startDate),
  };
}

export function toProfileDetailsPayload(draft: ProfileDetailsDraft): ApiUpdateProfilePayload {
  return {
    email: draft.email.trim(),
    fullName: draft.fullName.trim(),
    links: draft.links.map((link) => link.trim()).filter(Boolean),
    location: optionalString(draft.location),
    profession: optionalString(draft.profession),
    summary: optionalString(draft.summary),
  };
}

function ProfileDetailsForm(props: {
  draft: ProfileDetailsDraft;
  isSaving: boolean;
  linkTemplateVariables: Array<{ variableName?: string }>;
  onCancel: () => void;
  onChange: (draft: ProfileDetailsDraft) => void;
  onLinkTemplateVariableChange: (index: number, variableName: string) => void;
  onLinkTemplateVariableRemove: (index: number) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTemplateVariableChange: (field: SimpleTemplateField, variableName: string) => void;
  templateVariables: Partial<Record<SimpleTemplateField, string>>;
  templateVariablesDisabled: boolean;
}) {
  const {
    draft,
    isSaving,
    linkTemplateVariables,
    onCancel,
    onChange,
    onLinkTemplateVariableChange,
    onLinkTemplateVariableRemove,
    onSubmit,
    onTemplateVariableChange,
    templateVariables,
    templateVariablesDisabled,
  } = props;

  const variableControl = (field: SimpleTemplateField) => (
    <TemplateVariableControl
      disabled={templateVariablesDisabled}
      onChange={(value) => onTemplateVariableChange(field, value)}
      value={templateVariables[field] ?? ""}
    />
  );

  return (
    <form
      className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg mb-xl space-y-md"
      onSubmit={(event) => void onSubmit(event)}
    >
      <div>
        <h4 className="font-headline-md text-on-surface">Profile Details</h4>
        <p className="mt-1 text-sm text-on-surface-variant">
          Each link can use its own variable name in the active CV template.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <label className="block">
          <FieldLabel label="Name" variableControl={variableControl("full_name")} />
          <input
            className="mt-sm w-full rounded-lg border border-outline-variant bg-white px-md py-sm text-on-surface"
            onChange={(event) => onChange({ ...draft, fullName: event.target.value })}
            required
            value={draft.fullName}
          />
        </label>
        <label className="block">
          <FieldLabel label="Profession" variableControl={variableControl("profession")} />
          <input
            className="mt-sm w-full rounded-lg border border-outline-variant bg-white px-md py-sm text-on-surface"
            onChange={(event) => onChange({ ...draft, profession: event.target.value })}
            value={draft.profession}
          />
        </label>
        <label className="block">
          <FieldLabel label="Email" variableControl={variableControl("email")} />
          <input
            className="mt-sm w-full rounded-lg border border-outline-variant bg-white px-md py-sm text-on-surface"
            onChange={(event) => onChange({ ...draft, email: event.target.value })}
            required
            type="email"
            value={draft.email}
          />
        </label>
        <label className="block">
          <FieldLabel label="Location" variableControl={variableControl("location")} />
          <input
            className="mt-sm w-full rounded-lg border border-outline-variant bg-white px-md py-sm text-on-surface"
            onChange={(event) => onChange({ ...draft, location: event.target.value })}
            value={draft.location}
          />
        </label>
        <label className="block md:col-span-2">
          <FieldLabel label="Description" variableControl={variableControl("summary")} />
          <textarea
            className="mt-sm w-full rounded-lg border border-outline-variant bg-white px-md py-sm text-on-surface"
            onChange={(event) => onChange({ ...draft, summary: event.target.value })}
            rows={4}
            value={draft.summary}
          />
        </label>
        <div className="md:col-span-2 space-y-sm">
          <div className="flex items-center justify-between gap-md">
            <span className="font-label-md text-on-surface">Links</span>
            <button
              className="inline-flex items-center gap-1 text-primary font-label-md hover:underline"
              onClick={() => onChange({ ...draft, links: [...draft.links, ""] })}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Add Link
            </button>
          </div>
          {draft.links.map((link, index) => (
            <div className="flex items-center gap-sm" key={index}>
              <input
                className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-white px-md py-sm text-on-surface"
                onChange={(event) => {
                  const links = [...draft.links];
                  links[index] = event.target.value;
                  onChange({ ...draft, links });
                }}
                placeholder="https://example.com"
                type="url"
                value={link}
              />
              <TemplateVariableControl
                disabled={templateVariablesDisabled}
                onChange={(value) => onLinkTemplateVariableChange(index, value)}
                value={linkTemplateVariables[index]?.variableName ?? ""}
              />
              <button
                aria-label={`Remove link ${index + 1}`}
                className="p-2 text-error hover:bg-error-container rounded-lg"
                onClick={() => {
                  onChange({
                    ...draft,
                    links: draft.links.filter((_, itemIndex) => itemIndex !== index),
                  });
                  onLinkTemplateVariableRemove(index);
                }}
                type="button"
              >
                <span className="material-symbols-outlined">delete</span>
              </button>
            </div>
          ))}
          {draft.links.length === 0 && (
            <div className="rounded-lg border border-dashed border-outline-variant px-md py-sm text-sm text-outline">
              No links added.
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-sm">
        <button
          className="px-lg py-sm border border-outline-variant text-on-surface-variant rounded-lg hover:bg-surface-container transition-all"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="px-lg py-sm bg-primary text-on-primary rounded-lg hover:shadow-md transition-all disabled:opacity-60"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? "Saving..." : "Save Details"}
        </button>
      </div>
    </form>
  );
}

function FieldLabel(props: { label: string; variableControl?: ReactNode }) {
  return (
    <span className="flex items-center gap-2 font-label-md text-on-surface">
      {props.label}
      {props.variableControl}
    </span>
  );
}

function TemplateVariableControl(props: {
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [localValue, setLocalValue] = useState(props.value);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isOpen) return;

    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        left: Math.min(rect.left, window.innerWidth - 256),
        top: rect.bottom + 6,
      });
    }

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;

    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (popupRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    const input = inputRef.current;
    if (input) {
      input.focus();
      input.select();
    }

    document.addEventListener("mousedown", handleMouseDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    setLocalValue(props.value);
  }, [isOpen, props.value]);

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const newValue = event.target.value;
    setLocalValue(newValue);
    props.onChange(newValue);
  }

  return (
    <span className="inline-flex">
      <button
        ref={buttonRef}
        className="template-var-btn inline-flex h-7 w-7 items-center justify-center rounded-full text-primary disabled:cursor-not-allowed disabled:opacity-40"
        disabled={props.disabled}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen((current) => !current);
        }}
        type="button"
        title="Set template variable"
      >
        <span className="material-symbols-outlined text-[16px]">tag</span>
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={popupRef}
            className="template-var-popup"
            style={{ left: position.left, top: position.top }}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="template-var-header">
              <span className="template-var-title">Template variable</span>
              <button
                className="template-var-close-btn"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsOpen(false);
                }}
                type="button"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
            <input
              ref={inputRef}
              className="template-var-input"
              onChange={handleInputChange}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") {
                  event.preventDefault();
                  setIsOpen(false);
                }
              }}
              placeholder="e.g. role_name"
              value={localValue}
            />
          </div>,
          document.body,
        )}
    </span>
  );
}

function normalizeVariableAliases(
  aliases?: ApiDocumentTemplateVariableAliases,
): ApiDocumentTemplateVariableAliases {
  return {
    fields: aliases?.fields ?? {},
    linkItems: aliases?.linkItems ?? [],
    selectedEducation: aliases?.selectedEducation
      ? {
          fields: aliases.selectedEducation.fields ?? {},
          items: aliases.selectedEducation.items ?? [],
        }
      : { fields: {} },
    selectedExperiences: aliases?.selectedExperiences
      ? {
          fields: aliases.selectedExperiences.fields ?? {},
          items: aliases.selectedExperiences.items ?? [],
        }
      : { fields: {} },
  };
}

function compactRecord<T extends string>(
  record: Partial<Record<T, string>>,
): Partial<Record<T, string>> {
  const entries = Object.entries(record) as [T, string | undefined][];

  return Object.fromEntries(
    entries.filter((entry): entry is [T, string] => Boolean(entry[1]?.trim())),
  ) as Partial<Record<T, string>>;
}

function formatPeriodPreview(startDate: string, endDate: string): string {
  const start = startDate.trim();
  const end = endDate.trim();

  if (!start && !end) {
    return "Period";
  }

  return [start, end].filter(Boolean).join(" - ");
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
