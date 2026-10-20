import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ApplicationPackWorkflowPreview,
  JobProcessingWorkflowPreview,
  ProfileWorkflowPreview,
  TailoringTipsWorkflowPreview,
} from "./workflow-preview";

describe("marketing workflow previews", () => {
  it("shows the career profile data that grounds generated documents", () => {
    render(<ProfileWorkflowPreview />);

    expect(
      screen.getByRole("img", { name: "Fictional Careerden career profile workflow preview" }),
    ).toBeVisible();
    expect(screen.getByText("Career profile")).toBeVisible();
    expect(screen.getAllByText("Professional summary").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Skills").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Experience").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Alex Morgan").length).toBeGreaterThan(0);
  });

  it("mirrors the current workspace navigation and credit balance", () => {
    render(<ProfileWorkflowPreview />);

    expect(screen.getByText("Credits & billing")).toBeVisible();
    expect(screen.getByText("8 credits")).toBeVisible();
    expect(screen.queryByText("Templates")).not.toBeInTheDocument();
  });

  it("shows one full Application Overview state without compositing other states", () => {
    render(<JobProcessingWorkflowPreview />);

    expect(
      screen.getByRole("img", {
        name: "Fictional Careerden application Overview workflow preview",
      }),
    ).toBeVisible();
    expect(screen.getByText("Application")).toBeVisible();
    expect(screen.getByText("Senior Full-Stack Product Engineer (Web Platform)")).toBeVisible();
    expect(screen.getByText("Applied (current)")).toBeVisible();
    expect(screen.getByText("View application pack")).toBeVisible();
    expect(screen.getByText("Overview")).toBeVisible();
    expect(screen.getByText("Role summary")).toBeVisible();
    expect(screen.getByText("At a glance")).toBeVisible();
    expect(screen.getByText("Job details")).toBeVisible();
    expect(screen.getByText("Company details")).toBeVisible();
    expect(screen.getByText("Company website")).toBeVisible();
    expect(screen.getByText("careers.google.com")).toBeVisible();
    expect(screen.queryByText("After desktop submission")).not.toBeInTheDocument();
    expect(screen.queryByText("Add & process")).not.toBeInTheDocument();
  });

  it("shows the match analysis beside the live CV preview and improvement tips", () => {
    render(<ApplicationPackWorkflowPreview />);

    expect(
      screen.getByRole("img", {
        name: "Fictional Careerden application pack with live CV preview and improvement tips",
      }),
    ).toBeVisible();
    expect(screen.getAllByText("Application pack").length).toBeGreaterThan(0);
    expect(
      screen.getByLabelText("Matched: Strong TypeScript and React product development"),
    ).toBeVisible();
    expect(
      screen.getByLabelText("Partially matched: Building scalable frontend systems"),
    ).toBeVisible();
    expect(screen.getByLabelText("Missing: Google Cloud Platform")).toBeVisible();
    expect(screen.getByText("Review before applying")).toBeVisible();
    expect(screen.getByText("View match evidence", { exact: false })).toBeVisible();
    expect(screen.getByText("Tailored CV")).toBeVisible();
    expect(screen.getByText("Cover letter")).toBeVisible();
    expect(screen.getByText("1 page")).toBeVisible();
    expect(screen.getByText("Improvement tips")).toBeVisible();
    expect(screen.getByText("Job keywords in your CV")).toBeVisible();
    expect(screen.getByText("Apply all (2)")).toBeVisible();
    expect(screen.getByText("Fill the gaps")).toBeVisible();
    expect(screen.getByText("Customize this pack")).toBeVisible();
    expect(screen.getByText("Update pack")).toBeVisible();
    expect(screen.queryByText("DOCX")).not.toBeInTheDocument();
    expect(screen.queryByText("Rendered PDF")).not.toBeInTheDocument();
  });

  it("shows a tip as a reviewable suggested change", () => {
    render(<TailoringTipsWorkflowPreview />);

    expect(
      screen.getByRole("img", {
        name: "Fictional Careerden improvement tip review workflow preview",
      }),
    ).toBeVisible();
    expect(screen.getByLabelText("Suggested change for Summary")).toBeVisible();
    expect(
      screen.getByText("Also save this to my profile, so future applications can use it"),
    ).toBeVisible();
    expect(screen.getByText("Accept")).toBeVisible();
    expect(screen.getByText("Discard")).toBeVisible();
    expect(screen.getByText("Undo")).toBeVisible();
    expect(screen.getAllByText("Design systems").length).toBeGreaterThan(0);
    expect(screen.getByText("Writing checks")).toBeVisible();
  });
});
