import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationPipelineSankey } from "./ApplicationPipelineSankey.js";
import type { DashboardSankeyData } from "../types.js";

const data: DashboardSankeyData = {
  nodes: [
    { id: "all-applications", label: "All applications", count: 4 },
    { id: "applied", label: "Applied", count: 3 },
    { id: "offer", label: "Offer", count: 1 },
  ],
  links: [
    { source: "all-applications", target: "applied", value: 3 },
    { source: "all-applications", target: "offer", value: 1 },
  ],
};

describe("ApplicationPipelineSankey", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders nodes, links, and readable values", () => {
    const { container } = render(<ApplicationPipelineSankey data={data} />);

    expect(screen.getByTestId("sankey-node-all-applications")).toBeInTheDocument();
    expect(screen.getByTestId("sankey-node-applied")).toBeInTheDocument();
    expect(screen.getByTestId("sankey-node-applied")).toHaveTextContent("Applied · 3");
    expect(container.querySelectorAll("path")).toHaveLength(2);
  });

  it("shows the count and percentage on hover and keyboard focus", () => {
    render(<ApplicationPipelineSankey data={data} />);
    const offer = screen.getByTestId("sankey-node-offer");

    fireEvent.mouseEnter(offer);
    expect(screen.getByRole("status")).toHaveTextContent("1 application · 25%");

    fireEvent.mouseLeave(offer);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.focus(offer);
    expect(screen.getByRole("status")).toHaveTextContent("Offer");
  });

  it("updates the layout width when its container is resized", () => {
    class ResizeObserverMock {
      observe() {
        this.callback([{ contentRect: { width: 840 } }]);
      }

      disconnect() {}

      constructor(
        private readonly callback: (entries: Array<{ contentRect: { width: number } }>) => void,
      ) {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    render(<ApplicationPipelineSankey data={data} />);

    expect(screen.getByRole("img")).toHaveAttribute("viewBox", "0 0 840 360");
  });

  it("renders an empty state without a chart", () => {
    render(<ApplicationPipelineSankey data={{ nodes: [], links: [] }} />);

    expect(screen.getByText("Add an application to see your pipeline.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
