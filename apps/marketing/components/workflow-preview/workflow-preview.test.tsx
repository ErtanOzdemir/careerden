import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ApplicationPackWorkflowPreview,
  JobProcessingWorkflowPreview,
  ProfileWorkflowPreview,
  TemplateUploadWorkflowPreview,
  VariableMappingWorkflowPreview,
} from "./workflow-preview";

describe("marketing workflow previews", () => {
  it("shows the career profile data that grounds generated documents", () => {
    render(<ProfileWorkflowPreview />);

    expect(
      screen.getByRole("img", { name: "Fictional Link2CV career profile workflow preview" }),
    ).toBeVisible();
    expect(screen.getByText("Career profile")).toBeVisible();
    expect(screen.getAllByText("Professional summary").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Skills").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Experience").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Alex Morgan").length).toBeGreaterThan(0);
  });

  it("shows separate CV and cover-letter DOCX uploads", () => {
    render(<TemplateUploadWorkflowPreview />);

    expect(
      screen.getByRole("img", {
        name: "Fictional Link2CV document template upload workflow preview",
      }),
    ).toBeVisible();
    expect(screen.getByText("Upload CV template")).toBeVisible();
    expect(screen.getByText("Upload cover letter template")).toBeVisible();
    expect(screen.getAllByText("Browse DOCX")).toHaveLength(2);
    expect(screen.getByText("alex-product-cv.docx")).toBeVisible();
    expect(screen.getByText("alex-engineering-cv.docx")).toBeVisible();
    expect(screen.getByText("alex-cover-letter.docx")).toBeVisible();
    expect(screen.getByText("Mapping required")).toBeVisible();
    expect(
      screen.queryByText(/Map Content before using the cover letter template/),
    ).not.toBeInTheDocument();
  });

  it("shows the real inline cover-letter Content mapping state", () => {
    render(<VariableMappingWorkflowPreview />);

    expect(
      screen.getByRole("img", {
        name: "Fictional Link2CV template variable mapping workflow preview",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(/Content supports rich formatting, so its DOCX placeholder/),
    ).toBeVisible();
    expect(screen.getByText("{{content}}")).toBeVisible();
    expect(screen.getByText("Reviewed cover-letter body")).toBeVisible();
    expect(screen.getByText("Save Mapping")).toBeVisible();
    expect(screen.getByText("Default template")).toBeVisible();
    expect(screen.getByText("Delete template")).toBeVisible();
    expect(screen.queryByText("DOCX placeholder")).not.toBeInTheDocument();
    expect(screen.queryByText("Focused detail")).not.toBeInTheDocument();
  });

  it("shows one full Application Overview state without compositing other states", () => {
    render(<JobProcessingWorkflowPreview />);

    expect(
      screen.getByRole("img", {
        name: "Fictional Link2CV application Overview workflow preview",
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

  it("shows generated documents, match evidence, and editable pack choices", () => {
    render(<ApplicationPackWorkflowPreview />);

    expect(
      screen.getByRole("img", {
        name: "Fictional Link2CV application pack and customization workflow preview",
      }),
    ).toBeVisible();
    expect(screen.getAllByText("Application pack").length).toBeGreaterThan(0);
    expect(
      screen.getByLabelText("Matched: TypeScript and React product development"),
    ).toBeVisible();
    expect(screen.getByText("4 requirements supported")).toBeVisible();
    expect(
      screen.getByLabelText("Partially matched: Building scalable frontend systems"),
    ).toBeVisible();
    expect(screen.getByLabelText("Missing: Google Cloud Platform")).toBeVisible();
    expect(screen.getByText("Review before applying")).toBeVisible();
    expect(screen.getByText("View match evidence", { exact: false })).toBeVisible();
    expect(screen.getByText("Tailored CV")).toBeVisible();
    expect(screen.getAllByText("Cover letter").length).toBeGreaterThan(0);
    expect(screen.getByText("Documents ready")).toBeVisible();
    expect(screen.getAllByText("Rendered PDF")).toHaveLength(2);
    expect(screen.getAllByText("DOCX")).toHaveLength(2);
    expect(screen.getByText("Customize this pack")).toBeVisible();
    expect(screen.getByText("Content source")).toBeVisible();
    expect(screen.getByText("Use AI")).toBeVisible();
    expect(screen.getByText("Use profile")).toBeVisible();
    expect(screen.getByText("Update pack")).toBeVisible();
  });
});
