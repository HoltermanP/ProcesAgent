"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProcessCanvas, { type CanvasData } from "@/components/ui/ProcessCanvas";
import ProjectSelector from "@/components/ui/ProjectSelector";
import { Card, SectionHeader, EmptyState } from "@/components/ui/Card";
import { type Project, type ProcessStep } from "@/lib/db";
import { opportunityLabel, opportunityColor } from "@/lib/utils";
import Link from "next/link";

function VISUEELONTWERPInner() {
  const searchParams = useSearchParams();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [canvasData, setCanvasData] = useState<CanvasData>({ nodes: [], edges: [] });
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Auto-select project from URL
  useEffect(() => {
    const pid = searchParams.get("projectId");
    if (pid && !selectedProject) {
      fetch(`/api/projects/${pid}`)
        .then((r) => r.json())
        .then((p: Project) => setSelectedProject(p))
        .catch(() => {});
    }
  }, [searchParams, selectedProject]);

  // Load existing design
  useEffect(() => {
    if (!selectedProject) return;
    fetch(`/api/design?projectId=${selectedProject.id}`)
      .then((r) => r.json())
      .then((data: { process: { canvas_data: CanvasData } | null; steps: ProcessStep[] }) => {
        if (data.process?.canvas_data) {
          setCanvasData(data.process.canvas_data);
        }
        setSteps(data.steps ?? []);
      })
      .catch(() => {});
  }, [selectedProject]);

  const handleGenerate = useCallback(async () => {
    if (!selectedProject) return;
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProject.id,
          message: customPrompt || undefined,
        }),
      });

      if (!res.ok) throw new Error("Generatie mislukt");
      const data = (await res.json()) as { canvas: CanvasData | null; raw: string };

      if (data.canvas) {
        setCanvasData(data.canvas);
      }

      // Reload steps
      const designRes = await fetch(`/api/design?projectId=${selectedProject.id}`);
      const designData = (await designRes.json()) as { steps: ProcessStep[] };
      setSteps(designData.steps ?? []);
      setCustomPrompt("");
    } catch {
      setError("Generatie mislukt. Controleer je API-sleutel en probeer opnieuw.");
    } finally {
      setIsGenerating(false);
    }
  }, [selectedProject, customPrompt]);

  const agentOpportunities = steps.filter((s) => s.agent_opportunity);

  return (
    <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 py-6 gap-4">
      <div>
        <p className="label-tag mb-1">Stap 02</p>
        <h1 className="page-heading text-2xl">Visueel Ontwerp</h1>
        <p className="text-slate text-sm mt-1">
          Genereer een visueel procesdiagram en identificeer de beste plekken voor AI-agents.
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <ProjectSelector
            selectedId={selectedProject?.id ?? null}
            onSelect={(p) => {
              setSelectedProject(p);
              setCanvasData({ nodes: [], edges: [] });
              setSteps([]);
            }}
            onNew={() => {}}
          />

          {selectedProject && (
            <Card>
              <SectionHeader title="Genereren" />
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Optionele instructie (bijv. 'focus op het goedkeuringsproces')…"
                rows={3}
                className="w-full bg-deep-black border border-border rounded px-3 py-2 text-sm text-off-white placeholder-slate focus:outline-none focus:border-ai-blue/60 resize-none mb-3"
              />
              <button
                onClick={() => void handleGenerate()}
                disabled={isGenerating}
                className="btn-primary w-full"
              >
                {isGenerating ? "Genereren…" : "Genereer procesdiagram"}
              </button>
              {error && <p className="text-velocity-red text-xs mt-2">{error}</p>}
            </Card>
          )}

          {/* Agent opportunities */}
          {agentOpportunities.length > 0 && (
            <Card>
              <SectionHeader
                title="Agent Kansen"
                subtitle={`${agentOpportunities.length} stap${agentOpportunities.length !== 1 ? "pen" : ""}`}
              />
              <div className="space-y-2">
                {agentOpportunities.map((step) => (
                  <div key={step.id} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                    <span className="text-sm text-off-white truncate mr-2">{step.name}</span>
                    <span className={`text-xs font-mono shrink-0 ${opportunityColor(step.opportunity_score)}`}>
                      {opportunityLabel(step.opportunity_score)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {canvasData.nodes.length > 0 && (
            <Link
              href={`/agent-ontwerp${selectedProject ? `?projectId=${selectedProject.id}` : ""}`}
              className="btn-primary text-center text-sm py-2"
            >
              Naar agent ontwerp →
            </Link>
          )}
        </div>

        {/* Canvas area */}
        <div className="flex flex-col gap-3">
          {/* Stats */}
          {canvasData.nodes.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <Card className="py-3 text-center">
                <p className="kpi-number text-2xl">{canvasData.nodes.length}</p>
                <p className="label-tag mt-1">stappen</p>
              </Card>
              <Card className="py-3 text-center">
                <p className="kpi-number text-2xl">{canvasData.edges.length}</p>
                <p className="label-tag mt-1">verbindingen</p>
              </Card>
              <Card className="py-3 text-center">
                <p className={`text-2xl font-mono font-bold ${agentOpportunities.length > 0 ? "text-blue-light" : "text-slate"}`}>
                  {agentOpportunities.length}
                </p>
                <p className="label-tag mt-1">agent kansen</p>
              </Card>
            </div>
          )}

          {/* Canvas */}
          {!selectedProject ? (
            <div className="bg-surface border border-border rounded-card flex items-center justify-center min-h-[400px]">
              <EmptyState
                title="Geen project geselecteerd"
                description="Selecteer een project om het procesdiagram te bekijken."
              />
            </div>
          ) : isGenerating ? (
            <div className="bg-surface border border-border rounded-card flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="w-10 h-10 border-2 border-ai-blue border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate text-sm">Procesmodel genereren…</p>
              </div>
            </div>
          ) : canvasData.nodes.length === 0 ? (
            <div className="bg-surface border border-border rounded-card flex items-center justify-center min-h-[400px]">
              <EmptyState
                title="Geen procesdiagram"
                description="Genereer een procesdiagram op basis van je procesanalyse."
                action={
                  <button onClick={() => void handleGenerate()} className="btn-primary">
                    Genereer diagram
                  </button>
                }
              />
            </div>
          ) : (
            <ProcessCanvas
              data={canvasData}
              className="min-h-[400px]"
            />
          )}

          {/* Legend */}
          {canvasData.nodes.length > 0 && (
            <div className="flex items-center gap-4 flex-wrap text-xs text-slate">
              {[
                { color: "bg-green-900 border-green-600", label: "Start/Eind" },
                { color: "bg-surface border-border", label: "Taak" },
                { color: "bg-[#1a2a3a] border-blue-light", label: "Beslissing" },
                { color: "bg-navy border-ai-blue", label: "Agent stap" },
                { color: "border-blue-light border-2 bg-transparent", label: "Agent kans" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span className={`w-4 h-3 rounded border ${item.color} inline-block`} />
                  {item.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VISUEELONTWERPPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center"><p className="text-slate text-sm">Laden…</p></div>}>
      <VISUEELONTWERPInner />
    </Suspense>
  );
}
