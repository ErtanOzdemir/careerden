import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InterestTag } from "./status-badge.js";

describe("InterestTag", () => {
  afterEach(cleanup);

  it.each([
    ["low", "🤔 Low interest"],
    ["medium", "👀 Interested"],
    ["high", "🔥 Highly interested"],
  ] as const)("renders the %s interest level", (interestLevel, label) => {
    render(<InterestTag interestLevel={interestLevel} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("renders a dash when interest is not set", () => {
    render(<InterestTag />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
