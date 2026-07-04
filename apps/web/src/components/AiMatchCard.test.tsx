import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiDocumentContent } from "../api/types";
import type { JobApplication } from "../types";
import AiMatchCard from "./AiMatchCard.js";

describe("AiMatchCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders useful links for missing skills", () => {
    render(
      <AiMatchCard
        aiMatch={createAiMatch()}
        canCreateCv
        documentContent={createDocumentContent()}
        hasGeneratedDocuments={false}
        isCreatingCv={false}
        isSavingContent={false}
        onCreateCv={vi.fn()}
        onSaveContent={vi.fn()}
      />,
    );

    expect(screen.getByText("Useful links for missing skills")).toBeInTheDocument();
    expect(screen.getByText("Covers Node.js fundamentals.")).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /Node.js Learn/ });
    expect(link).toHaveAttribute("href", "https://nodejs.org/en/learn");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("renders requirement analysis in matched, partially matched, and unmatched groups", () => {
    render(
      <AiMatchCard
        aiMatch={createAiMatch()}
        canCreateCv
        documentContent={createDocumentContent()}
        hasGeneratedDocuments={false}
        isCreatingCv={false}
        isSavingContent={false}
        onCreateCv={vi.fn()}
        onSaveContent={vi.fn()}
      />,
    );

    expect(screen.getByText("Requirement Analysis")).toBeInTheDocument();
    expect(screen.getByText("Matched Requirements")).toBeInTheDocument();
    expect(screen.getByText("Partially Matched Requirements")).toBeInTheDocument();
    expect(screen.getByText("Unmatched Requirements")).toBeInTheDocument();
    expect(screen.getByText("Build React product UI")).toBeInTheDocument();
    expect(screen.getByText("Built accessible UI with React.")).toBeInTheDocument();
    expect(screen.getByText("Work with backend APIs")).toBeInTheDocument();
    expect(screen.getByText("Frontend API integration experience.")).toBeInTheDocument();
    expect(screen.getByText("Ship Node.js services")).toBeInTheDocument();
  });

  it("does not render useful links when resources are absent", () => {
    render(
      <AiMatchCard
        aiMatch={{ ...createAiMatch(), missingSkillResources: [] }}
        canCreateCv
        documentContent={createDocumentContent()}
        hasGeneratedDocuments={false}
        isCreatingCv={false}
        isSavingContent={false}
        onCreateCv={vi.fn()}
        onSaveContent={vi.fn()}
      />,
    );

    expect(screen.queryByText("Useful links for missing skills")).not.toBeInTheDocument();
  });

  it("renders summary with the same actual and AI enhanced comparison labels as experience", () => {
    render(
      <AiMatchCard
        aiMatch={createAiMatch()}
        canCreateCv
        documentContent={createDocumentContent()}
        hasGeneratedDocuments={false}
        isCreatingCv={false}
        isSavingContent={false}
        onCreateCv={vi.fn()}
        onSaveContent={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Summary/ }));

    expect(screen.getByText("Profile Summary")).toBeInTheDocument();
    expect(screen.getByText("Actual Version")).toBeInTheDocument();
    expect(screen.getByText("AI Enhanced Version")).toBeInTheDocument();
    expect(screen.queryByText("Original Profile Summary")).not.toBeInTheDocument();
    expect(screen.queryByText("Tailored CV Summary")).not.toBeInTheDocument();
  });

  it("stores experience description selection for document generation", async () => {
    const onSaveContent = vi.fn(async () => undefined);

    render(
      <AiMatchCard
        aiMatch={{
          ...createAiMatch(),
          experienceOptimizations: [
            {
              title: "Frontend Engineer",
              company: "Acme",
              items: [
                {
                  actual: "Built accessible UI.",
                  enhanced: "Built accessible React UI for product teams.",
                  kind: "description",
                },
              ],
            },
          ],
        }}
        canCreateCv
        documentContent={{
          ...createDocumentContent(),
          experienceEnhancements: [
            {
              experienceIndex: 0,
              description: {
                version: 1,
                blocks: [
                  {
                    type: "paragraph",
                    children: [{ type: "text", text: "Built accessible React UI." }],
                  },
                ],
              },
              achievements: [],
            },
          ],
        }}
        hasGeneratedDocuments={false}
        isCreatingCv={false}
        isSavingContent={false}
        onCreateCv={vi.fn()}
        onSaveContent={onSaveContent}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Experience/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Original" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Approval/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /I approve these CV changes./ }));
    fireEvent.click(screen.getByRole("button", { name: "Create CV" }));

    await waitFor(() => {
      expect(onSaveContent).toHaveBeenCalledWith(
        expect.objectContaining({
          selections: expect.objectContaining({
            experience: {
              "0": {
                description: "original",
                achievements: {},
              },
            },
          }),
        }),
      );
    });
  });
});

function createAiMatch(): NonNullable<JobApplication["aiMatch"]> {
  return {
    score: 62,
    summary: "Review missing backend skills before applying.",
    keywords: [
      { keyword: "React", match: true },
      { keyword: "Node.js", match: false },
    ],
    requirements: [
      {
        requirement: "Build React product UI",
        status: "matched",
        evidence: ["Built accessible UI with React."],
      },
      {
        requirement: "Work with backend APIs",
        status: "partial",
        evidence: ["Frontend API integration experience."],
      },
      {
        requirement: "Ship Node.js services",
        status: "missing",
        evidence: [],
      },
    ],
    recommendation: "Review before applying",
    currentSummary: "Frontend engineer.",
    enhancedSummary: "Frontend engineer with React experience.",
    bulletOptimizations: [],
    experienceOptimizations: [],
    yourSkills: ["React"],
    suggestedSkills: ["Node.js"],
    missingSkillResources: [
      {
        skill: "Node.js",
        title: "Node.js Learn",
        type: "documentation",
        url: "https://nodejs.org/en/learn",
        reason: "Covers Node.js fundamentals.",
      },
    ],
  };
}

function createDocumentContent(): ApiDocumentContent {
  return {
    customizedSummary: {
      version: 1,
      blocks: [{ type: "paragraph", children: [{ type: "text", text: "Summary" }] }],
    },
    experienceEnhancements: [],
    skillSuggestions: [],
    educationEnhancements: [],
    projectEnhancements: [],
    certificationSuggestions: [],
    selections: {
      experience: {},
      education: {},
      projects: {},
    },
  };
}
