import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { sankey, sankeyLinkHorizontal, type SankeyLink, type SankeyNode } from "d3-sankey";
import type { DashboardSankeyData, DashboardSankeyNode } from "../types.js";

const chartHeight = 360;
const defaultWidth = 720;
const sourceId = "all-applications";

const nodeColors: Record<string, string> = {
  [sourceId]: "var(--foreground)",
  saved: "var(--chart-5)",
  applied: "var(--info)",
  phone_screen: "var(--chart-3)",
  interview: "var(--warning)",
  offer: "var(--success)",
  rejected: "var(--destructive)",
  ghosted: "var(--muted-foreground)",
};

interface LinkExtra {
  [key: string]: unknown;
}
type LayoutNode = SankeyNode<DashboardSankeyNode, LinkExtra>;
type LayoutLink = SankeyLink<DashboardSankeyNode, LinkExtra>;

interface TooltipState {
  id: string;
  label: string;
  count: number;
  x: number;
  y: number;
}

export function ApplicationPipelineSankey({ data }: { data: DashboardSankeyData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(defaultWidth);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.floor(entry?.contentRect.width ?? 0);
      if (nextWidth > 0) setWidth(nextWidth);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const graph = useMemo(() => {
    if (data.links.length === 0) return null;

    return sankey<DashboardSankeyNode, LinkExtra>()
      .nodeId((node) => node.id)
      .nodeWidth(14)
      .nodePadding(14)
      .extent([
        [24, 52],
        [Math.max(width - 150, 170), chartHeight - 24],
      ])({
      nodes: data.nodes.map((node) => ({ ...node })),
      links: data.links.map((link) => ({ ...link })),
    });
  }, [data, width]);

  if (!graph) {
    return (
      <div className="border-t border-border px-5 py-12 text-center text-sm text-muted-foreground">
        Add an application to see your pipeline.
      </div>
    );
  }

  const total = data.nodes.find((node) => node.id === sourceId)?.count ?? 0;
  const linkPath = sankeyLinkHorizontal<DashboardSankeyNode, LinkExtra>();

  function showTooltip(node: LayoutNode, x: number, y: number) {
    setTooltip({ id: node.id, label: node.label, count: node.count, x, y });
  }

  function showLinkTooltip(link: LayoutLink) {
    const target = link.target as LayoutNode;
    showTooltip(
      target,
      ((target.x0 ?? 0) + ((link.source as LayoutNode).x1 ?? 0)) / 2,
      ((link.y0 ?? 0) + (link.y1 ?? 0)) / 2,
    );
  }

  return (
    <div ref={containerRef} className="relative border-t border-border py-2">
      <svg
        viewBox={`0 0 ${width} ${chartHeight}`}
        className="block h-[360px] w-full"
        role="img"
        aria-label="Current application status distribution"
      >
        <g fill="none">
          {graph.links.map((link) => {
            const target = link.target as LayoutNode;
            const isActive = tooltip?.id === target.id;
            return (
              <path
                key={target.id}
                d={linkPath(link) ?? undefined}
                stroke={nodeColors[target.id] ?? "var(--chart-2)"}
                strokeWidth={Math.max(1, link.width ?? 0)}
                strokeOpacity={isActive ? 0.52 : 0.24}
                className="transition-opacity focus:outline-none"
                tabIndex={0}
                aria-label={`${target.label}: ${formatApplicationCount(target.count)}`}
                onMouseEnter={() => showLinkTooltip(link)}
                onMouseLeave={() => setTooltip(null)}
                onFocus={() => showLinkTooltip(link)}
                onBlur={() => setTooltip(null)}
              />
            );
          })}
        </g>

        {graph.nodes.map((node) => {
          const x0 = node.x0 ?? 0;
          const x1 = node.x1 ?? 0;
          const y0 = node.y0 ?? 0;
          const y1 = node.y1 ?? 0;
          const isSource = node.id === sourceId;
          const labelX = isSource ? x0 : x1 + 10;
          const labelY = isSource ? 30 : (y0 + y1) / 2 + 4;
          const isActive = tooltip?.id === node.id;

          return (
            <g
              key={node.id}
              data-testid={`sankey-node-${node.id}`}
              tabIndex={0}
              aria-label={`${node.label}: ${formatApplicationCount(node.count)}`}
              onMouseEnter={() => showTooltip(node, (x0 + x1) / 2, (y0 + y1) / 2)}
              onMouseLeave={() => setTooltip(null)}
              onFocus={() => showTooltip(node, (x0 + x1) / 2, (y0 + y1) / 2)}
              onBlur={() => setTooltip(null)}
            >
              <rect
                x={x0}
                y={y0}
                width={Math.max(1, x1 - x0)}
                height={Math.max(1, y1 - y0)}
                rx={4}
                fill={nodeColors[node.id] ?? "var(--chart-2)"}
                stroke={isActive ? "var(--ring)" : "none"}
                strokeWidth={2}
              />
              <text
                x={labelX}
                y={labelY}
                textAnchor="start"
                className="fill-foreground text-[12px]"
              >
                <tspan className="font-medium">{node.label}</tspan>
                <tspan className="fill-muted-foreground"> · {node.count}</tspan>
              </text>
            </g>
          );
        })}
      </svg>

      {tooltip && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 min-w-36 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
          style={{
            left: Math.max(80, Math.min(width - 80, tooltip.x)),
            top: tooltip.y + 8,
          }}
        >
          <p className="font-medium">{tooltip.label}</p>
          <p className="mt-0.5 text-muted-foreground">
            {formatApplicationCount(tooltip.count)} ·{" "}
            {total === 0 ? 0 : Math.round((tooltip.count / total) * 100)}%
          </p>
        </div>
      )}
    </div>
  );
}

function formatApplicationCount(count: number) {
  return `${count} ${count === 1 ? "application" : "applications"}`;
}
