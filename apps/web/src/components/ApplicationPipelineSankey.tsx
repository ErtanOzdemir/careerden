import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  sankey,
  sankeyLeft,
  sankeyLinkHorizontal,
  type SankeyLink,
  type SankeyNode,
} from "d3-sankey";
import type {
  DashboardSankeyCompany,
  DashboardSankeyData,
  DashboardSankeyLink,
  DashboardSankeyNode,
} from "../types.js";
import { layoutPipelineLogoRow } from "./pipeline-logo-layout.js";

const chartHeight = 380;
const defaultWidth = 720;
const sourceId = "applications";
const outcomeIds = new Set(["rejected", "ghosted", "declined", "rescinded"]);

const nodeColors: Record<string, string> = {
  [sourceId]: "var(--foreground)",
  saved: "var(--chart-5)",
  applied: "var(--info)",
  phone_screen: "var(--chart-3)",
  interview: "var(--warning)",
  offer: "var(--success)",
  declined: "var(--chart-4)",
  rescinded: "var(--destructive)",
  rejected: "var(--destructive)",
  ghosted: "var(--muted-foreground)",
};

type LinkExtra = Omit<DashboardSankeyLink, "source" | "target" | "value">;
type LayoutNode = SankeyNode<DashboardSankeyNode, LinkExtra>;
type LayoutLink = SankeyLink<DashboardSankeyNode, LinkExtra>;

interface TooltipState {
  // Node id, or "source>target" for a ribbon.
  key: string;
  title: string;
  lines: string[];
  x: number;
  y: number;
}

