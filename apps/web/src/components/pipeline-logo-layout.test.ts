import { describe, expect, it } from "vitest";
import {
  layoutPipelineLogoRow,
  pipelineLogoMaxSize,
  pipelineLogoMinSize,
} from "./pipeline-logo-layout.js";

describe("layoutPipelineLogoRow", () => {
  it("uses the full size while the row has room", () => {
    expect(layoutPipelineLogoRow(1, 200)).toEqual({ size: 24, step: 0, width: 24 });
    expect(layoutPipelineLogoRow(3, 200)).toEqual({ size: 24, step: 27, width: 78 });
  });

  it("shrinks every logo together as the row fills", () => {
    const sparse = layoutPipelineLogoRow(4, 120);
    const crowded = layoutPipelineLogoRow(8, 120);

    expect(sparse.size).toBe(pipelineLogoMaxSize);
    expect(crowded.size).toBeLessThan(sparse.size);
    expect(crowded.size).toBeGreaterThanOrEqual(pipelineLogoMinSize);
    expect(crowded.width).toBeLessThanOrEqual(120);
  });

  it("overlaps logos at the minimum size instead of shrinking further", () => {
    const row = layoutPipelineLogoRow(24, 120);

    expect(row.size).toBe(pipelineLogoMinSize);
    expect(row.step).toBeLessThan(row.size);
    expect(row.width).toBeCloseTo(120);
  });

  it("returns an empty row for no logos", () => {
    expect(layoutPipelineLogoRow(0, 120)).toEqual({ size: 0, step: 0, width: 0 });
  });
});
