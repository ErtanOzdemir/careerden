import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage, { metadata } from "./page";

describe("marketing workflow story", () => {
  it("presents the four real product stages in order", () => {
    const { container } = render(<HomePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Track every job application." }),
    ).toBeVisible();
    const steps = [...container.querySelectorAll("#how-it-works .workflow-step-copy > h3")].map(
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
      screen.getByRole("heading", { name: "Free on your computer. Cloud is coming soon." }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "$0 forever" })).toBeVisible();
    expect(screen.getByText("Available now")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Coming soon" })).toBeVisible();
    expect(screen.getByText("10 AI credits every UTC calendar month")).toBeVisible();
    expect(screen.getByText("Basic plan with 100 credits for $10 USD / month")).toBeVisible();
    expect(screen.getByText(/Cloud plans and credit terms may change before launch/)).toBeVisible();
    expect(screen.getByText("What does a UTC calendar month mean?")).toBeInTheDocument();
    expect(
      screen.getByText(/Your 10 free credits apply to that shared month—not one month/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Subscribe/ })).not.toBeInTheDocument();
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
    expect(structuredData).toContain('"operatingSystem":"macOS"');
    expect(structuredData).toContain('"@type":"FAQPage"');
    expect(structuredData).toContain('"name":"What is Careerden Unplugged?"');
    expect(structuredData).toContain(
      '"codeRepository":"https://github.com/ErtanOzdemir/careerden"',
    );
  });

  it("presents the latest workspace features and Careerden Unplugged as the main product", () => {
    const { container } = render(<HomePage />);

    expect(screen.getByRole("heading", { name: "Pick from six CV layouts" })).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: "Fictional Careerden base resume page with an A4 preview and six CV templates",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Sort by match, interest, salary, or date" }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Fictional Careerden applications list sorted by interest" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Your job search, kept on your device." }),
    ).toBeVisible();
    const unpluggedSection = container.querySelector<HTMLElement>("#unplugged");
    expect(unpluggedSection).not.toBeNull();
    const section = within(unpluggedSection!);
    expect(section.queryByText(/Coming soon/i)).not.toBeInTheDocument();
    expect(section.getByText("Unplugged", { selector: ".unplugged-badge" })).toBeVisible();
    expect(section.getByRole("link", { name: /Download Careerden Unplugged/ })).toHaveAttribute(
      "href",
      "/download#unplugged",
    );
    // The hero introduces Unplugged with the same yellow badge and its primary download.
    expect(container.querySelector(".hero-copy .unplugged-badge")).toBeInTheDocument();
    expect(screen.getByText("Everything stays on your computer")).toBeVisible();
    expect(screen.getByText("What is Careerden Unplugged?")).toBeInTheDocument();
    expect(screen.getByText(/dashboard calendar/)).toBeVisible();
  });

  it("keeps public actions inside the desktop product explanation", () => {
    render(<HomePage />);

    const downloadLinks = screen.getAllByRole("link", { name: /download careerden unplugged/i });
    expect(downloadLinks.length).toBeGreaterThanOrEqual(3);
    for (const link of downloadLinks) {
      expect(link.getAttribute("href")).toMatch(/^\/download/);
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
    expect(metadata.title).toEqual({
      absolute: "Desktop Job Application Tracker & CV Creator | Careerden",
    });
    expect(metadata.description).toMatch(/open-source desktop job application tracker/);
    expect(metadata.openGraph).toMatchObject({
      description: expect.stringMatching(/open-source desktop job application tracker/),
    });
  });
});
