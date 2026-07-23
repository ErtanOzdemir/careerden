import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DownloadPage, { metadata } from "./page";

describe("desktop download page", () => {
  it("offers the published desktop packages for every supported platform", () => {
    render(<DownloadPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: /Your job search,\s*now on desktop\./i }),
    ).toBeVisible();
    const assets = {
      "Careerden-0.2.0-universal.dmg":
        "https://github.com/ErtanOzdemir/careerden/releases/download/v0.2.0/Careerden-0.2.0-universal.dmg",
      "Careerden-0.2.0-x64.exe":
        "https://github.com/ErtanOzdemir/careerden/releases/download/v0.2.0/Careerden-0.2.0-x64.exe",
      "Careerden-0.2.0-x86_64.AppImage":
        "https://github.com/ErtanOzdemir/careerden/releases/download/v0.2.0/Careerden-0.2.0-x86_64.AppImage",
    };

    for (const [fileName, url] of Object.entries(assets)) {
      expect(screen.getByRole("link", { name: new RegExp(fileName, "i") })).toHaveAttribute(
        "href",
        url,
      );
    }
    expect(screen.getByRole("link", { name: /Explore Careerden on GitHub/i })).toHaveAttribute(
      "href",
      "https://github.com/ErtanOzdemir/careerden",
    );
  });

  it("publishes unique, indexable metadata", () => {
    expect(metadata.title).toBe("Download Careerden for Desktop | Careerden");
    expect(metadata.description).toMatch(/macOS, Windows, or Linux/);
    expect(metadata.description).toMatch(/selected automatically/);
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
