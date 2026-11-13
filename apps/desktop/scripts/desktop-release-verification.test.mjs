import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  directoryAssets,
  parseReleaseEditions,
  parseReleasePlatforms,
  parseUpdateMetadata,
  requiredMetadataFiles,
  verifyDesktopRelease,
} from "./desktop-release-verification.mjs";

const run = promisify(execFile);
const cliPath = fileURLToPath(new URL("./verify-desktop-release.mjs", import.meta.url));

const sha512 = (contents) => createHash("sha512").update(contents).digest("base64");
const sha256 = (contents) => createHash("sha256").update(contents).digest("hex");

// The installers each platform's metadata references, by channel and artifact prefix.
function platformArtifacts(prefix, version) {
  return {
    mac: [`${prefix}-${version}-x64.zip`, `${prefix}-${version}-arm64.zip`],
    windows: [`${prefix}-${version}-x64.exe`],
    linux: [`${prefix}-${version}-x86_64.AppImage`],
  };
}

// The layout electron-builder writes, with a quoted release date and the legacy top-level path.
function metadataYaml(version, files) {
  const entries = files
    .map((file) => `  - url: ${file.url}\n    sha512: ${file.sha512}\n    size: ${file.size}`)
    .join("\n");
  return (
    `version: ${version}\nfiles:\n${entries}\npath: ${files[0].url}\n` +
    `sha512: ${files[0].sha512}\nreleaseDate: '2026-11-07T10:00:00.000Z'\n`
  );
}

