import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

// Shared by the release workflow, which checks the assets before creating the draft release, and
// by verify-desktop-release.mjs, which checks a draft or published release on GitHub. Both
// editions ship in one release, and an installed app reads only its own channel's metadata, so a
// release missing one edition or released platform breaks that edition's updates without any
// error.

// electron-builder's updater channel per edition, set by `publish.channel` in its config.
export const editionChannels = { cloud: "latest", local: "local" };
// The metadata file each platform's updater downloads, by channel.
export const platformMetadataFiles = {
  macos: (channel) => `${channel}-mac.yml`,
  windows: (channel) => `${channel}.yml`,
  linux: (channel) => `${channel}-linux.yml`,
};
export const updatePolicyAssetName = "careerden-desktop-update-policy.json";
export const checksumsAssetName = "SHA256SUMS.txt";

const stableSemver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const allPlatforms = Object.keys(platformMetadataFiles);

// The metadata files a release of these editions and platforms must contain, e.g. local-mac.yml.
export function requiredMetadataFiles(editions, platforms = allPlatforms) {
  return editions.flatMap((edition) => {
    const channel = editionChannels[edition];
    if (!channel) throw new Error(`Unknown desktop edition ${JSON.stringify(edition)}`);
    return platforms.map((platform) => {
      const fileName = platformMetadataFiles[platform];
      if (!fileName) throw new Error(`Unknown desktop platform ${JSON.stringify(platform)}`);
      return fileName(channel);
    });
  });
}

// Parses apps/desktop/release-editions.json: the editions every release must contain.
export function parseReleaseEditions(value) {
  const editions = value?.editions;
  if (
    !Array.isArray(editions) ||
    editions.length === 0 ||
    editions.some((edition) => !Object.hasOwn(editionChannels, edition)) ||
    new Set(editions).size !== editions.length
  ) {
    throw new Error(
      `release-editions.json must list one or more distinct editions from ${Object.keys(editionChannels).join(", ")}`,
    );
  }
  return editions;
}

// Parses the platforms in apps/desktop/release-editions.json: the platforms every edition is built
// and released for. Installed apps on a platform outside the list receive no updates.
export function parseReleasePlatforms(value) {
  const platforms = value?.platforms;
  if (
    !Array.isArray(platforms) ||
    platforms.length === 0 ||
    platforms.some((platform) => !Object.hasOwn(platformMetadataFiles, platform)) ||
    new Set(platforms).size !== platforms.length
  ) {
    throw new Error(
      `release-editions.json must list one or more distinct platforms from ${allPlatforms.join(", ")}`,
    );
  }
  return platforms;
}

// Release assets in a local directory, such as the workflow's merged build artifacts or a
// downloaded release.
export async function directoryAssets(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const names = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  return {
    names,
    readText: (name) => readFile(join(directory, name), "utf8"),
    size: async (name) => (await stat(join(directory, name))).size,
    sha512: (name) => hashFile(join(directory, name), "sha512", "base64"),
    sha256: (name) => hashFile(join(directory, name), "sha256", "hex"),
  };
}

// Returns every problem found, so one run reports them all. An empty list means the release is
// complete and consistent.
export async function verifyDesktopRelease({ tag, editions, platforms = allPlatforms, assets }) {
  const problems = [];
  const version = tag.startsWith("v") ? tag.slice(1) : tag;
  if (!stableSemver.test(version)) {
    problems.push(`Tag ${tag} is not v followed by a stable semantic version (x.y.z)`);
  }
  const available = new Set(assets.names);

  for (const metadataFile of requiredMetadataFiles(editions, platforms)) {
    if (!available.has(metadataFile)) {
      problems.push(`Missing updater metadata ${metadataFile}`);
      continue;
    }

    let metadata;
    try {
      metadata = parseUpdateMetadata(await assets.readText(metadataFile));
    } catch (error) {
      problems.push(`${metadataFile} cannot be read: ${error.message}`);
      continue;
    }

    if (metadata.version !== version) {
      problems.push(
        `${metadataFile} is for version ${JSON.stringify(metadata.version)}, not ${version}`,
      );
    }
    if (metadata.files.length === 0) {
      problems.push(`${metadataFile} references no files`);
    }

    const referenced = [...metadata.files];
    // The legacy top-level path is what older updaters download; check it as well.
    if (metadata.path !== undefined && !referenced.some((file) => file.url === metadata.path)) {
      referenced.push({ url: metadata.path, sha512: metadata.sha512 });
    }
    for (const file of referenced) {
      problems.push(...(await verifyReferencedFile(metadataFile, file, available, assets)));
    }
  }

  if (!available.has(updatePolicyAssetName)) {
    problems.push(`Missing update policy ${updatePolicyAssetName}`);
  } else {
    try {
      assertUpdatePolicy(JSON.parse(await assets.readText(updatePolicyAssetName)), version);
    } catch (error) {
      problems.push(`${updatePolicyAssetName} is invalid: ${error.message}`);
    }
  }

  if (available.has(checksumsAssetName)) {
    problems.push(...(await verifyChecksums(assets, available)));
  }

  return problems;
}

