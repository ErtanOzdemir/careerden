import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DownloadPage, { metadata } from "./page";

describe("desktop download page", () => {
  it("shows configured package targets without presenting a fake installer", () => {
    render(<DownloadPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Download your job application tracker." }),
    ).toBeVisible();
    expect(screen.getByText("DMG")).toBeVisible();
    expect(screen.getByText("NSIS installer")).toBeVisible();
    expect(screen.getByText("AppImage")).toBeVisible();
    expect(screen.getByText("Desktop installers are coming soon.")).toBeVisible();
    expect(screen.getByText(/No public installer artifacts are available yet/i)).toBeVisible();

    for (const platform of ["macOS", "Windows", "Linux"]) {
      expect(
        screen.getByRole("link", { name: new RegExp(`Preview ${platform} download`, "i") }),
      ).toHaveAttribute("href", "/download#installer-coming-soon");
    }
    expect(screen.getByRole("link", { name: /View Careerden on GitHub/i })).toHaveAttribute(
      "href",
      "https://github.com/ErtanOzdemir/careerden",
    );
  });

  it("publishes unique, indexable metadata", () => {
    expect(metadata.title).toBe("Download Careerden for Desktop | Careerden");
    expect(metadata.description).toMatch(/macOS, Windows, or Linux/);
    expect(metadata.alternates).toMatchObject({
      canonical: expect.stringMatching(/\/download$/),
    });
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.openGraph).toMatchObject({
      title: "Download Careerden for Desktop | Careerden",
      url: expect.stringMatching(/\/download$/),
    });
  });
});
