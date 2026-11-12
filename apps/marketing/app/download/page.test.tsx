import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { unpluggedRelease } from "@/lib/desktop-release";
import DownloadPage, { metadata } from "./page";

describe("desktop download page", () => {
  it("offers the Careerden Unplugged macOS packages and hides Windows and Linux", () => {
    const { container } = render(<DownloadPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: /Your job search,\s*on your computer\./i }),
    ).toBeVisible();
    expect(container.querySelector(".download-hero-inner .unplugged-badge")).toHaveTextContent(
      "Unplugged",
    );
    const base = `https://github.com/ErtanOzdemir/careerden/releases/download/v${unpluggedRelease.version}`;
    for (const suffix of ["arm64.dmg", "x64.dmg"]) {
      const fileName = `CareerdenUnplugged-${unpluggedRelease.version}-${suffix}`;
      expect(screen.getByRole("link", { name: new RegExp(fileName, "i") })).toHaveAttribute(
        "href",
        `${base}/${fileName}`,
      );
    }
    expect(container.querySelector('a[href$=".exe"], a[href$=".AppImage"]')).toBeNull();
    expect(screen.queryByRole("heading", { name: /Windows|Linux/ })).not.toBeInTheDocument();
    expect(screen.getByText(/is available for macOS\./)).toBeVisible();
    expect(screen.getByRole("link", { name: /Explore Careerden on GitHub/i })).toHaveAttribute(
      "href",
      "https://github.com/ErtanOzdemir/careerden",
    );
  });

  it("links Unplugged downloads for the version the desktop release will tag", () => {
    const desktopPackage = JSON.parse(
      // Tests run from apps/marketing.
      readFileSync(resolve(process.cwd(), "../desktop/package.json"), "utf8"),
    ) as { version: string };

    expect(unpluggedRelease.version).toBe(desktopPackage.version);
  });

  it("explains Careerden Unplugged and marks Careerden Cloud as coming soon", () => {
    const { container } = render(<DownloadPage />);

    const panel = container.querySelector("#unplugged");
    expect(panel).toBeInTheDocument();
    expect(panel?.querySelector(".unplugged-badge")).toHaveTextContent("Unplugged");
    expect(
      screen.getByRole("heading", { name: "The whole workspace, without a Careerden server." }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /Download Careerden Unplugged/ })).toHaveAttribute(
      "href",
      "#all-downloads",
    );
    expect(screen.getByText("Careerden Cloud · Coming soon")).toBeVisible();
    expect(screen.getByText(/available from any computer you sign in on/)).toBeVisible();
    expect(container.querySelector('a[href*="/Careerden-"]')).not.toBeInTheDocument();
  });

  it("publishes unique, indexable metadata", () => {
    expect(metadata.title).toEqual({
      absolute: "Download Careerden Unplugged for Desktop | Careerden",
    });
    expect(metadata.description).toMatch(/for macOS:/);
    expect(metadata.description).toMatch(/keeps your data on your computer/);
    expect(metadata.alternates).toMatchObject({
      canonical: expect.stringMatching(/\/download$/),
    });
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.openGraph).toMatchObject({
      title: "Download Careerden Unplugged for Desktop | Careerden",
      url: expect.stringMatching(/\/download$/),
    });
  });
});