export function ApplicationPipelineSankey({
  data,
  showCompanyLogos = true,
}: {
  data: DashboardSankeyData;
  showCompanyLogos?: boolean;
}) {
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

    // Left alignment keeps every stage in the column of its step, so a ribbon into an outcome
    // shows which stage the application last reached.
    return (
      sankey<DashboardSankeyNode, LinkExtra>()
        .nodeId((node) => node.id)
        .nodeAlign(sankeyLeft)
        .nodeWidth(12)
        // Room for the two-line label beside even the smallest node.
        .nodePadding(30)
        .extent([
          [24, 52],
          [Math.max(width - 110, 170), chartHeight - 16],
        ])({
        nodes: data.nodes.map((node) => ({ ...node })),
        links: data.links.map((link) => ({ ...link })),
      })
    );
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
  const activeNode = tooltip && !tooltip.key.includes(">") ? tooltip.key : null;

  function showNodeTooltip(node: LayoutNode) {
    const movedOn = (node.sourceLinks ?? []).reduce((sum, link) => sum + link.value, 0);
    const lines = [`${formatApplicationCount(node.count)} · ${percent(node.count, total)} of all`];
    if (node.id !== sourceId && node.status !== "saved" && !outcomeIds.has(node.status)) {
      lines.push(`${movedOn} moved on · ${node.count - movedOn} still here`);
    }
    setTooltip({
      key: node.id,
      title: outcomeIds.has(node.status)
        ? `${node.label} after ${((node.targetLinks?.[0]?.source as LayoutNode | undefined)?.label ?? "").toLowerCase()}`
        : node.label,
      lines,
      x: ((node.x0 ?? 0) + (node.x1 ?? 0)) / 2,
      y: ((node.y0 ?? 0) + (node.y1 ?? 0)) / 2,
    });
  }

  function showLinkTooltip(link: LayoutLink) {
    const source = link.source as LayoutNode;
    const target = link.target as LayoutNode;
    setTooltip({
      key: linkKey(link),
      title: source.id === sourceId ? target.label : `${source.label} → ${target.label}`,
      lines: [
        source.id === sourceId
          ? `${formatApplicationCount(link.value)} · ${percent(link.value, total)} of all`
          : `${formatApplicationCount(link.value)} · ${percent(link.value, source.count)} of ${source.label}`,
      ],
      x: ((source.x1 ?? 0) + (target.x0 ?? 0)) / 2,
      y: ((link.y0 ?? 0) + (link.y1 ?? 0)) / 2,
    });
  }

  function linkOpacity(link: LayoutLink) {
    if (!tooltip) return 0.3;
    const source = link.source as LayoutNode;
    const target = link.target as LayoutNode;
    const isActive =
      tooltip.key === linkKey(link) || activeNode === source.id || activeNode === target.id;
    return isActive ? 0.55 : 0.12;
  }

  return (
    <div ref={containerRef} className="relative border-t border-border py-2">
      <svg
        viewBox={`0 0 ${width} ${chartHeight}`}
        className="block h-[380px] w-full"
        role="img"
        aria-label="Application pipeline: how applications moved between stages"
      >
        <g fill="none">
          {graph.links.map((link) => {
            const target = link.target as LayoutNode;
            const source = link.source as LayoutNode;
            return (
              <path
                key={linkKey(link)}
                data-testid={`sankey-link-${linkKey(link)}`}
                d={linkPath(link) ?? undefined}
                stroke={nodeColors[target.status] ?? "var(--chart-2)"}
                strokeWidth={Math.max(1, link.width ?? 0)}
                strokeOpacity={linkOpacity(link)}
                className="transition-[stroke-opacity] focus:outline-none"
                tabIndex={0}
                aria-label={`${source.label} to ${target.label}: ${formatApplicationCount(link.value)}`}
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
          const companies = showCompanyLogos ? (link.companies ?? []) : [];
          if (companies.length === 0) return null;

          // Logos sit at the end of the ribbon, where it has left the crossings behind and
          // runs straight into its stage.
          const startX = source.x1 ?? 0;
          const endX = target.x0 ?? 0;
          const row = layoutPipelineLogoRow(companies.length, (endX - startX) * 0.45);
          const firstX = endX - 8 - row.width + row.size / 2;

          return (
            <g
              key={`logos-${linkKey(link)}`}
              data-testid={`sankey-logos-${linkKey(link)}`}
              className="pointer-events-none"
            >
              {companies.map((company, index) => (
                <PipelineCompanyLogo
                  key={company.id}
                  clipId={`${clipIdPrefix}-${source.id}-${target.id}-${index}`}
                  company={company}
                  failed={failedLogos.has(company.id)}
                  onFailed={() => setFailedLogos((current) => new Set(current).add(company.id))}
                  size={row.size}
                  x={firstX + row.step * index}
                  y={linkYAt(link, firstX + row.step * index)}
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
          const labelX = isSource ? x0 : x1 + 8;
          const labelY = isSource ? 22 : (y0 + y1) / 2 - 2;

          return (
            <g
              key={node.id}
              data-testid={`sankey-node-${node.id}`}
              tabIndex={0}
              aria-label={`${node.label}: ${formatApplicationCount(node.count)}`}
              className="focus:outline-none"
              onMouseEnter={() => showNodeTooltip(node)}
              onMouseLeave={() => setTooltip(null)}
              onFocus={() => showNodeTooltip(node)}
              onBlur={() => setTooltip(null)}
            >
              <rect
                x={x0}
                y={y0}
                width={Math.max(1, x1 - x0)}
                height={Math.max(2, y1 - y0)}
                rx={3}
                fill={nodeColors[node.status] ?? "var(--chart-2)"}
                stroke={activeNode === node.id ? "var(--ring)" : "none"}
                strokeWidth={2}
              />
              <text
                x={labelX}
                y={labelY}
                textAnchor="start"
                paintOrder="stroke"
                stroke="var(--card)"
                strokeWidth={4}
                strokeLinejoin="round"
                className="pointer-events-none fill-foreground"
              >
                <tspan className="text-[15px] font-semibold tabular-nums">{node.count}</tspan>
                <tspan x={labelX} dy={14} className="fill-muted-foreground text-[11px]">
                  {node.label}
                </tspan>
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
            top: tooltip.y - 8,
          }}
        >
          <p className="font-medium">{tooltip.title}</p>
          {tooltip.lines.map((line) => (
            <p key={line} className="mt-0.5 text-muted-foreground">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// Height of the centre of a horizontal Sankey ribbon at `x`. The ribbon is a cubic Bézier whose
// control points share the midpoint's x, so x grows with t and a bisection finds it.
function linkYAt(link: LayoutLink, x: number) {
  const x0 = (link.source as LayoutNode).x1 ?? 0;
  const x1 = (link.target as LayoutNode).x0 ?? 0;
  const y0 = link.y0 ?? 0;
  const y1 = link.y1 ?? 0;
  const xm = (x0 + x1) / 2;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 24; step += 1) {
    const t = (low + high) / 2;
    const xt = (1 - t) ** 3 * x0 + 3 * (1 - t) * t * xm + t ** 3 * x1;
    if (xt < x) low = t;
    else high = t;
  }
  const t = (low + high) / 2;
  return ((1 - t) ** 3 + 3 * (1 - t) ** 2 * t) * y0 + (3 * (1 - t) * t ** 2 + t ** 3) * y1;
}

function linkKey(link: LayoutLink) {
  return `${(link.source as LayoutNode).id}>${(link.target as LayoutNode).id}`;
}

function percent(count: number, of: number) {
  return `${of === 0 ? 0 : Math.round((count / of) * 100)}%`;
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
