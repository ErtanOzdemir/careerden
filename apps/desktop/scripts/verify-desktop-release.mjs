// Checks that a desktop release contains every edition's complete updater metadata, that each
// file it references is in the release with a matching sha512, and that the update policy is
// valid.
//
//   node apps/desktop/scripts/verify-desktop-release.mjs <tag> [--repo owner/name]
//     Downloads a draft or published GitHub release with `gh` and checks it.
//   node apps/desktop/scripts/verify-desktop-release.mjs <tag> --dir <directory>
//     Checks release assets in a local directory; the release workflow uses this before it
//     creates the draft release.
//
// The editions and platforms come from apps/desktop/release-editions.json unless --editions or
// --platforms lists them.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";
import {
  directoryAssets,
  parseReleaseEditions,
  parseReleasePlatforms,
  requiredMetadataFiles,
  verifyDesktopRelease,
} from "./desktop-release-verification.mjs";

const run = promisify(execFile);
const desktopDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dir: { type: "string" },
    repo: { type: "string" },
    editions: { type: "string" },
    platforms: { type: "string" },
  },
});

const [tag] = positionals;
if (!tag || positionals.length > 1) {
  console.error(
    "Usage: verify-desktop-release.mjs <tag> [--dir <directory> | --repo owner/name] [--editions local,cloud] [--platforms macos,windows,linux]",
  );
  process.exit(2);
}

const listed = (value) => value.split(",").map((item) => item.trim());
const releaseFile = JSON.parse(
  await readFile(join(desktopDirectory, "release-editions.json"), "utf8"),
);
const editions = parseReleaseEditions(
  values.editions ? { editions: listed(values.editions) } : releaseFile,
);
const platforms = parseReleasePlatforms(
  values.platforms ? { platforms: listed(values.platforms) } : releaseFile,
);

let downloadDirectory;
try {
  let directory = values.dir;
  if (!directory) {
    const repoArgs = values.repo ? ["--repo", values.repo] : [];
    const { stdout } = await run("gh", [
      "release",
      "view",
      tag,
      ...repoArgs,
      "--json",
      "isDraft",
      "--jq",
      ".isDraft",
    ]);
    console.log(`Downloading ${stdout.trim() === "true" ? "draft" : "published"} release ${tag}`);
    downloadDirectory = await mkdtemp(join(tmpdir(), "careerden-release-"));
    await run("gh", ["release", "download", tag, ...repoArgs, "--dir", downloadDirectory], {
      maxBuffer: 16 * 1024 * 1024,
    });
    directory = downloadDirectory;
  }

  const problems = await verifyDesktopRelease({
    tag,
    editions,
    platforms,
    assets: await directoryAssets(directory),
  });

  if (problems.length > 0) {
    for (const problem of problems) {
      // GitHub Actions shows these as error annotations; elsewhere they are plain lines.
      console.error(process.env.GITHUB_ACTIONS ? `::error::${problem}` : `error: ${problem}`);
    }
    console.error(
      `Release ${tag} is not complete for editions ${editions.join(", ")} ` +
        `on ${platforms.join(", ")}.`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Release ${tag} is complete for editions ${editions.join(", ")} on ${platforms.join(", ")}: ` +
        `${requiredMetadataFiles(editions, platforms).join(", ")}, every referenced file, ` +
        "and the update policy.",
    );
  }
} catch (error) {
  console.error(`Could not verify release ${tag}: ${error.stderr?.trim() || error.message}`);
  process.exitCode = 1;
} finally {
  if (downloadDirectory) await rm(downloadDirectory, { recursive: true, force: true });
}
