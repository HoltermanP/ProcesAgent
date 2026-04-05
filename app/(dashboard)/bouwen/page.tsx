"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProjectSelector from "@/components/ui/ProjectSelector";
import { Card, SectionHeader, Badge, EmptyState } from "@/components/ui/Card";
import { type Project, type ProcessStep, type Agent } from "@/lib/db";

interface BuildData {
  files: Record<string, string>;
  project: Project;
  steps: ProcessStep[];
  agents: Agent[];
}

const FILE_ORDER = [
  "app/page.tsx",
  "app/api/run-agent/route.ts",
  "app/layout.tsx",
  "app/globals.css",
  "package.json",
  "next.config.mjs",
  "tailwind.config.ts",
  "tsconfig.json",
  ".env.example",
];

function BouwenInner() {
  const searchParams = useSearchParams();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [buildData, setBuildData] = useState<BuildData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFile, setActiveFile] = useState<string>("app/page.tsx");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const pid = searchParams.get("projectId");
    if (pid && !selectedProject) {
      fetch(`/api/projects/${pid}`)
        .then((r) => r.json())
        .then((p: Project) => setSelectedProject(p))
        .catch(() => {});
    }
  }, [searchParams, selectedProject]);

  const loadBuild = useCallback(async (projectId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/build?projectId=${projectId}`);
      if (!res.ok) throw new Error("Generatie mislukt");
      const data = (await res.json()) as BuildData;
      setBuildData(data);
      setActiveFile("app/page.tsx");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProject) void loadBuild(selectedProject.id);
  }, [selectedProject, loadBuild]);

  const handleCopy = useCallback(
    async (filename: string) => {
      if (!buildData?.files[filename]) return;
      await navigator.clipboard.writeText(buildData.files[filename]);
      setCopied(filename);
      setTimeout(() => setCopied(null), 2000);
    },
    [buildData]
  );

  const handleDownloadAll = useCallback(() => {
    if (!buildData) return;
    // Download each file individually via anchor tags
    Object.entries(buildData.files).forEach(([filename, content]) => {
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.replace(/\//g, "_");
      a.click();
      URL.revokeObjectURL(url);
    });
  }, [buildData]);

  const handleDownloadFile = useCallback(
    (filename: string) => {
      const content = buildData?.files[filename];
      if (!content) return;
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.split("/").pop() ?? filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    [buildData]
  );

  const orderedFiles = buildData
    ? [
        ...FILE_ORDER.filter((f) => buildData.files[f]),
        ...Object.keys(buildData.files).filter((f) => !FILE_ORDER.includes(f)),
      ]
    : [];

  const agentCount = buildData?.agents.length ?? 0;
  const stepsWithAgent = buildData?.steps.filter((s) =>
    buildData.agents.some((a) => a.process_step_id === s.id)
  ).length ?? 0;

  return (
    <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 py-6 gap-4">
      <div>
        <p className="label-tag mb-1">Stap 05</p>
        <h1 className="page-heading text-2xl">Applicatie Bouwen</h1>
        <p className="text-slate text-sm mt-1">
          Genereer een werkende Next.js app met je procesflow, agents per stap en aan/uit toggles.
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 min-h-0">
        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <ProjectSelector
            selectedId={selectedProject?.id ?? null}
            onSelect={(p) => {
              setSelectedProject(p);
              setBuildData(null);
            }}
            onNew={() => {}}
          />

          {buildData && (
            <>
              {/* Stats */}
              <Card>
                <div className="space-y-2 text-sm">
                  {[
                    ["Processtappen", buildData.steps.length],
                    ["Agents", agentCount],
                    ["Stappen met agent", stepsWithAgent],
                    ["Gegenereerde files", Object.keys(buildData.files).length],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-slate text-xs">{label}</span>
                      <span className="text-blue-light font-mono text-sm">{value}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* File list */}
              <Card>
                <SectionHeader title="Bestanden" />
                <div className="space-y-0.5">
                  {orderedFiles.map((filename) => (
                    <button
                      key={filename}
                      onClick={() => setActiveFile(filename)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono transition-colors ${
                        activeFile === filename
                          ? "bg-ai-blue/20 text-blue-light"
                          : "text-slate hover:text-off-white hover:bg-deep-black/50"
                      }`}
                    >
                      {filename}
                    </button>
                  ))}
                </div>
              </Card>

              {/* Download */}
              <button
                onClick={handleDownloadAll}
                className="btn-cta w-full py-2.5 text-sm"
              >
                Download alle bestanden
              </button>

              <p className="text-slate text-[10px] text-center leading-relaxed">
                Kopieer in een nieuwe map → <code className="text-off-white">npm install</code> → voeg <code className="text-off-white">ANTHROPIC_API_KEY</code> toe → <code className="text-off-white">npm run dev</code>
              </p>
            </>
          )}

          {/* Agents overview */}
          {buildData && buildData.agents.length > 0 && (
            <Card>
              <SectionHeader title="Agents in app" subtitle="Togglebaar per stap" />
              <div className="space-y-2">
                {buildData.agents.map((agent) => {
                  const step = buildData.steps.find(
                    (s) => s.id === agent.process_step_id
                  );
                  return (
                    <div key={agent.id} className="flex items-start justify-between text-xs">
                      <div className="min-w-0 mr-2">
                        <p className="text-off-white truncate">{agent.name}</p>
                        {step && (
                          <p className="text-slate truncate">↳ {step.name}</p>
                        )}
                      </div>
                      <Badge variant="blue">{agent.agent_type}</Badge>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Main: code viewer */}
        <div className="flex flex-col min-h-0">
          {!selectedProject ? (
            <div className="bg-surface border border-border rounded-card flex items-center justify-center min-h-[500px]">
              <EmptyState
                title="Geen project geselecteerd"
                description="Selecteer een project om de applicatie te genereren."
              />
            </div>
          ) : isLoading ? (
            <div className="bg-surface border border-border rounded-card flex items-center justify-center min-h-[500px]">
              <div className="text-center">
                <div className="w-10 h-10 border-2 border-ai-blue border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate text-sm">Applicatiecode genereren…</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-surface border border-border rounded-card flex items-center justify-center min-h-[500px]">
              <EmptyState
                title="Generatie mislukt"
                description={error}
                action={
                  <button
                    onClick={() => selectedProject && void loadBuild(selectedProject.id)}
                    className="btn-primary"
                  >
                    Probeer opnieuw
                  </button>
                }
              />
            </div>
          ) : buildData ? (
            <div className="bg-surface border border-border rounded-card flex flex-col flex-1 overflow-hidden min-h-[500px]">
              {/* File header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-blue-light font-mono text-sm">{activeFile}</span>
                  <span className="label-tag">
                    {buildData.files[activeFile]?.split("\n").length ?? 0} regels
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void handleCopy(activeFile)}
                    className="text-xs text-slate hover:text-off-white transition-colors"
                    aria-label="Kopieer naar klembord"
                  >
                    {copied === activeFile ? "Gekopieerd!" : "Kopieer"}
                  </button>
                  <button
                    onClick={() => handleDownloadFile(activeFile)}
                    className="text-xs text-blue-light hover:underline"
                  >
                    Download
                  </button>
                </div>
              </div>

              {/* Code */}
              <div className="flex-1 overflow-auto">
                <pre className="p-4 text-xs font-mono text-off-white leading-relaxed whitespace-pre">
                  {buildData.files[activeFile] ?? ""}
                </pre>
              </div>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-card flex items-center justify-center min-h-[500px]">
              <EmptyState
                title="Nog geen applicatie gegenereerd"
                description="Selecteer een project met processtappen en agents om de applicatie te genereren."
              />
            </div>
          )}

          {/* Setup instructions */}
          {buildData && (
            <Card className="mt-3">
              <SectionHeader title="Installatie" subtitle="Draai de gegenereerde app lokaal" />
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                {[
                  { step: "01", cmd: "Maak map aan", detail: "mkdir mijn-app && cd mijn-app" },
                  { step: "02", cmd: "Kopieer bestanden", detail: "Plak de gedownloade bestanden" },
                  { step: "03", cmd: "Installeer", detail: "npm install" },
                  { step: "04", cmd: "Start", detail: "ANTHROPIC_API_KEY=... npm run dev" },
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
