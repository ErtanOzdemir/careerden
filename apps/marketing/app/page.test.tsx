import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage, { metadata } from "./page";

describe("marketing workflow story", () => {
  it("presents the five real product stages in order", () => {
    const { container } = render(<HomePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Track every job application." }),
    ).toBeVisible();
    const steps = [...container.querySelectorAll(".workflow-step-copy > h3")].map(
      (heading) => heading.textContent,
    );

    expect(steps).toEqual([
      "Add your profile",
      "Upload your templates",
      "Connect profile data to the DOCX",
      "Add your first application",
      "Review the pack and track progress",
    ]);
    expect(
      screen.getByText("Built-in layouts remain available if you do not add custom templates."),
    ).toBeVisible();
    expect(screen.getByText("Keep the whole job search in view.")).toBeVisible();
    expect(screen.getByText("See every application and stage")).toBeVisible();
    expect(screen.getByText("Remember every follow-up")).toBeVisible();
    expect(screen.getAllByText("Job application tracker").length).toBeGreaterThan(0);
    expect(screen.getByText("CV creator")).toBeVisible();
    expect(screen.getByText("Cover letter creator")).toBeVisible();
    expect(screen.getByRole("link", { name: "Explore Link2CV on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/ErtanOzdemir/link2cv",
    );
    expect(screen.getAllByText(/manual application entry.*not available/i).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText(/browser-only.*manual job/i)).not.toBeInTheDocument();
    const structuredData = container.querySelector(
      'script[type="application/ld+json"]',
    )?.textContent;
    expect(structuredData).toContain('"operatingSystem":"Desktop"');
    expect(structuredData).toContain('"codeRepository":"https://github.com/ErtanOzdemir/link2cv"');
  });

  it("keeps public actions inside the desktop product explanation", () => {
    render(<HomePage />);

    for (const link of screen.getAllByRole("link", { name: /download desktop app/i })) {
      expect(link).toHaveAttribute("href", "/download");
    }
    expect(screen.getByRole("link", { name: /see the tracking workspace/i })).toHaveAttribute(
      "href",
      "#application-tracking",
    );
    expect(
      screen.queryByRole("link", { name: /sign in|get started|create account/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /guided setup/i })).not.toBeInTheDocument();
  });

  it("uses tracking-first search and social metadata", () => {
    expect(metadata.title).toBe("Desktop Job Application Tracker & CV Creator | Link2CV");
    expect(metadata.description).toMatch(/open-source desktop job application tracker/);
    expect(metadata.openGraph).toMatchObject({
      description: expect.stringMatching(/open-source desktop job application tracker/),
    });
  });
});