describe("desktop release verification", () => {
  let directory;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "careerden-release-test-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  // Writes a complete release for these editions, as the workflow's build jobs produce it.
  async function writeRelease(version, editions = ["cloud", "local"]) {
    for (const edition of editions) {
      const channel = edition === "cloud" ? "latest" : "local";
      const prefix = edition === "cloud" ? "Careerden" : "CareerdenUnplugged";
      const artifacts = platformArtifacts(prefix, version);
      for (const [platform, names] of Object.entries(artifacts)) {
        const files = [];
        for (const name of names) {
          const contents = `${name} installer`;
          await writeFile(join(directory, name), contents);
          files.push({ url: name, sha512: sha512(contents), size: contents.length });
        }
        const metadataFile =
          platform === "mac"
            ? `${channel}-mac.yml`
            : platform === "windows"
              ? `${channel}.yml`
              : `${channel}-linux.yml`;
        await writeFile(join(directory, metadataFile), metadataYaml(version, files));
      }
    }
    await writeFile(
      join(directory, "careerden-desktop-update-policy.json"),
      JSON.stringify({ schemaVersion: 1, minimumSupportedVersion: "0.6.0" }),
    );
  }

  async function verify(tag = "v0.8.0", editions = ["cloud", "local"], platforms = undefined) {
    return verifyDesktopRelease({
      tag,
      editions,
      platforms,
      assets: await directoryAssets(directory),
    });
  }

  it("requires the three platform metadata files of every edition", () => {
    expect(requiredMetadataFiles(["cloud", "local"])).toEqual([
      "latest-mac.yml",
      "latest.yml",
      "latest-linux.yml",
      "local-mac.yml",
      "local.yml",
      "local-linux.yml",
    ]);
  });

  it("requires only the metadata files of the released platforms", () => {
    expect(requiredMetadataFiles(["local"], ["macos"])).toEqual(["local-mac.yml"]);
    expect(() => requiredMetadataFiles(["local"], ["solaris"])).toThrow(
      'Unknown desktop platform "solaris"',
    );
  });

  it("accepts a macOS-only release without Windows or Linux metadata", async () => {
    await writeRelease("0.8.0", ["local"]);
    for (const name of [
      "local.yml",
      "local-linux.yml",
      "CareerdenUnplugged-0.8.0-x64.exe",
      "CareerdenUnplugged-0.8.0-x86_64.AppImage",
    ]) {
      await rm(join(directory, name));
    }

    await expect(verify("v0.8.0", ["local"], ["macos"])).resolves.toEqual([]);
    await expect(verify("v0.8.0", ["local"])).resolves.toEqual([
      "Missing updater metadata local.yml",
      "Missing updater metadata local-linux.yml",
    ]);
  });

  it("accepts a complete release of both editions", async () => {
    await writeRelease("0.8.0");

    await expect(verify()).resolves.toEqual([]);
  });

  it("rejects a release missing one edition's metadata, such as a cloud-only hotfix", async () => {
    await writeRelease("0.8.0", ["cloud"]);

    await expect(verify()).resolves.toEqual([
      "Missing updater metadata local-mac.yml",
      "Missing updater metadata local.yml",
      "Missing updater metadata local-linux.yml",
    ]);
  });

  it("rejects a release missing one platform's metadata", async () => {
    await writeRelease("0.8.0");
    await rm(join(directory, "latest-linux.yml"));

    await expect(verify()).resolves.toEqual(["Missing updater metadata latest-linux.yml"]);
  });

  it("rejects metadata for a version other than the tag", async () => {
    await writeRelease("0.8.0");

    const problems = await verify("v0.8.1");

    expect(problems).toHaveLength(6);
    expect(problems).toContain('local.yml is for version "0.8.0", not 0.8.1');
  });

  it("rejects metadata that references a file missing from the release", async () => {
    await writeRelease("0.8.0");
    await rm(join(directory, "CareerdenUnplugged-0.8.0-arm64.zip"));

    await expect(verify()).resolves.toEqual([
      "local-mac.yml references CareerdenUnplugged-0.8.0-arm64.zip, which is not in the release",
    ]);
  });

  it("rejects a file whose contents do not match the metadata's sha512", async () => {
    await writeRelease("0.8.0");
    // Same size, different bytes, like an asset uploaded by a different build.
    await writeFile(
      join(directory, "Careerden-0.8.0-x64.exe"),
      "Careerden-0.8.0-x64.exe installex",
    );

    await expect(verify()).resolves.toEqual([
      "latest.yml sha512 for Careerden-0.8.0-x64.exe does not match the release asset",
    ]);
  });

  it("rejects a file entry without a sha512", async () => {
    await writeRelease("0.8.0");
    const metadata = await readFile(join(directory, "local-linux.yml"), "utf8");
    await writeFile(
      join(directory, "local-linux.yml"),
      metadata.replace(/^ {4}sha512: .+\n/m, "").replace(/^sha512: .+\n/m, ""),
    );

    await expect(verify()).resolves.toEqual([
      "local-linux.yml has no sha512 for CareerdenUnplugged-0.8.0-x86_64.AppImage",
    ]);
  });

  it.each([
    ["is missing", undefined, "Missing update policy careerden-desktop-update-policy.json"],
    [
      "has an unknown key",
      { schemaVersion: 1, minimumSupportedVersion: "0.6.0", forced: true },
      "careerden-desktop-update-policy.json is invalid: release-policy.json must contain only schemaVersion 1 and minimumSupportedVersion",
    ],
    [
      "is not a stable version",
      { schemaVersion: 1, minimumSupportedVersion: "0.6.0-beta.1" },
      "careerden-desktop-update-policy.json is invalid: minimumSupportedVersion must be a stable semantic version (x.y.z), received 0.6.0-beta.1",
    ],
    [
      "requires a version newer than the release",
      { schemaVersion: 1, minimumSupportedVersion: "0.9.0" },
      "careerden-desktop-update-policy.json is invalid: minimumSupportedVersion 0.9.0 cannot exceed release version 0.8.0",
    ],
  ])("rejects an update policy that %s", async (_case, policy, problem) => {
    await writeRelease("0.8.0");
    const policyPath = join(directory, "careerden-desktop-update-policy.json");
    if (policy === undefined) await rm(policyPath);
    else await writeFile(policyPath, JSON.stringify(policy));

    await expect(verify()).resolves.toEqual([problem]);
  });

  it("checks SHA256SUMS.txt when the release has one", async () => {
    await writeRelease("0.8.0", ["local"]);
    const names = (await directoryAssets(directory)).names.sort();
    const lines = await Promise.all(
      names.map(async (name) => `${sha256(await readFile(join(directory, name)))}  ./${name}`),
    );
    await writeFile(join(directory, "SHA256SUMS.txt"), `${lines.join("\n")}\n`);
    await expect(verify("v0.8.0", ["local"])).resolves.toEqual([]);

    await writeFile(join(directory, "CareerdenUnplugged-0.8.0-x64.exe"), "tampered");
    await expect(verify("v0.8.0", ["local"])).resolves.toEqual(
      expect.arrayContaining([
        "SHA256SUMS.txt checksum for CareerdenUnplugged-0.8.0-x64.exe does not match the release asset",
      ]),
    );
  });

  it("parses electron-builder metadata and rejects syntax it does not know", () => {
    expect(
      parseUpdateMetadata(
        "version: 0.8.0\nfiles:\n  - url: a.zip\n    sha512: abc+/==\n    size: 12\n" +
          "path: a.zip\nsha512: abc+/==\nreleaseDate: '2026-11-07T10:00:00.000Z'\n",
      ),
    ).toEqual({
      version: "0.8.0",
      files: [{ url: "a.zip", sha512: "abc+/==", size: 12 }],
      path: "a.zip",
      sha512: "abc+/==",
      releaseDate: "2026-11-07T10:00:00.000Z",
    });
    expect(() => parseUpdateMetadata("files: []\nversion: 0.8.0\n")).toThrow(
      "files must be a list",
    );
    expect(() => parseUpdateMetadata("version: 0.8.0\n\tbad: indent\n")).toThrow(
      "unsupported metadata syntax",
    );
  });

  it("reads the released editions and rejects unknown or duplicate ones", () => {
    expect(parseReleaseEditions({ editions: ["local"] })).toEqual(["local"]);
    expect(() => parseReleaseEditions({ editions: [] })).toThrow();
    expect(() => parseReleaseEditions({ editions: ["local", "local"] })).toThrow();
    expect(() => parseReleaseEditions({ editions: ["desktop"] })).toThrow();
  });

  it("reads the released platforms and rejects unknown or duplicate ones", () => {
    expect(parseReleasePlatforms({ platforms: ["macos"] })).toEqual(["macos"]);
    expect(() => parseReleasePlatforms({ editions: ["local"] })).toThrow();
    expect(() => parseReleasePlatforms({ platforms: [] })).toThrow();
    expect(() => parseReleasePlatforms({ platforms: ["macos", "macos"] })).toThrow();
    expect(() => parseReleasePlatforms({ platforms: ["windows-x64"] })).toThrow();
  });

  it("exits non-zero from the command line when a release is incomplete", async () => {
    await writeRelease("0.8.0", ["cloud"]);

    const failure = await run(process.execPath, [
      cliPath,
      "v0.8.0",
      "--dir",
      directory,
      "--editions",
      "cloud,local",
    ]).catch((error) => error);

    expect(failure.code).toBe(1);
    expect(failure.stderr).toContain("Missing updater metadata local-mac.yml");

    const success = await run(process.execPath, [
      cliPath,
      "v0.8.0",
      "--dir",
      directory,
      "--editions",
      "cloud",
    ]);
    expect(success.stdout).toContain("Release v0.8.0 is complete for editions cloud");

    await rm(join(directory, "latest-linux.yml"));
    const linuxFailure = await run(process.execPath, [
      cliPath,
      "v0.8.0",
      "--dir",
      directory,
      "--editions",
      "cloud",
      "--platforms",
      "macos,windows,linux",
    ]).catch((error) => error);
    expect(linuxFailure.code).toBe(1);
    expect(linuxFailure.stderr).toContain("Missing updater metadata latest-linux.yml");
  });
});
