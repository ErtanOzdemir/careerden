import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiProfileSkillGroup } from "../api/types.js";
import {
  editableSkillGroups,
  SkillGroupsEditor,
  skillGroupsError,
  SkillGroupsView,
} from "./SkillGroupsEditor.js";

afterEach(() => {
  cleanup();
});

function Harness({
  initial,
  onChange,
}: {
  initial: ApiProfileSkillGroup[];
  onChange: (groups: ApiProfileSkillGroup[]) => void;
}) {
  const [groups, setGroups] = useState(editableSkillGroups(initial));
  return (
    <SkillGroupsEditor
      groups={groups}
      onChange={(next) => {
        setGroups(next);
        onChange(next);
      }}
    />
  );
}

function renderEditor(initial: ApiProfileSkillGroup[]) {
  const onChange = vi.fn<(groups: ApiProfileSkillGroup[]) => void>();
  render(<Harness initial={initial} onChange={onChange} />);
  return () => onChange.mock.lastCall?.[0];
}

describe("SkillGroupsView", () => {
  it("shows uncategorized skills without headings", () => {
    render(<SkillGroupsView groups={[{ name: "", skills: ["TypeScript", "SQL"] }]} />);

    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("shows each category under its name, with uncategorized skills as Other", () => {
    render(
      <SkillGroupsView
        groups={[
          { name: "DevOps", skills: ["AWS"] },
          { name: "", skills: ["Excel"] },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "DevOps" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Other" })).toBeInTheDocument();
  });
});

describe("editableSkillGroups", () => {
  it("puts one uncategorized group last", () => {
    expect(
      editableSkillGroups([
        { name: "", skills: ["Git"] },
        { name: "DevOps", skills: ["Docker"] },
      ]),
    ).toEqual([
      { name: "DevOps", skills: ["Docker"] },
      { name: "", skills: ["Git"] },
    ]);
    expect(editableSkillGroups([{ name: "DevOps", skills: ["Docker"] }])).toEqual([
      { name: "DevOps", skills: ["Docker"] },
      { name: "", skills: [] },
    ]);
  });
});

describe("skillGroupsError", () => {
  it("rejects a category whose name was cleared", () => {
    expect(
      skillGroupsError([
        { name: " ", skills: ["Docker"] },
        { name: "", skills: ["Git"] },
      ]),
    ).toBe("Name every category or remove it before saving.");
    expect(
      skillGroupsError([
        { name: "DevOps", skills: ["Docker"] },
        { name: "", skills: ["Git"] },
      ]),
    ).toBeNull();
  });
});

describe("SkillGroupsEditor", () => {
  it("adds a category and a skill to it", () => {
    const latest = renderEditor([{ name: "", skills: ["Excel"] }]);

    fireEvent.change(screen.getByLabelText("New category"), { target: { value: "DevOps" } });
    fireEvent.click(screen.getByRole("button", { name: "Add category" }));
    fireEvent.change(screen.getByLabelText("New skill in DevOps"), {
      target: { value: "Kubernetes" },
    });
    fireEvent.keyDown(screen.getByLabelText("New skill in DevOps"), { key: "Enter" });

    expect(latest()).toEqual([
      { name: "DevOps", skills: ["Kubernetes"] },
      { name: "", skills: ["Excel"] },
    ]);
  });

  it("ignores a skill that is already in another category", () => {
    const latest = renderEditor([{ name: "DevOps", skills: ["AWS"] }]);

    fireEvent.change(screen.getByLabelText("New skill"), { target: { value: " aws " } });
    fireEvent.click(screen.getByRole("button", { name: "Add new skill" }));

    expect(latest()).toBeUndefined();
    expect(screen.getByLabelText("New skill")).toHaveValue(" aws ");
  });

  it("moves a skill between categories", () => {
    const latest = renderEditor([
      { name: "DevOps", skills: ["AWS", "React"] },
      { name: "Frontend", skills: [] },
    ]);

    const select = screen.getByLabelText("Move React to category");
    fireEvent.change(select, { target: { value: "1" } });

    expect(latest()).toEqual([
      { name: "DevOps", skills: ["AWS"] },
      { name: "Frontend", skills: ["React"] },
      { name: "", skills: [] },
    ]);
  });

  it("renames a category", () => {
    const latest = renderEditor([{ name: "Devops", skills: ["AWS"] }]);

    fireEvent.change(screen.getByLabelText("Category name for Devops"), {
      target: { value: "DevOps" },
    });

    expect(latest()?.[0]).toEqual({ name: "DevOps", skills: ["AWS"] });
  });

  it("keeps a category editable while its name is cleared and retyped", () => {
    const latest = renderEditor([
      { name: "DevOps", skills: ["Docker"] },
      { name: "", skills: ["Git"] },
    ]);

    const nameInput = screen.getByLabelText("Category name for DevOps");
    nameInput.focus();
    fireEvent.change(nameInput, { target: { value: "" } });

    expect(screen.getByLabelText("Category name for Unnamed category")).toBe(nameInput);
    expect(nameInput).toHaveFocus();
    expect(screen.getByText("Name this category or remove it.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Uncategorized" })).toBeInTheDocument();
    expect(screen.getAllByRole("textbox", { name: /^Category name/ })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Remove category Other" })).not.toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: "Cloud" } });

    expect(latest()).toEqual([
      { name: "Cloud", skills: ["Docker"] },
      { name: "", skills: ["Git"] },
    ]);
    expect(screen.queryByText("Name this category or remove it.")).not.toBeInTheDocument();
  });

  it("keeps the skills of a removed category as uncategorized", () => {
    const latest = renderEditor([
      { name: "DevOps", skills: ["AWS"] },
      { name: "", skills: ["Excel"] },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Remove category DevOps" }));

    expect(latest()).toEqual([{ name: "", skills: ["Excel", "AWS"] }]);
  });

  it("removes a single skill", () => {
    const latest = renderEditor([{ name: "", skills: ["Excel", "Word"] }]);

    fireEvent.click(screen.getByRole("button", { name: "Remove Word" }));

    expect(latest()).toEqual([{ name: "", skills: ["Excel"] }]);
  });

  it("suggests common category names that are not used yet", () => {
    renderEditor([{ name: "DevOps", skills: ["AWS"] }]);

    const suggestions = document.getElementById("skill-group-suggestions");
    const values = within(suggestions as HTMLElement)
      .queryAllByRole("option", { hidden: true })
      .map((option) => option.getAttribute("value"));
    expect(values).toContain("Frontend");
    expect(values).not.toContain("DevOps");
  });
});
