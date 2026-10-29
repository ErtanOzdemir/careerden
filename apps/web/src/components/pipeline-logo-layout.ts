export const pipelineLogoMaxSize = 24;
// Below this a logo stops being recognizable, so crowded rows overlap instead of shrinking.
export const pipelineLogoMinSize = 12;
const pipelineLogoGap = 3;

export interface PipelineLogoRow {
  size: number;
  // Distance between neighbouring logo centres; smaller than size when logos overlap.
  step: number;
  width: number;
}

// Fits `count` equal logos into `maxWidth`: every logo shrinks together as the row fills, from
// the maximum down to the minimum size, then they overlap to stay within the ribbon.
export function layoutPipelineLogoRow(count: number, maxWidth: number): PipelineLogoRow {
  if (count <= 0) return { size: 0, step: 0, width: 0 };

  const fitted = Math.floor((maxWidth - pipelineLogoGap * (count - 1)) / count);
  const size = Math.max(pipelineLogoMinSize, Math.min(pipelineLogoMaxSize, fitted));
  if (count === 1) return { size, step: 0, width: size };

  const naturalWidth = count * size + pipelineLogoGap * (count - 1);
  const step =
    naturalWidth <= maxWidth
      ? size + pipelineLogoGap
      : Math.max(1, (Math.max(maxWidth, size) - size) / (count - 1));

  return { size, step, width: size + step * (count - 1) };
}
