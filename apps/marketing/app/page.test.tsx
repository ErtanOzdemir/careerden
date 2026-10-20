import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage, { metadata } from "./page";

describe("marketing workflow story", () => {
  it("presents the four real product stages in order", () => {
    const { container } = render(<HomePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Track every job application." }),
    ).toBeVisible();
    const steps = [...container.querySelectorAll(".workflow-step-copy > h3")].map(
      (heading) => heading.textContent,
    );

    expect(steps).toEqual([
      "Add your profile",
      "Add your first application",
      "Review the tailored CV",
      "Accept only what you can back up",
    ]);
    expect(screen.queryByText(/DOCX/)).not.toBeInTheDocument();
    expect(screen.getByText("Keep the whole job search in view.")).toBeVisible();
    expect(screen.getByText("See every application and stage")).toBeVisible();
    expect(screen.getByText("Remember every follow-up")).toBeVisible();
    expect(screen.getAllByText("Job application tracker").length).toBeGreaterThan(0);
    expect(screen.getByText("CV creator")).toBeVisible();
    expect(screen.getByText("Cover letter creator")).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: "Track for free. Add more AI credits when you need them.",
      }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "$0 forever" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "$10 USD / month" })).toBeVisible();
    expect(screen.getByText("10 AI credits every UTC calendar month")).toBeVisible();
    expect(screen.getByText("100 credits for each confirmed paid period")).toBeVisible();
    expect(screen.getByText("Taxes may be added at checkout.")).toBeVisible();
    expect(screen.getByText("What does a UTC calendar month mean?")).toBeInTheDocument();
    expect(
      screen.getByText(/Your 10 free credits apply to that shared month—not one month/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Subscribe in the desktop app" })).toHaveAttribute(
      "href",
      "/download",
    );
    expect(screen.getByRole("link", { name: "Explore Careerden on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/ErtanOzdemir/careerden",
    );
    expect(screen.getAllByText(/paste job and company details manually/i).length).toBeGreaterThan(
      0,
    );
    const structuredData = container.querySelector(
      'script[type="application/ld+json"]',
    )?.textContent;
    expect(structuredData).toContain('"operatingSystem":"Desktop"');
    expect(structuredData).toContain(
      '"codeRepository":"https://github.com/ErtanOzdemir/careerden"',
    );
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
    expect(metadata.title).toBe("Desktop Job Application Tracker & CV Creator | Careerden");
    expect(metadata.description).toMatch(/open-source desktop job application tracker/);
    expect(metadata.openGraph).toMatchObject({
      description: expect.stringMatching(/open-source desktop job application tracker/),
    });
  });
});
