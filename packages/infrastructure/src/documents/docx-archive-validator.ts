import { InvalidDocxTemplateError } from "@careerden/domain";

const endOfCentralDirectorySignature = 0x06054b50;
const centralDirectoryEntrySignature = 0x02014b50;
const localFileHeaderSignature = 0x04034b50;
const minimumEndOfCentralDirectorySize = 22;
const maximumZipCommentSize = 0xffff;
const maximumEntryCount = 512;
const maximumEntryNameBytes = 512;
const maximumSingleEntrySize = 16 * 1024 * 1024;
const maximumTotalExpandedSize = 32 * 1024 * 1024;
const compressionRatioThresholdSize = 1024 * 1024;
const maximumCompressionRatio = 200;
const requiredDocxEntries = ["[Content_Types].xml", "_rels/.rels", "word/document.xml"];

interface ArchiveEntryRange {
  end: number;
  name: string;
  start: number;
}

export function validateDocxArchive(template: Buffer): void {
  const endOffset = findEndOfCentralDirectory(template);
  const diskNumber = template.readUInt16LE(endOffset + 4);
  const centralDirectoryDisk = template.readUInt16LE(endOffset + 6);
  const entriesOnDisk = template.readUInt16LE(endOffset + 8);
  const totalEntries = template.readUInt16LE(endOffset + 10);
  const centralDirectorySize = template.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = template.readUInt32LE(endOffset + 16);

  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entriesOnDisk !== totalEntries ||
    totalEntries === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    invalid("multi-disk and ZIP64 archives are not supported");
  }

  if (totalEntries === 0 || totalEntries > maximumEntryCount) {
    invalid(`archive must contain between 1 and ${maximumEntryCount} entries`);
  }

  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (
    centralDirectoryOffset > template.length ||
    centralDirectoryEnd > endOffset ||
    centralDirectoryEnd < centralDirectoryOffset
  ) {
    invalid("central directory is outside the archive");
  }

  const names = new Set<string>();
  const entryRanges: ArchiveEntryRange[] = [];
  let totalExpandedSize = 0;
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    ensureAvailable(template, cursor, 46, "central directory entry is truncated");

    if (template.readUInt32LE(cursor) !== centralDirectoryEntrySignature) {
      invalid("central directory entry is malformed");
    }

    const flags = template.readUInt16LE(cursor + 8);
    const compressionMethod = template.readUInt16LE(cursor + 10);
    const compressedSize = template.readUInt32LE(cursor + 20);
    const expandedSize = template.readUInt32LE(cursor + 24);
    const nameLength = template.readUInt16LE(cursor + 28);
    const extraLength = template.readUInt16LE(cursor + 30);
    const commentLength = template.readUInt16LE(cursor + 32);
    const startingDisk = template.readUInt16LE(cursor + 34);
    const localHeaderOffset = template.readUInt32LE(cursor + 42);
    const entryEnd = cursor + 46 + nameLength + extraLength + commentLength;

    ensureAvailable(template, cursor, entryEnd - cursor, "central directory entry is truncated");

    if (
      compressedSize === 0xffffffff ||
      expandedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff ||
      startingDisk !== 0
    ) {
      invalid("ZIP64 and multi-disk entries are not supported");
    }

    if ((flags & 0x1) !== 0) {
      invalid("encrypted entries are not supported");
    }

    if (compressionMethod !== 0 && compressionMethod !== 8) {
      invalid("entry uses an unsupported compression method");
    }

    if (nameLength === 0 || nameLength > maximumEntryNameBytes) {
      invalid(`entry names must be between 1 and ${maximumEntryNameBytes} bytes`);
    }

    const name = template.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    validateEntryName(name);

    const canonicalName = name.toLocaleLowerCase("en-US");
    if (names.has(canonicalName)) {
      invalid("archive contains duplicate entry names");
    }
    names.add(canonicalName);

    if (expandedSize > maximumSingleEntrySize) {
      invalid(`an entry exceeds the ${maximumSingleEntrySize / 1024 / 1024} MB limit`);
    }

    totalExpandedSize += expandedSize;
    if (totalExpandedSize > maximumTotalExpandedSize) {
      invalid(`expanded archive exceeds the ${maximumTotalExpandedSize / 1024 / 1024} MB limit`);
    }

    if (
      expandedSize > compressionRatioThresholdSize &&
      expandedSize / Math.max(compressedSize, 1) > maximumCompressionRatio
    ) {
      invalid(`an entry exceeds the ${maximumCompressionRatio}:1 compression ratio limit`);
    }

    entryRanges.push(
      validateLocalEntry(
        template,
        localHeaderOffset,
        name,
        flags,
        compressionMethod,
        compressedSize,
        centralDirectoryOffset,
      ),
    );
    cursor = entryEnd;
  }

  if (cursor !== centralDirectoryEnd) {
    invalid("central directory size does not match its entries");
  }

  rejectOverlappingEntries(entryRanges);

  for (const requiredEntry of requiredDocxEntries) {
    if (!names.has(requiredEntry.toLocaleLowerCase("en-US"))) {
      invalid(`required DOCX entry is missing: ${requiredEntry}`);
    }
  }
}