async function verifyReferencedFile(metadataFile, file, available, assets) {
  if (typeof file.url !== "string" || file.url.length === 0) {
    return [`${metadataFile} has a file entry without a url`];
  }
  // Metadata names release assets; anything else would be fetched from another location.
  if (file.url.includes("/") || file.url.includes("\\")) {
    return [`${metadataFile} references ${file.url}, which is not a release asset name`];
  }
  if (!available.has(file.url)) {
    return [`${metadataFile} references ${file.url}, which is not in the release`];
  }

  const problems = [];
  if (typeof file.sha512 !== "string" || file.sha512.length === 0) {
    problems.push(`${metadataFile} has no sha512 for ${file.url}`);
  } else if ((await assets.sha512(file.url)) !== file.sha512) {
    problems.push(`${metadataFile} sha512 for ${file.url} does not match the release asset`);
  }
  if (file.size !== undefined && Number(file.size) !== (await assets.size(file.url))) {
    problems.push(`${metadataFile} size for ${file.url} does not match the release asset`);
  }
  return problems;
}

async function verifyChecksums(assets, available) {
  const problems = [];
  const listed = new Set();
  for (const line of (await assets.readText(checksumsAssetName)).split("\n")) {
    if (line.trim().length === 0) continue;
    const match = /^([0-9a-f]{64}) [ *](?:\.\/)?(.+)$/.exec(line.trim());
    if (!match) {
      problems.push(`${checksumsAssetName} has an unreadable line ${JSON.stringify(line)}`);
      continue;
    }
    const [, hash, name] = match;
    listed.add(name);
    if (!available.has(name)) {
      problems.push(`${checksumsAssetName} lists ${name}, which is not in the release`);
    } else if ((await assets.sha256(name)) !== hash) {
      problems.push(`${checksumsAssetName} checksum for ${name} does not match the release asset`);
    }
  }
  for (const name of available) {
    if (name !== checksumsAssetName && !listed.has(name)) {
      problems.push(`${checksumsAssetName} does not list ${name}`);
    }
  }
  return problems;
}

// The minimum-supported-version policy installed apps download from the latest release.
export function assertUpdatePolicy(value, releaseVersion) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.schemaVersion !== 1 ||
    typeof value.minimumSupportedVersion !== "string" ||
    Object.keys(value).some((key) => key !== "schemaVersion" && key !== "minimumSupportedVersion")
  ) {
    throw new Error(
      "release-policy.json must contain only schemaVersion 1 and minimumSupportedVersion",
    );
  }
  assertStableSemver(value.minimumSupportedVersion, "minimumSupportedVersion");
  if (stableSemver.test(releaseVersion)) {
    if (compareStableSemver(value.minimumSupportedVersion, releaseVersion) > 0) {
      throw new Error(
        `minimumSupportedVersion ${value.minimumSupportedVersion} cannot exceed release version ${releaseVersion}`,
      );
    }
  }
}

export function assertStableSemver(version, label) {
  if (typeof version !== "string" || !stableSemver.test(version)) {
    throw new Error(`${label} must be a stable semantic version (x.y.z), received ${version}`);
  }
}

function compareStableSemver(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = leftParts[index] - rightParts[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

// Reads the subset of YAML electron-builder writes for updater metadata: top-level scalars and a
// `files` list of flat maps. Anything else is rejected rather than guessed at, so the release
// job needs no installed dependencies.
export function parseUpdateMetadata(text) {
  const metadata = { files: [] };
  let inFiles = false;
  let current;

  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.replace(/\s+$/, "");
    if (line.length === 0 || line.trimStart().startsWith("#")) continue;
    const lineNumber = index + 1;

    const topLevel = /^([A-Za-z][\w-]*):(?: (.*))?$/.exec(line);
    if (topLevel) {
      const [, key, value] = topLevel;
      inFiles = key === "files" && value === undefined;
      current = undefined;
      if (key === "files" && !inFiles) {
        throw new Error(`line ${lineNumber}: files must be a list`);
      }
      if (!inFiles) {
        if (value === undefined) throw new Error(`line ${lineNumber}: ${key} has no value`);
        metadata[key] = parseScalar(value, lineNumber);
      }
      continue;
    }

    const item = /^ {2}- ([A-Za-z][\w-]*): (.*)$/.exec(line);
    const field = /^ {4}([A-Za-z][\w-]*): (.*)$/.exec(line);
    if (inFiles && item) {
      current = { [item[1]]: parseScalar(item[2], lineNumber) };
      metadata.files.push(current);
    } else if (inFiles && current && field) {
      current[field[1]] = parseScalar(field[2], lineNumber);
    } else {
      throw new Error(`line ${lineNumber}: unsupported metadata syntax`);
    }
  }

  if (metadata.version === undefined) throw new Error("no version");
  metadata.version = String(metadata.version);
  return metadata;
}

function parseScalar(value, lineNumber) {
  if (value.startsWith("'")) {
    if (!value.endsWith("'") || value.length < 2) {
      throw new Error(`line ${lineNumber}: unterminated quoted value`);
    }
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(`line ${lineNumber}: unreadable quoted value`);
    }
  }
  if (/^-?\d+$/.test(value)) return Number(value);
  if (value === "true" || value === "false") return value === "true";
  return value;
}

function hashFile(path, algorithm, encoding) {
  return new Promise((resolve, reject) => {
    const hash = createHash(algorithm);
    createReadStream(path)
      .on("error", reject)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest(encoding)));
  });
}
