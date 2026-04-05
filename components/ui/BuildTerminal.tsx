"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type TerminalLine =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; detail: string }
  | { type: "error"; text: string }
  | { type: "success"; text: string }
  | { type: "info"; text: string };

interface BuildTerminalProps {
  lines: TerminalLine[];
  isRunning: boolean;
  className?: string;
}

export default function BuildTerminal({ lines, isRunning, className }: BuildTerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const TOOL_ICONS: Record<string, string> = {
    Write: "✎",
    Edit: "✎",
    Read: "◎",
    Bash: "$",
    Glob: "⌕",
    Grep: "⌕",
  };

  const TOOL_COLORS: Record<string, string> = {
    Write: "text-green-400",
    Edit: "text-yellow-400",
    Read: "text-blue-400",
    Bash: "text-purple-400",
  };

  return (
    <div
      className={cn(
        "bg-[#0d0d0d] border border-[#1a1a1a] rounded-card font-mono text-xs overflow-y-auto",
        className
      )}
      role="log"
      aria-label="Build output"
      aria-live="polite"
    >
      {/* Terminal header */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#1a1a1a] bg-[#111] sticky top-0">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-slate text-[10px]">Claude Code — ProcesAgents Builder</span>
        {isRunning && (
          <span className="ml-auto flex items-center gap-1 text-blue-light">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-light animate-pulse" />
            bouwen…
          </span>
        )}
      </div>

      {/* Output */}
      <div className="p-3 space-y-0.5 min-h-[200px]">
        {lines.length === 0 && !isRunning && (
          <p className="text-[#333]">Druk op &quot;Bouwen met Claude Code&quot; om te starten…</p>
        )}

        {lines.map((line, i) => {
          if (line.type === "tool") {
            const icon = TOOL_ICONS[line.name] ?? "▸";
            const color = TOOL_COLORS[line.name] ?? "text-slate";
            return (
              <div key={i} className="flex items-start gap-2">
                <span className={cn("shrink-0 w-4 text-center", color)}>{icon}</span>
                <span className={cn("shrink-0 font-bold", color)}>{line.name}</span>
                <span className="text-[#555] truncate max-w-[500px]">{line.detail}</span>
              </div>
            );
          }

          if (line.type === "error") {
            return (
              <div key={i} className="flex items-start gap-2 text-red-400">
                <span className="shrink-0">✗</span>
                <span className="whitespace-pre-wrap">{line.text}</span>
              </div>
            );
          }

          if (line.type === "success") {
            return (
              <div key={i} className="flex items-start gap-2 text-green-400">
                <span className="shrink-0">✓</span>
                <span className="whitespace-pre-wrap">{line.text}</span>
              </div>
            );
          }

          if (line.type === "info") {
            return (
              <div key={i} className="text-slate">
                {line.text}
              </div>
            );
          }

          // text
          return (
            <div key={i} className="text-[#ccc] whitespace-pre-wrap leading-relaxed">
              {line.text}
            </div>
          );
        })}

        {isRunning && (
          <div className="flex items-center gap-1 text-blue-light mt-1">
            <span className="animate-pulse">▋</span>
          </div>
        )}

        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </div>
  );
}