function findEndOfCentralDirectory(template: Buffer): number {
  const minimumOffset = Math.max(
    0,
    template.length - minimumEndOfCentralDirectorySize - maximumZipCommentSize,
  );

  for (
    let offset = template.length - minimumEndOfCentralDirectorySize;
    offset >= minimumOffset;
    offset -= 1
  ) {
    if (template.readUInt32LE(offset) !== endOfCentralDirectorySignature) {
      continue;
    }

    const commentLength = template.readUInt16LE(offset + 20);
    if (offset + minimumEndOfCentralDirectorySize + commentLength === template.length) {
      return offset;
    }
  }

  invalid("end of central directory was not found");
}

function validateEntryName(name: string): void {
  if (
    name.includes("\0") ||
    name.includes("\\") ||
    name.includes("\uFFFD") ||
    name.startsWith("/") ||
    /^[a-zA-Z]:/.test(name)
  ) {
    invalid("archive contains an unsafe entry name");
  }

  const segments = name.split("/");
  const isDirectory = name.endsWith("/");
  const contentSegments = isDirectory ? segments.slice(0, -1) : segments;

  if (
    contentSegments.length === 0 ||
    contentSegments.some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    invalid("archive contains an unsafe entry path");
  }
}

function validateLocalEntry(
  template: Buffer,
  offset: number,
  name: string,
  centralFlags: number,
  centralCompressionMethod: number,
  compressedSize: number,
  centralDirectoryOffset: number,
): ArchiveEntryRange {
  ensureAvailable(template, offset, 30, "local entry header is truncated");

  if (template.readUInt32LE(offset) !== localFileHeaderSignature) {
    invalid("local entry header is malformed");
  }

  const localFlags = template.readUInt16LE(offset + 6);
  const localCompressionMethod = template.readUInt16LE(offset + 8);
  const localNameLength = template.readUInt16LE(offset + 26);
  const localExtraLength = template.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + localNameLength + localExtraLength;
  const dataEnd = dataStart + compressedSize;

  ensureAvailable(template, offset, dataStart - offset, "local entry header is truncated");

  if ((localFlags & 0x1) !== 0 || (centralFlags & 0x1) !== 0) {
    invalid("encrypted entries are not supported");
  }

  if (localCompressionMethod !== centralCompressionMethod) {
    invalid("local and central compression methods do not match");
  }

  const localName = template.subarray(offset + 30, offset + 30 + localNameLength).toString("utf8");
  if (localName !== name) {
    invalid("local and central entry names do not match");
  }

  if (dataEnd < dataStart || dataEnd > centralDirectoryOffset) {
    invalid("entry data is outside the archive");
  }

  return { end: dataEnd, name, start: offset };
}

function rejectOverlappingEntries(entries: ArchiveEntryRange[]): void {
  const sorted = [...entries].sort((left, right) => left.start - right.start);

  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].start < sorted[index - 1].end) {
      invalid(`archive entries overlap near ${sorted[index].name}`);
    }
  }
}

function ensureAvailable(template: Buffer, offset: number, length: number, message: string): void {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    offset < 0 ||
    length < 0 ||
    offset + length > template.length
  ) {
    invalid(message);
  }
}

function invalid(reason: string): never {
  throw new InvalidDocxTemplateError(`Invalid DOCX template: ${reason}`);
}
