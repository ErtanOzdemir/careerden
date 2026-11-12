import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  hasNamedSkillGroups,
  SUGGESTED_SKILL_GROUP_NAMES,
  UNCATEGORIZED_SKILL_GROUP_LABEL,
} from "@careerden/contracts";
import type { ApiProfileSkillGroup } from "../api/types.js";

const chipClassName =
  "rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground";
const dashedInputClassName =
  "rounded-full border border-dashed border-border bg-transparent px-3 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring";
const dashedButtonClassName =
  "flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground";

/**
 * Returns the groups the editor starts from: the saved ones plus an uncategorized group, so there is
 * always somewhere to add a skill that does not belong to a category yet.
 */
export function editableSkillGroups(groups: ApiProfileSkillGroup[]): ApiProfileSkillGroup[] {
  const copy = groups.map((group) => ({ name: group.name, skills: [...group.skills] }));
  return copy.some((group) => !group.name.trim()) ? copy : [...copy, { name: "", skills: [] }];
}

export function SkillGroupsView({ groups }: { groups: ApiProfileSkillGroup[] }) {
  const visible = groups.filter((group) => group.skills.length > 0);
  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">No skills added yet.</p>;
  }

  if (!hasNamedSkillGroups(visible)) {
    return <SkillChips skills={visible.flatMap((group) => group.skills)} />;
  }

  return (
    <div className="space-y-4">
      {visible.map((group, index) => (
        <div key={`${group.name}-${index}`}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.name.trim() || UNCATEGORIZED_SKILL_GROUP_LABEL}
          </h3>
          <SkillChips skills={group.skills} />
        </div>
      ))}
    </div>
  );
}

function SkillChips({ skills }: { skills: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill) => (
        <span key={skill} className={chipClassName}>
          {skill}
        </span>
      ))}
    </div>
  );
}

/**
 * Edits categories and their skills: add, rename, and remove categories, and add, remove, or move
 * skills between them. Removing a category keeps its skills by moving them to the uncategorized group.
 * A skill appears once across all categories, so adding one that already exists does nothing.
 */
