import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationPipelineSankey } from "./ApplicationPipelineSankey.js";
import type { DashboardSankeyData } from "../types.js";

const data: DashboardSankeyData = {
  nodes: [
    { id: "applications", status: "applications", label: "Applications", count: 4 },
    { id: "applied", status: "applied", label: "Applied", count: 4 },
    { id: "interview", status: "interview", label: "Interview", count: 2 },
    { id: "interview:rejected", status: "rejected", label: "Rejected", count: 1 },
  ],
  links: [
    { source: "applications", target: "applied", value: 4 },
    { source: "applied", target: "interview", value: 2 },
    { source: "interview", target: "interview:rejected", value: 1 },
  ],
};

describe("ApplicationPipelineSankey", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders every stage and the ribbons between them", () => {
    render(<ApplicationPipelineSankey data={data} />);

    expect(screen.getByTestId("sankey-node-applications")).toHaveTextContent("4Applications");
    expect(screen.getByTestId("sankey-node-interview")).toHaveTextContent("2Interview");
    expect(screen.getByTestId("sankey-link-applied>interview")).toBeInTheDocument();
    expect(screen.getByTestId("sankey-link-interview>interview:rejected")).toBeInTheDocument();
  });

  it("explains how many applications moved on from a stage", () => {
    render(<ApplicationPipelineSankey data={data} />);
    const interview = screen.getByTestId("sankey-node-interview");

    fireEvent.mouseEnter(interview);
    expect(screen.getByRole("status")).toHaveTextContent("2 applications · 50% of all");
    expect(screen.getByRole("status")).toHaveTextContent("1 moved on · 1 still here");

    fireEvent.mouseLeave(interview);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.focus(screen.getByTestId("sankey-node-interview:rejected"));
    expect(screen.getByRole("status")).toHaveTextContent("Rejected after interview");
    expect(screen.getByRole("status")).not.toHaveTextContent("still here");
  });

  it("shows a ribbon's share of the stage it left", () => {
    render(<ApplicationPipelineSankey data={data} />);
    const link = screen.getByTestId("sankey-link-applied>interview");

    fireEvent.mouseEnter(link);

    expect(screen.getByRole("status")).toHaveTextContent("Applied → Interview");
    expect(screen.getByRole("status")).toHaveTextContent("2 applications · 50% of Applied");
    expect(link).toHaveAttribute("stroke-opacity", "0.55");
    expect(screen.getByTestId("sankey-link-applications>applied")).toHaveAttribute(
      "stroke-opacity",
      "0.12",
    );
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

    expect(screen.getByRole("img")).toHaveAttribute("viewBox", "0 0 840 380");
  });

  it("renders an empty state without a chart", () => {
    render(<ApplicationPipelineSankey data={{ nodes: [], links: [] }} />);

    expect(screen.getByText("Add an application to see your pipeline.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("draws company logos on the ribbon into their current stage, with initials as a fallback", () => {
    const { container } = render(
      <ApplicationPipelineSankey
        data={{
          ...data,
          links: data.links.map((link) =>
            link.target === "interview"
              ? {
                  ...link,
                  companies: [
                    { id: "job-1", name: "Acme", logoUrl: "/api/files/acme.png?signature=s" },
                    { id: "job-2", name: "globex" },
                    { id: "job-3" },
                  ],
                }
              : link,
          ),
        }}
      />,
    );
    const logos = screen.getAllByTestId("sankey-company-logo");

    expect(screen.getByTestId("sankey-logos-applied>interview")).toBeInTheDocument();
    expect(
      screen.queryByTestId("sankey-logos-interview>interview:rejected"),
    ).not.toBeInTheDocument();
    expect(logos).toHaveLength(3);
    expect(container.querySelector("image")?.getAttribute("href")).toBe(
      "/api/files/acme.png?signature=s",
    );
    expect(logos[1]).toHaveTextContent("G");
    expect(logos[2]).toHaveTextContent("C");
    expect(logos[0]?.querySelector("title")).toHaveTextContent("Acme");
  });

  it("leaves company logos out when they are hidden", () => {
    render(
      <ApplicationPipelineSankey
        showCompanyLogos={false}
        data={{
          ...data,
          links: data.links.map((link) => ({
            ...link,
            companies: [{ id: "job-1", name: "Acme" }],
          })),
        }}
      />,
    );

    expect(screen.queryByTestId("sankey-company-logo")).not.toBeInTheDocument();
    expect(screen.getByTestId("sankey-link-applied>interview")).toBeInTheDocument();
  });

  it("falls back to initials when a logo fails to load", () => {
    const { container } = render(
      <ApplicationPipelineSankey
        data={{
          ...data,
          links: data.links.map((link) =>
            link.target === "interview:rejected"
              ? { ...link, companies: [{ id: "job-9", name: "Initech", logoUrl: "/broken.png" }] }
              : link,
          ),
        }}
      />,
    );

    fireEvent.error(container.querySelector("image")!);

    expect(container.querySelector("image")).toBeNull();
    expect(screen.getByTestId("sankey-company-logo")).toHaveTextContent("I");
  });
});
