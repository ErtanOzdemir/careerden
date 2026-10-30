import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { sankey, sankeyLinkHorizontal, type SankeyLink, type SankeyNode } from "d3-sankey";
import type { DashboardSankeyCompany, DashboardSankeyData, DashboardSankeyNode } from "../types.js";
import { layoutPipelineLogoRow } from "./pipeline-logo-layout.js";

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
  const [failedLogos, setFailedLogos] = useState<ReadonlySet<string>>(() => new Set());
  const clipIdPrefix = `pipeline-logo-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

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

        {graph.links.map((link) => {
          const source = link.source as LayoutNode;
          const target = link.target as LayoutNode;
          const companies = target.companies ?? [];
          if (companies.length === 0) return null;

          const startX = source.x1 ?? 0;
          const endX = target.x0 ?? 0;
          const row = layoutPipelineLogoRow(companies.length, (endX - startX) * 0.6);
          const firstX = (startX + endX) / 2 - row.width / 2 + row.size / 2;
          const centerY = ((link.y0 ?? 0) + (link.y1 ?? 0)) / 2;

          return (
            <g key={`logos-${target.id}`} data-testid={`sankey-logos-${target.id}`}>
              {companies.map((company, index) => (
                <PipelineCompanyLogo
                  key={company.id}
                  clipId={`${clipIdPrefix}-${target.id}-${index}`}
                  company={company}
                  failed={failedLogos.has(company.id)}
                  onFailed={() => setFailedLogos((current) => new Set(current).add(company.id))}
                  size={row.size}
                  x={firstX + row.step * index}
                  y={centerY}
                />
              ))}
            </g>
          );
        })}

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

function PipelineCompanyLogo({
  clipId,
  company,
  failed,
  onFailed,
  size,
  x,
  y,
}: {
  clipId: string;
  company: DashboardSankeyCompany;
  failed: boolean;
  onFailed: () => void;
  size: number;
  x: number;
  y: number;
}) {
  const radius = size / 2;
  const name = company.name?.trim() || "Company";

  return (
    <g transform={`translate(${x} ${y})`} data-testid="sankey-company-logo">
      <title>{name}</title>
      <clipPath id={clipId}>
        <circle r={radius} />
      </clipPath>
      <circle r={radius} className="fill-card stroke-border" strokeWidth={1.5} />
      {company.logoUrl && !failed ? (
        <image
          href={company.logoUrl}
          x={-radius}
          y={-radius}
          width={size}
          height={size}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
          onError={onFailed}
        />
      ) : (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-muted-foreground font-semibold"
          fontSize={Math.max(7, size * 0.45)}
        >
          {name.charAt(0).toUpperCase()}
        </text>
      )}
      <circle r={radius} fill="none" className="stroke-border" strokeWidth={1.5} />
    </g>
  );
}

function formatApplicationCount(count: number) {
  return `${count} ${count === 1 ? "application" : "applications"}`;
}