export function SkillGroupsEditor({
  groups,
  onChange,
}: {
  groups: ApiProfileSkillGroup[];
  onChange: (groups: ApiProfileSkillGroup[]) => void;
}) {
  const [newGroupName, setNewGroupName] = useState("");
  const usedNames = new Set(groups.map((group) => skillKey(group.name)));
  const suggestions = SUGGESTED_SKILL_GROUP_NAMES.filter((name) => !usedNames.has(skillKey(name)));
  const uncategorizedIndex = groups.findIndex((group) => !group.name.trim());

  function hasSkill(skill: string) {
    const key = skillKey(skill);
    return groups.some((group) => group.skills.some((existing) => skillKey(existing) === key));
  }

  function update(index: number, change: (group: ApiProfileSkillGroup) => ApiProfileSkillGroup) {
    onChange(groups.map((group, groupIndex) => (groupIndex === index ? change(group) : group)));
  }

  function addSkill(index: number, value: string): boolean {
    const skill = value.trim();
    if (!skill || hasSkill(skill)) return false;
    update(index, (group) => ({ ...group, skills: [...group.skills, skill] }));
    return true;
  }

  function removeSkill(index: number, skill: string) {
    update(index, (group) => ({
      ...group,
      skills: group.skills.filter((existing) => existing !== skill),
    }));
  }

  function moveSkill(from: number, to: number, skill: string) {
    if (from === to) return;
    onChange(
      groups.map((group, index) => {
        if (index === from) {
          return { ...group, skills: group.skills.filter((existing) => existing !== skill) };
        }
        if (index === to) return { ...group, skills: [...group.skills, skill] };
        return group;
      }),
    );
  }

  function removeGroup(index: number) {
    const removed = groups[index];
    if (!removed) return;
    const remaining = groups.filter((_group, groupIndex) => groupIndex !== index);
    const target = remaining.findIndex((group) => !group.name.trim());
    onChange(
      target === -1
        ? [...remaining, { name: "", skills: removed.skills }]
        : remaining.map((group, groupIndex) =>
            groupIndex === target
              ? { ...group, skills: [...group.skills, ...removed.skills] }
              : group,
          ),
    );
  }

  function addGroup() {
    const name = newGroupName.trim();
    if (!name || usedNames.has(skillKey(name))) return;
    // New categories go before the uncategorized group, which always comes last.
    const insertAt = uncategorizedIndex === -1 ? groups.length : uncategorizedIndex;
    onChange([...groups.slice(0, insertAt), { name, skills: [] }, ...groups.slice(insertAt)]);
    setNewGroupName("");
  }

  const moveTargets = groups.map((group, index) => ({
    index,
    label: group.name.trim() || UNCATEGORIZED_SKILL_GROUP_LABEL,
  }));

  return (
    <div className="space-y-4">
      {groups.map((group, index) => {
        const isUncategorized = !group.name.trim() && index === uncategorizedIndex;
        const label = group.name.trim() || UNCATEGORIZED_SKILL_GROUP_LABEL;

        return (
          <div key={index} className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center gap-2">
              {isUncategorized ? (
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Uncategorized
                </h3>
              ) : (
                <>
                  <input
                    aria-label={`Category name for ${label}`}
                    value={group.name}
                    onChange={(event) =>
                      update(index, (current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Category name"
                    className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 py-1 text-xs font-semibold text-foreground outline-none focus:border-ring"
                  />
                  <button
                    aria-label={`Remove category ${label}`}
                    onClick={() => removeGroup(index)}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
                    type="button"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {group.skills.map((skill) => (
                <span
                  key={skill}
                  className={`${chipClassName} inline-flex items-center gap-1.5 pr-1.5`}
                >
                  {skill}
                  {moveTargets.length > 1 && (
                    <select
                      aria-label={`Move ${skill} to category`}
                      value={index}
                      onChange={(event) => moveSkill(index, Number(event.target.value), skill)}
                      className="max-w-24 rounded bg-transparent text-[11px] text-muted-foreground outline-none"
                    >
                      {moveTargets.map((target) => (
                        <option key={target.index} value={target.index}>
                          {target.label}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    aria-label={`Remove ${skill}`}
                    onClick={() => removeSkill(index, skill)}
                    className="rounded-full text-muted-foreground transition-colors hover:text-destructive"
                    type="button"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <NewSkillInput
                label={isUncategorized ? "New skill" : `New skill in ${label}`}
                onAdd={(value) => addSkill(index, value)}
              />
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-1">
        <input
          aria-label="New category"
          list="skill-group-suggestions"
          value={newGroupName}
          onChange={(event) => setNewGroupName(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && addGroup()}
          placeholder="New category, e.g. DevOps"
          className={`w-48 ${dashedInputClassName}`}
        />
        <datalist id="skill-group-suggestions">
          {suggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <button onClick={addGroup} className={dashedButtonClassName} type="button">
          <Plus className="size-3" />
          Add category
        </button>
      </div>
    </div>
  );
}

function NewSkillInput({ label, onAdd }: { label: string; onAdd: (value: string) => boolean }) {
  const [value, setValue] = useState("");

  function add() {
    if (onAdd(value)) setValue("");
  }

  return (
    <div className="flex items-center gap-1">
      <input
        aria-label={label}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && add()}
        placeholder="Add skill"
        className={`w-24 ${dashedInputClassName}`}
      />
      <button
        aria-label={`Add ${label.charAt(0).toLowerCase()}${label.slice(1)}`}
        onClick={add}
        className={dashedButtonClassName}
        type="button"
      >
        <Plus className="size-3" />
        Add
      </button>
    </div>
  );
}

function skillKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
