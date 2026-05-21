'use client';

import { useMemo, useState } from 'react';
import {
  GRAPH_ROLE_LABELS,
  GRAPH_TYPE_LABELS,
  GRAPH_TYPE_ORDER,
  type GraphNode,
  type GraphNodeType
} from '@/lib/model/graph';

/**
 * Visual hub-and-spoke graph view.
 *
 * v1 layout: `this_company` org (or the first org if none flagged) sits in
 * the center; the five POLE+O categories are positioned in radial arcs
 * around it; lines connect every peripheral node to the center, making the
 * "this company is at the heart of its world" structure explicit.
 *
 * Why not explicit edges between peripheral nodes? Adding inter-node
 * relationships is a substantial schema + agent extraction lift. The
 * hub-and-spoke is a real graph (nodes + edges) that's grounded in the
 * data we already have. Explicit relationships are a follow-up.
 */

interface PositionedNode {
  node: GraphNode;
  x: number;
  y: number;
}

const W = 720;
const H = 560;
const CENTER_X = W / 2;
const CENTER_Y = H / 2;
const CENTER_R = 56;        // visual radius of the center node
const RING_RADIUS = 220;     // distance from center to each cluster center
const NODE_R = 6;            // radius of peripheral node dot

// Angle (degrees, 0 = right, going counter-clockwise) per type. Spread
// evenly with a small offset so people/team are top.
const TYPE_ANGLE_DEG: Record<GraphNodeType, number> = {
  person: 90,
  org: 162,
  location: 234,
  event: 306,
  object: 18
};

function deg2rad(d: number) {
  return (d * Math.PI) / 180;
}

function positionsForCluster(
  centerDeg: number,
  count: number,
  spreadDeg = 56,
  innerR = RING_RADIUS - 40,
  outerR = RING_RADIUS + 40
): Array<{ x: number; y: number }> {
  if (count === 0) return [];
  if (count === 1) {
    const r = deg2rad(centerDeg);
    return [
      {
        x: CENTER_X + RING_RADIUS * Math.cos(r),
        y: CENTER_Y - RING_RADIUS * Math.sin(r)
      }
    ];
  }
  const out: Array<{ x: number; y: number }> = [];
  // Arrange in a small fan. Rows alternate inner/outer for more breathing room.
  const half = spreadDeg / 2;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const angle = centerDeg - half + t * spreadDeg;
    const r = i % 2 === 0 ? RING_RADIUS : i % 3 === 0 ? innerR : outerR;
    out.push({
      x: CENTER_X + r * Math.cos(deg2rad(angle)),
      y: CENTER_Y - r * Math.sin(deg2rad(angle))
    });
  }
  return out;
}

const NODE_COLORS: Record<GraphNodeType, string> = {
  person: '#3b82f6',     // blue
  org: '#c64a1f',        // brand orange (fallback if --brand unset)
  location: '#10b981',   // green
  event: '#a855f7',      // purple
  object: '#f59e0b'      // amber
};

export function ContextGraphView({ nodes }: { nodes: GraphNode[] }) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  const { center, peripheral } = useMemo(() => {
    const live = nodes.filter(n => !n.deletedAt);
    const centerNode =
      live.find(n => n.type === 'org' && n.role === 'this_company') ??
      live.find(n => n.type === 'org') ??
      null;

    // Group peripherals by type.
    const byType = new Map<GraphNodeType, GraphNode[]>();
    for (const t of GRAPH_TYPE_ORDER) byType.set(t, []);
    for (const n of live) {
      if (n === centerNode) continue;
      byType.get(n.type)?.push(n);
    }

    // Position each cluster.
    const positioned: PositionedNode[] = [];
    for (const t of GRAPH_TYPE_ORDER) {
      const cluster = byType.get(t) ?? [];
      const positions = positionsForCluster(TYPE_ANGLE_DEG[t], cluster.length);
      cluster.forEach((node, i) => positioned.push({ node, x: positions[i].x, y: positions[i].y }));
    }

    return { center: centerNode, peripheral: positioned };
  }, [nodes]);

  const hoverNode = peripheral.find(p => p.node.id === hoverId);

  if (peripheral.length === 0 && !center) {
    return (
      <div className="rounded-md border border-dashed border-ink-200 bg-ink-50/40 p-6 text-center text-xs text-ink-500">
        Add some nodes to see the graph.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-md border border-ink-100 bg-ink-50/30">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="auto"
        className="block"
        role="img"
        aria-label="POLE+O context graph"
      >
        {/* Spokes: from center to each peripheral node */}
        {peripheral.map(p => (
          <line
            key={`edge-${p.node.id}`}
            x1={CENTER_X}
            y1={CENTER_Y}
            x2={p.x}
            y2={p.y}
            stroke="rgba(86,86,77,0.18)"
            strokeWidth={hoverId === p.node.id ? 1.5 : 1}
          />
        ))}

        {/* Type labels on the perimeter */}
        {GRAPH_TYPE_ORDER.map(t => {
          const angle = TYPE_ANGLE_DEG[t];
          const r = RING_RADIUS + 80;
          const x = CENTER_X + r * Math.cos(deg2rad(angle));
          const y = CENTER_Y - r * Math.sin(deg2rad(angle));
          return (
            <text
              key={`label-${t}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-ink-400"
              fontSize="11"
              fontWeight="600"
              letterSpacing="0.05em"
            >
              {GRAPH_TYPE_LABELS[t].toUpperCase()}
            </text>
          );
        })}

        {/* Center node */}
        <g>
          <circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={CENTER_R}
            fill="var(--brand, #c64a1f)"
            opacity={0.92}
          />
          <text
            x={CENTER_X}
            y={CENTER_Y - 4}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-white"
            fontSize="13"
            fontWeight="600"
          >
            {center ? truncate(center.name, 14) : 'company'}
          </text>
          <text
            x={CENTER_X}
            y={CENTER_Y + 14}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-white/80"
            fontSize="9"
            letterSpacing="0.05em"
          >
            THIS COMPANY
          </text>
        </g>

        {/* Peripheral nodes */}
        {peripheral.map(p => (
          <g
            key={p.node.id}
            onMouseEnter={() => setHoverId(p.node.id)}
            onMouseLeave={() => setHoverId(prev => (prev === p.node.id ? null : prev))}
            className="cursor-default"
          >
            <circle
              cx={p.x}
              cy={p.y}
              r={hoverId === p.node.id ? NODE_R + 2 : NODE_R}
              fill={NODE_COLORS[p.node.type]}
              opacity={hoverId === null || hoverId === p.node.id ? 1 : 0.55}
              stroke="white"
              strokeWidth={1.5}
            />
            <text
              x={p.x}
              y={p.y + NODE_R + 12}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-ink-700 pointer-events-none select-none"
              fontSize="10.5"
              opacity={hoverId === null || hoverId === p.node.id ? 1 : 0.45}
            >
              {truncate(p.node.name, 20)}
            </text>
          </g>
        ))}
      </svg>

      {hoverNode && (
        <div className="pointer-events-none absolute left-3 top-3 max-w-[260px] rounded-md border border-ink-200 bg-white/95 px-3 py-2 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
            {GRAPH_TYPE_LABELS[hoverNode.node.type]} ·{' '}
            {GRAPH_ROLE_LABELS[hoverNode.node.role] ?? hoverNode.node.role}
          </p>
          <p className="mt-1 text-sm font-medium text-ink-900">{hoverNode.node.name}</p>
          {hoverNode.node.notes && (
            <p className="mt-1 text-xs leading-snug text-ink-600">{hoverNode.node.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}
