import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RotatingLogFile } from "./rotating-log-file.js";

describe("RotatingLogFile", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "careerden-log-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("creates the directory and appends lines", () => {
    const file = new RotatingLogFile({
      directory: join(directory, "logs"),
      fileName: "careerden.log",
      maxFileBytes: 1_000,
      maxFiles: 3,
    });

    file.append("first");
    file.append("second");

    expect(readFileSync(file.activePath, "utf8")).toBe("first\nsecond\n");
  });

  it("never lets a file exceed the size limit and keeps at most the configured number of files", () => {
    const maxFileBytes = 200;
    const file = new RotatingLogFile({
      directory,
      fileName: "careerden.log",
      maxFileBytes,
      maxFiles: 3,
    });

    for (let index = 0; index < 500; index += 1) {
      file.append(`line ${index} ${"x".repeat(index % 40)}`);
    }

    const files = readdirSync(directory).sort();
    expect(files).toEqual(["careerden.1.log", "careerden.2.log", "careerden.log"]);
    for (const name of files) {
      expect(statSync(join(directory, name)).size).toBeLessThanOrEqual(maxFileBytes);
    }
    expect(readFileSync(file.activePath, "utf8")).toContain("line 499");
  });

  it("rotates oldest content out in order", () => {
    const file = new RotatingLogFile({
      directory,
      fileName: "careerden.log",
      maxFileBytes: 12,
      maxFiles: 2,
    });

    file.append("aaaaaaaaaa");
    file.append("bbbbbbbbbb");
    file.append("cccccccccc");

    expect(readFileSync(join(directory, "careerden.log"), "utf8")).toBe("cccccccccc\n");
    expect(readFileSync(join(directory, "careerden.1.log"), "utf8")).toBe("bbbbbbbbbb\n");
    expect(existsSync(join(directory, "careerden.2.log"))).toBe(false);
  });

  it("continues from the size of an existing file after a restart", () => {
    const options = { directory, fileName: "careerden.log", maxFileBytes: 30, maxFiles: 2 };
    new RotatingLogFile(options).append("x".repeat(20));

    new RotatingLogFile(options).append("y".repeat(20));

    expect(readFileSync(join(directory, "careerden.1.log"), "utf8")).toBe(`${"x".repeat(20)}\n`);
    expect(readFileSync(join(directory, "careerden.log"), "utf8")).toBe(`${"y".repeat(20)}\n`);
  });

  it("truncates a single line longer than the limit", () => {
    const file = new RotatingLogFile({
      directory,
      fileName: "careerden.log",
      maxFileBytes: 50,
      maxFiles: 2,
    });

    file.append("é".repeat(200));

    expect(statSync(file.activePath).size).toBeLessThanOrEqual(50);
    expect(readFileSync(file.activePath, "utf8").endsWith("\n")).toBe(true);
  });
});
