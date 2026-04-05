"use client";

import { useEffect, useRef, useState } from "react";

export interface CanvasNode {
  id: string;
  type: "start" | "end" | "task" | "decision" | "agent";
  label: string;
  x: number;
  y: number;
  agentOpportunity?: boolean;
  opportunityScore?: number;
}

export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

const NODE_WIDTH = 160;
const NODE_HEIGHT = 48;

const TYPE_STYLES: Record<CanvasNode["type"], { bg: string; border: string; text: string; shape?: string }> = {
  start:    { bg: "#1a3a1a", border: "#22c55e", text: "#22c55e" },
  end:      { bg: "#3a1a1a", border: "#ef4444", text: "#ef4444" },
  task:     { bg: "#111116", border: "#1E1E28", text: "#F4F6FA" },
  decision: { bg: "#1a2a3a", border: "#4B8EFF", text: "#4B8EFF", shape: "diamond" },
  agent:    { bg: "#0D1428", border: "#2D6FE8", text: "#4B8EFF" },
};

interface ProcessCanvasProps {
  data: CanvasData;
  className?: string;
}

export default function ProcessCanvas({ data, className }: ProcessCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState("0 0 800 400");

  useEffect(() => {
    if (data.nodes.length === 0) return;
    const xs = data.nodes.map((n) => n.x);
    const ys = data.nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 40;
    const minY = Math.min(...ys) - 40;
    const maxX = Math.max(...xs) + NODE_WIDTH + 40;
    const maxY = Math.max(...ys) + NODE_HEIGHT + 60;
    setViewBox(`${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
  }, [data]);

  const getNodeCenter = (nodeId: string) => {
    const node = data.nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    return { x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT / 2 };
  };

  return (
    <div className={`bg-deep-black border border-border rounded-card overflow-auto ${className ?? ""}`}>
      {data.nodes.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-slate text-sm">Nog geen procesmodel gegenereerd.</p>
        </div>
      ) : (
        <svg
          ref={svgRef}
          viewBox={viewBox}
          className="w-full min-h-[300px]"
          style={{ minHeight: 300 }}
          role="img"
          aria-label="Procesdiagram"
        >
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#6B82A8" />
            </marker>
          </defs>

          {/* Edges */}
          {data.edges.map((edge) => {
            const from = getNodeCenter(edge.from);
            const to = getNodeCenter(edge.to);
            const mx = (from.x + to.x) / 2;
            const my = (from.y + to.y) / 2;
            return (
              <g key={edge.id}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="#1E1E28"
                  strokeWidth="1.5"
                  markerEnd="url(#arrowhead)"
                />
                {edge.label && (
                  <text x={mx} y={my - 6} textAnchor="middle" fill="#6B82A8" fontSize="10">
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {data.nodes.map((node) => {
            const style = TYPE_STYLES[node.type] ?? TYPE_STYLES.task;
            const isOpp = node.agentOpportunity;

            if (node.type === "start" || node.type === "end") {
              return (
                <g key={node.id}>
                  <circle
                    cx={node.x + NODE_WIDTH / 2}
                    cy={node.y + NODE_HEIGHT / 2}
                    r={NODE_HEIGHT / 2}
                    fill={style.bg}
                    stroke={style.border}
                    strokeWidth="1.5"
                  />
                  <text
                    x={node.x + NODE_WIDTH / 2}
                    y={node.y + NODE_HEIGHT / 2 + 4}
                    textAnchor="middle"
                    fill={style.text}
                    fontSize="11"
                    fontWeight="600"
                    fontFamily="monospace"
                  >
                    {node.label}
                  </text>
                </g>
              );
            }

            if (node.type === "decision") {
              const cx = node.x + NODE_WIDTH / 2;
              const cy = node.y + NODE_HEIGHT / 2;
              const hw = NODE_WIDTH / 2;
              const hh = NODE_HEIGHT / 2 + 4;
              return (
                <g key={node.id}>
                  <polygon
                    points={`${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`}
                    fill={style.bg}
                    stroke={style.border}
                    strokeWidth="1.5"
                  />
                  <text
                    x={cx}
                    y={cy + 4}
                    textAnchor="middle"
                    fill={style.text}
                    fontSize="10"
                    fontWeight="600"
                  >
                    {node.label.length > 16 ? node.label.slice(0, 14) + "…" : node.label}
                  </text>
                </g>
              );
            }

            return (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx="6"
                  fill={style.bg}
                  stroke={isOpp ? "#4B8EFF" : style.border}
                  strokeWidth={isOpp ? "2" : "1.5"}
                />
                {isOpp && (
                  <rect
                    x={node.x}
                    y={node.y}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx="6"
                    fill="url(#agentGlow)"
                    stroke="none"
                    opacity="0.2"
                  />
                )}
                <text
                  x={node.x + NODE_WIDTH / 2}
                  y={node.y + NODE_HEIGHT / 2 - (node.type === "agent" ? 5 : 0)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={style.text}
                  fontSize="11"
                  fontWeight={node.type === "agent" ? "600" : "400"}
                >
                  {node.label.length > 18 ? node.label.slice(0, 16) + "…" : node.label}
                </text>
                {node.type === "agent" && (
                  <text
                    x={node.x + NODE_WIDTH / 2}
                    y={node.y + NODE_HEIGHT / 2 + 10}
                    textAnchor="middle"
                    fill="#4B8EFF"
                    fontSize="8"
                    fontFamily="monospace"
                  >
                    AGENT
                  </text>
                )}
                {isOpp && node.opportunityScore !== undefined && (
                  <text
                    x={node.x + NODE_WIDTH - 6}
                    y={node.y + 14}
                    textAnchor="end"
                    fill="#4B8EFF"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {node.opportunityScore}/10
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
