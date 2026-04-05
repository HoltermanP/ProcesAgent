"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProjectSelector from "@/components/ui/ProjectSelector";
import { Card, SectionHeader, Badge, EmptyState } from "@/components/ui/Card";
import BuildTerminal, { type TerminalLine } from "@/components/ui/BuildTerminal";
import { type Project, type ProcessStep, type Agent } from "@/lib/db";

// ── Types ────────────────────────────────────────────────────────────────────

interface BuildEvent {
  type: "start" | "init" | "tool" | "text" | "result" | "error";
  buildId?: string;
  buildDir?: string;
  name?: string;
  input?: unknown;
  text?: string;
  result?: string;
  fatal?: boolean;
  sessionId?: string;
}

interface DownloadFile {
  path: string;
  content: string;
}

interface StaticBuildData {
  files: Record<string, string>;
  project: Project;
  steps: ProcessStep[];
  agents: Agent[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatToolDetail(name: string, input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const inp = input as Record<string, unknown>;
  if (name === "Write" || name === "Edit") return String(inp.file_path ?? inp.path ?? "");
  if (name === "Bash") return String(inp.command ?? "").slice(0, 80);
  if (name === "Read") return String(inp.file_path ?? "");
  if (name === "Glob") return String(inp.pattern ?? "");
  if (name === "Grep") return String(inp.pattern ?? "");
  return JSON.stringify(input).slice(0, 60);
}

// ── Main component ────────────────────────────────────────────────────────────

function BouwenInner() {
  const searchParams = useSearchParams();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  // Live build state
  const [isBuilding, setIsBuilding] = useState(false);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [buildId, setBuildId] = useState<string | null>(null);
  const [buildDone, setBuildDone] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Static file viewer state
  const [staticFiles, setStaticFiles] = useState<Record<string, string> | null>(null);
  const [activeFile, setActiveFile] = useState<string>("app/page.tsx");
  const [isLoadingStatic, setIsLoadingStatic] = useState(false);
  const [activeTab, setActiveTab] = useState<"live" | "files">("live");

  // ── Load project from URL ──
  useEffect(() => {
    const pid = searchParams.get("projectId");
    if (pid && !selectedProject) {
      fetch(`/api/projects/${pid}`)
        .then((r) => r.json())
        .then((p: Project) => setSelectedProject(p))
        .catch(() => {});
    }
  }, [searchParams, selectedProject]);

  // ── Load steps + agents when project changes ──
  useEffect(() => {
    if (!selectedProject) return;
    Promise.all([
      fetch(`/api/agents?projectId=${selectedProject.id}`).then((r) => r.json()) as Promise<{ steps: ProcessStep[]; agents: Agent[] }>,
    ]).then(([data]) => {
      setSteps(data.steps ?? []);
      setAgents(data.agents ?? []);
    }).catch(() => {});
  }, [selectedProject]);

  // ── Live build via Claude Code SDK ──
  const handleLiveBuild = useCallback(async () => {
    if (!selectedProject) return;
    setIsBuilding(true);
    setBuildDone(false);
    setBuildError(null);
    setBuildId(null);
    setTerminalLines([
      { type: "info", text: `▸ Starten met bouwen: ${selectedProject.name}` },
      { type: "info", text: `▸ Claude Code wordt gestart…` },
    ]);
    setActiveTab("live");

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/build-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProject.id }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Build API mislukt");
      }
      if (!res.body) throw new Error("Geen stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const dataLine = part.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          try {
            const event = JSON.parse(dataLine.slice(6)) as BuildEvent;

            if (event.type === "start") {
              setBuildId(event.buildId ?? null);
              setTerminalLines((prev) => [
                ...prev,
                { type: "info", text: `▸ Build ID: ${event.buildId}` },
                { type: "info", text: `▸ Directory: ${event.buildDir}` },
              ]);
            }

            if (event.type === "tool" && event.name) {
              setTerminalLines((prev) => [
                ...prev,
                {
                  type: "tool",
                  name: event.name!,
                  detail: formatToolDetail(event.name!, event.input),
                },
              ]);
            }

            if (event.type === "text" && event.text) {
              setTerminalLines((prev) => [
                ...prev,
                { type: "text", text: event.text! },
              ]);
            }

            if (event.type === "result") {
              setBuildDone(true);
              setTerminalLines((prev) => [
                ...prev,
                { type: "success", text: "✓ Build voltooid!" },
                { type: "info", text: event.result ?? "" },
              ]);
            }

            if (event.type === "error") {
              setBuildError(event.text ?? "Onbekende fout");
              setTerminalLines((prev) => [
                ...prev,
                { type: "error", text: event.text ?? "Build fout" },
              ]);
              if (event.fatal) break;
            }
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setTerminalLines((prev) => [...prev, { type: "info", text: "▸ Build gestopt." }]);
      } else {
        const msg = err instanceof Error ? err.message : "Onbekende fout";
        setBuildError(msg);
        setTerminalLines((prev) => [...prev, { type: "error", text: msg }]);
      }
    } finally {
      setIsBuilding(false);
    }
  }, [selectedProject]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // ── Download built files ──
  const handleDownloadBuilt = useCallback(async () => {
    if (!buildId) return;
    const res = await fetch(`/api/build-download?buildId=${buildId}`);
    if (!res.ok) return;
    const data = (await res.json()) as { files: DownloadFile[] };
    data.files.forEach(({ path, content }) => {
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = path.replace(/\//g, "_");
      a.click();
      URL.revokeObjectURL(url);
    });
  }, [buildId]);

  // ── Static file preview (pre-generated) ──
  const handleLoadStatic = useCallback(async () => {
    if (!selectedProject) return;
    setIsLoadingStatic(true);
    try {
      const res = await fetch(`/api/build?projectId=${selectedProject.id}`);
      if (res.ok) {
        const data = (await res.json()) as StaticBuildData;
        setStaticFiles(data.files);
        setActiveFile("app/page.tsx");
        setActiveTab("files");
      }
    } finally {
      setIsLoadingStatic(false);
    }
  }, [selectedProject]);

  const handleCopyFile = useCallback(async (content: string) => {
    await navigator.clipboard.writeText(content);
  }, []);

  // ── UI ───────────────────────────────────────────────────────────────────
  const agentCount = agents.length;
  const stepsWithAgent = steps.filter((s) => agents.some((a) => a.process_step_id === s.id)).length;

  return (
    <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 py-6 gap-4">
      <div>
        <p className="label-tag mb-1">Stap 05</p>
        <h1 className="page-heading text-2xl">Applicatie Bouwen</h1>
        <p className="text-slate text-sm mt-1">
          Claude Code bouwt de applicatie direct — inclusief alle processtappen, agents en aan/uit toggles.
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 min-h-0">
        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <ProjectSelector
            selectedId={selectedProject?.id ?? null}
            onSelect={(p) => {
              setSelectedProject(p);
              setTerminalLines([]);
              setBuildDone(false);
              setBuildError(null);
              setBuildId(null);
              setStaticFiles(null);
            }}
            onNew={() => {}}
          />

          {selectedProject && (
            <>
              {/* Project stats */}
              <Card>
                <div className="space-y-2 text-sm">
                  {[
                    ["Processtappen", steps.length],
                    ["Agents", agentCount],
                    ["Stappen met agent", stepsWithAgent],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-slate text-xs">{label}</span>
                      <span className="text-blue-light font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Build actions */}
              <Card>
                <SectionHeader title="Claude Code" subtitle="Bouwt de volledige app" />

                {!isBuilding ? (
                  <button
                    onClick={() => void handleLiveBuild()}
                    disabled={steps.length === 0}
                    className="btn-cta w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M7 1l1.5 4.5H13l-3.75 2.75 1.5 4.5L7 10 3.25 12.75l1.5-4.5L1 5.5h4.5z" fill="currentColor"/>
                    </svg>
                    Bouwen met Claude Code
                  </button>
                ) : (
                  <button
                    onClick={handleStop}
                    className="w-full py-2.5 border border-velocity-red text-velocity-red rounded text-sm hover:bg-velocity-red/10 transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="w-2 h-2 bg-velocity-red rounded-sm" />
                    Stop build
                  </button>
                )}

                {buildDone && buildId && (
                  <button
                    onClick={() => void handleDownloadBuilt()}
                    className="btn-primary w-full mt-2 py-2 text-sm"
                  >
                    Download gegenereerde bestanden
                  </button>
                )}

                {buildError && !isBuilding && (
                  <p className="text-velocity-red text-xs mt-2 bg-velocity-red/10 border border-velocity-red/20 rounded p-2">
                    {buildError}
                  </p>
                )}

                <div className="mt-3 pt-3 border-t border-border text-[10px] text-slate space-y-1">
                  <p>Vereist: <code className="text-off-white">claude</code> CLI geïnstalleerd</p>
                  <p>
                    <code className="text-off-white">npm install -g @anthropic-ai/claude-code</code>
                  </p>
                </div>
              </Card>

              {/* Alternative: static preview */}
              <Card>
                <SectionHeader title="Voorbeeld Code" subtitle="Gegenereerde template" />
                <button
                  onClick={() => void handleLoadStatic()}
                  disabled={isLoadingStatic}
                  className="btn-outline w-full text-sm py-2"
                >
                  {isLoadingStatic ? "Laden…" : "Bekijk code template"}
                </button>
              </Card>

              {/* Agents list */}
              {agents.length > 0 && (
                <Card>
                  <SectionHeader title="Agents in app" />
                  <div className="space-y-2">
                    {agents.map((agent) => {
                      const step = steps.find((s) => s.id === agent.process_step_id);
                      return (
                        <div key={agent.id} className="flex items-start justify-between text-xs">
                          <div className="min-w-0 mr-2">
                            <p className="text-off-white truncate">{agent.name}</p>
                            {step && <p className="text-slate truncate">↳ {step.name}</p>}
                          </div>
                          <Badge variant="blue">{agent.agent_type}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Main area */}
        <div className="flex flex-col min-h-0 gap-3">
          {!selectedProject ? (
            <div className="bg-surface border border-border rounded-card flex items-center justify-center min-h-[500px]">
              <EmptyState
                title="Geen project geselecteerd"
                description="Selecteer een project om Claude Code te starten."
              />
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-1 border-b border-border pb-1">
                {(["live", "files"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 text-sm rounded-t transition-colors ${
                      activeTab === tab
                        ? "bg-surface text-off-white border border-border border-b-surface -mb-px"
                        : "text-slate hover:text-off-white"
                    }`}
                  >
                    {tab === "live" ? "Live Build" : "Code Template"}
                  </button>
                ))}
              </div>

              {activeTab === "live" ? (
                <BuildTerminal
                  lines={terminalLines}
                  isRunning={isBuilding}
                  className="flex-1 min-h-[500px] max-h-[700px]"
                />
              ) : staticFiles ? (
                <div className="flex gap-3 flex-1 min-h-[500px]">
                  {/* File list */}
                  <div className="w-48 shrink-0 bg-surface border border-border rounded-card p-2 overflow-y-auto">
                    <p className="label-tag mb-2 px-1">Bestanden</p>
                    {Object.keys(staticFiles).map((f) => (
                      <button
                        key={f}
                        onClick={() => setActiveFile(f)}
                        className={`w-full text-left px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                          activeFile === f
                            ? "bg-ai-blue/20 text-blue-light"
                            : "text-slate hover:text-off-white"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  {/* Code viewer */}
                  <div className="flex-1 bg-surface border border-border rounded-card flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
                      <span className="text-blue-light font-mono text-xs">{activeFile}</span>
                      <button
                        onClick={() => void handleCopyFile(staticFiles[activeFile] ?? "")}
                        className="text-xs text-slate hover:text-off-white"
                      >
                        Kopieer
                      </button>
                    </div>
                    <pre className="flex-1 overflow-auto p-3 text-xs font-mono text-off-white leading-relaxed whitespace-pre">
                      {staticFiles[activeFile] ?? ""}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="bg-surface border border-border rounded-card flex items-center justify-center min-h-[500px]">
                  <EmptyState
                    title="Start de build"
                    description="Klik op 'Bouwen met Claude Code' om Claude Code te starten, of bekijk de code template."
                    action={
                      <button
                        onClick={() => void handleLiveBuild()}
                        disabled={steps.length === 0}
                        className="btn-cta disabled:opacity-50"
                      >
                        Bouwen met Claude Code
                      </button>
                    }
                  />
                </div>
              )}

              {/* Setup instructions */}
              {buildDone && (
                <Card>
                  <SectionHeader title="Installatie" subtitle="Draai de gebouwde app" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {[
                      { step: "01", cmd: "Navigeer", detail: "Bestanden staan in de getoonde directory" },
                      { step: "02", cmd: "Installeer", detail: "npm install" },
                      { step: "03", cmd: "Configureer", detail: "cp .env.example .env.local" },
                      { step: "04", cmd: "Start", detail: "npm run dev" },
                    ].map((item) => (
                      <div key={item.step} className="bg-deep-black border border-border rounded p-3">
                        <p className="kpi-number text-sm mb-1">{item.step}</p>
                        <p className="text-off-white font-medium mb-0.5">{item.cmd}</p>
                        <code className="text-slate break-all">{item.detail}</code>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BouwenPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate text-sm">Laden…</p>
        </div>
      }
    >
      <BouwenInner />
    </Suspense>
  );
}
