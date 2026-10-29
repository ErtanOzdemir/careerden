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

  it("draws each status's company logos on its ribbon, with initials as a fallback", () => {
    const { container } = render(
      <ApplicationPipelineSankey
        data={{
          ...data,
          nodes: data.nodes.map((node) =>
            node.id === "applied"
              ? {
                  ...node,
                  companies: [
                    { id: "job-1", name: "Acme", logoUrl: "/api/files/acme.png?signature=s" },
                    { id: "job-2", name: "globex" },
                    { id: "job-3" },
                  ],
                }
              : node,
          ),
        }}
      />,
    );
    const logos = screen.getAllByTestId("sankey-company-logo");

    expect(screen.getByTestId("sankey-logos-applied")).toBeInTheDocument();
    expect(screen.queryByTestId("sankey-logos-offer")).not.toBeInTheDocument();
    expect(logos).toHaveLength(3);
    expect(container.querySelector("image")?.getAttribute("href")).toBe(
      "/api/files/acme.png?signature=s",
    );
    expect(logos[1]).toHaveTextContent("G");
    expect(logos[2]).toHaveTextContent("C");
    expect(logos[0]?.querySelector("title")).toHaveTextContent("Acme");
  });

  it("falls back to initials when a logo fails to load", () => {
    const { container } = render(
      <ApplicationPipelineSankey
        data={{
          ...data,
          nodes: data.nodes.map((node) =>
            node.id === "offer"
              ? { ...node, companies: [{ id: "job-9", name: "Initech", logoUrl: "/broken.png" }] }
              : node,
          ),
        }}
      />,
    );

    fireEvent.error(container.querySelector("image")!);

    expect(container.querySelector("image")).toBeNull();
    expect(screen.getByTestId("sankey-company-logo")).toHaveTextContent("I");
  });
});
