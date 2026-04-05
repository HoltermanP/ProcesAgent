"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProjectSelector from "@/components/ui/ProjectSelector";
import { Card, SectionHeader, Badge, EmptyState } from "@/components/ui/Card";
import { type Project, type Agent, type ProcessStep } from "@/lib/db";
import { opportunityColor, opportunityLabel, statusLabel, statusColor } from "@/lib/utils";
import Link from "next/link";

interface ApiResponse {
  agents: Agent[];
  steps: ProcessStep[];
}

function AgentOntWERPInner() {
  const searchParams = useSearchParams();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  useEffect(() => {
    const pid = searchParams.get("projectId");
    if (pid && !selectedProject) {
      fetch(`/api/projects/${pid}`)
        .then((r) => r.json())
        .then((p: Project) => setSelectedProject(p))
        .catch(() => {});
    }
  }, [searchParams, selectedProject]);

  const loadData = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`/api/agents?projectId=${projectId}`);
      const data = (await res.json()) as ApiResponse;
      setAgents(data.agents ?? []);
      setSteps(data.steps ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    void loadData(selectedProject.id);
  }, [selectedProject, loadData]);

  const handleGenerateForStep = useCallback(
    async (step: ProcessStep) => {
      if (!selectedProject) return;
      setIsGenerating(step.id);
      setError(null);
      try {
        const res = await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: selectedProject.id,
            stepId: step.id,
            stepName: step.name,
            customPrompt: customPrompt || undefined,
          }),
        });
        if (!res.ok) throw new Error("Failed");
        const data = (await res.json()) as { agent: Agent };
        setAgents((prev) => [...prev, data.agent]);
        setSelectedAgent(data.agent);
        setCustomPrompt("");
      } catch {
        setError("Generatie mislukt. Controleer je API-sleutel.");
      } finally {
        setIsGenerating(null);
      }
    },
    [selectedProject, customPrompt]
  );

  const handleSaveAgent = useCallback(async (agent: Agent) => {
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: agent.name,
          description: agent.description,
          system_prompt: agent.system_prompt,
          status: agent.status,
        }),
      });
      if (res.ok) {
        const updated = (await res.json()) as Agent;
        setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        setSelectedAgent(updated);
        setEditingAgent(null);
      }
    } catch {
      setError("Opslaan mislukt.");
    }
  }, []);

  const handleDeleteAgent = useCallback(
    async (agentId: string) => {
      if (!confirm("Agent verwijderen?")) return;
      try {
        await fetch(`/api/agents/${agentId}`, { method: "DELETE" });
        setAgents((prev) => prev.filter((a) => a.id !== agentId));
        if (selectedAgent?.id === agentId) setSelectedAgent(null);
      } catch {
        setError("Verwijderen mislukt.");
      }
    },
    [selectedAgent]
  );

  const opportunitySteps = steps.filter((s) => s.agent_opportunity);

  return (
    <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 py-6 gap-4">
      <div>
        <p className="label-tag mb-1">Stap 03</p>
        <h1 className="page-heading text-2xl">Agent Ontwerp</h1>
        <p className="text-slate text-sm mt-1">
          Ontwerp Claude-agents voor elke geïdentificeerde processtap.
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Left panel */}
        <div className="flex flex-col gap-4">
          <ProjectSelector
            selectedId={selectedProject?.id ?? null}
            onSelect={(p) => {
              setSelectedProject(p);
              setAgents([]);
              setSteps([]);
              setSelectedAgent(null);
            }}
            onNew={() => {}}
          />

          {selectedProject && (
            <>
              {/* Custom prompt */}
              <Card>
                <SectionHeader title="Instructie" subtitle="Optionele aanvullende context" />
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Bijv. 'gebruik ook e-mail tools'…"
                  rows={2}
                  className="w-full bg-deep-black border border-border rounded px-3 py-2 text-sm text-off-white placeholder-slate focus:outline-none focus:border-ai-blue/60 resize-none"
                />
              </Card>

              {/* Opportunity steps */}
              <Card>
                <SectionHeader
                  title="Agent Kansen"
                  subtitle={`${opportunitySteps.length} stap${opportunitySteps.length !== 1 ? "pen" : ""}`}
                />
                {opportunitySteps.length === 0 ? (
                  <p className="text-slate text-xs">
                    Nog geen stappen met agent-kansen.{" "}
                    <Link href="/visueel-ontwerp" className="text-blue-light hover:underline">
                      Genereer eerst een procesdiagram.
                    </Link>
                  </p>
                ) : (
                  <div className="space-y-2">
                    {opportunitySteps.map((step) => {
                      const hasAgent = agents.some((a) => a.process_step_id === step.id);
                      return (
                        <div key={step.id} className="flex items-center justify-between">
                          <div className="min-w-0 mr-2">
                            <p className="text-sm text-off-white truncate">{step.name}</p>
                            <p className={`text-xs ${opportunityColor(step.opportunity_score)}`}>
                              {opportunityLabel(step.opportunity_score)}
                            </p>
                          </div>
                          {hasAgent ? (
                            <Badge variant="blue">Klaar</Badge>
                          ) : (
                            <button
                              onClick={() => void handleGenerateForStep(step)}
                              disabled={isGenerating === step.id}
                              className="btn-primary text-xs px-2 py-1 shrink-0"
                            >
                              {isGenerating === step.id ? "…" : "Genereer"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {error && (
                <p className="text-velocity-red text-xs bg-velocity-red/10 border border-velocity-red/20 rounded p-2">
                  {error}
                </p>
              )}
            </>
          )}

          {agents.length > 0 && (
            <Link
              href={`/applicatie-ontwerp${selectedProject ? `?projectId=${selectedProject.id}` : ""}`}
              className="btn-primary text-center text-sm py-2"
            >
              Naar applicatie ontwerp →
            </Link>
          )}
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-3">
          {/* Agent list */}
          {agents.length > 0 && (
            <Card>
              <SectionHeader
                title="Ontworpen Agents"
                subtitle={`${agents.length} agent${agents.length !== 1 ? "s" : ""}`}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent)}
                    className={`text-left p-3 rounded border transition-colors ${
                      selectedAgent?.id === agent.id
                        ? "border-ai-blue bg-ai-blue/10"
                        : "border-border hover:border-border/80 hover:bg-deep-black/30"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 mr-2">
                        <p className="text-sm text-off-white font-medium truncate">{agent.name}</p>
                        <p className="text-xs text-slate font-mono mt-0.5">{agent.agent_type}</p>
                      </div>
                      <span className={`text-xs shrink-0 ${statusColor(agent.status)}`}>
                        {statusLabel(agent.status)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Agent detail */}
          {selectedAgent ? (
            <AgentDetail
              agent={editingAgent ?? selectedAgent}
              isEditing={editingAgent !== null}
              onEdit={() => setEditingAgent({ ...selectedAgent })}
              onChange={(field, value) =>
                setEditingAgent((prev) => (prev ? { ...prev, [field]: value } : null))
              }
              onSave={() => editingAgent && void handleSaveAgent(editingAgent)}
              onCancelEdit={() => setEditingAgent(null)}
              onDelete={() => void handleDeleteAgent(selectedAgent.id)}
            />
          ) : !selectedProject ? (
            <div className="bg-surface border border-border rounded-card flex items-center justify-center min-h-[400px]">
              <EmptyState title="Geen project geselecteerd" description="Selecteer een project om te beginnen." />
            </div>
          ) : agents.length === 0 ? (
            <div className="bg-surface border border-border rounded-card flex items-center justify-center min-h-[400px]">
              <EmptyState
                title="Nog geen agents"
                description="Genereer agents voor de geïdentificeerde agent-kansen in het procesdiagram."
              />
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-card flex items-center justify-center min-h-[200px]">
              <p className="text-slate text-sm">Selecteer een agent om details te bekijken.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgentOntWERPPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center"><p className="text-slate text-sm">Laden…</p></div>}>
      <AgentOntWERPInner />
    </Suspense>
  );
}

interface AgentDetailProps {
  agent: Agent;
  isEditing: boolean;
  onEdit: () => void;
  onChange: (field: keyof Agent, value: string) => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}

function AgentDetail({ agent, isEditing, onEdit, onChange, onSave, onCancelEdit, onDelete }: AgentDetailProps) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="section-heading text-base">{agent.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="label-tag">{agent.agent_type}</span>
            <span className="label-tag">·</span>
            <span className="label-tag font-mono">{agent.model}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <button onClick={onEdit} className="btn-outline text-xs px-3 py-1.5">
              Bewerken
            </button>
          )}
          <button
            onClick={onDelete}
            className="text-xs text-slate hover:text-velocity-red transition-colors px-2 py-1.5"
            aria-label="Agent verwijderen"
          >
            Verwijder
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="label-tag block mb-1">Naam</label>
            <input
              type="text"
              value={agent.name}
              onChange={(e) => onChange("name", e.target.value)}
              className="w-full bg-deep-black border border-border rounded px-3 py-2 text-sm text-off-white focus:outline-none focus:border-ai-blue/60"
            />
          </div>
          <div>
            <label className="label-tag block mb-1">Beschrijving</label>
            <input
              type="text"
              value={agent.description ?? ""}
              onChange={(e) => onChange("description", e.target.value)}
              className="w-full bg-deep-black border border-border rounded px-3 py-2 text-sm text-off-white focus:outline-none focus:border-ai-blue/60"
            />
          </div>
          <div>
            <label className="label-tag block mb-1">Systeem Prompt</label>
            <textarea
              value={agent.system_prompt ?? ""}
              onChange={(e) => onChange("system_prompt", e.target.value)}
              rows={10}
              className="w-full bg-deep-black border border-border rounded px-3 py-2 text-sm text-off-white font-mono focus:outline-none focus:border-ai-blue/60 resize-y"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={onSave} className="btn-primary">Opslaan</button>
            <button onClick={onCancelEdit} className="btn-outline">Annuleer</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {agent.description && (
            <p className="text-sm text-slate leading-relaxed">{agent.description}</p>
          )}

          {agent.system_prompt && (
            <div>
              <p className="label-tag mb-2">Systeem Prompt</p>
              <pre className="bg-deep-black border border-border rounded p-3 text-xs text-off-white font-mono overflow-x-auto whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                {agent.system_prompt}
              </pre>
            </div>
          )}

          {agent.tools && (
            <div>
              <p className="label-tag mb-2">Tools</p>
              <pre className="bg-deep-black border border-border rounded p-3 text-xs text-blue-light font-mono overflow-x-auto">
                {JSON.stringify(agent.tools, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
