"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProjectSelector from "@/components/ui/ProjectSelector";
import { Card, SectionHeader, EmptyState } from "@/components/ui/Card";
import { type Project, type ApplicationDesign, type Message } from "@/lib/db";
import { formatDateRelative } from "@/lib/utils";

interface ApiData {
  design: ApplicationDesign | null;
  messages: Message[];
}

function ApplicatieOntWERPInner() {
  const searchParams = useSearchParams();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [design, setDesign] = useState<ApplicationDesign | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"code" | "history">("code");
  const streamRef = useRef<string>("");

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
      const res = await fetch(`/api/application?projectId=${projectId}`);
      const data = (await res.json()) as ApiData;
      setDesign(data.design ?? null);
      setMessages(data.messages ?? []);
      if (data.design?.generated_code) {
        setStreamedText(data.design.generated_code);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    void loadData(selectedProject.id);
  }, [selectedProject, loadData]);

  const handleGenerate = useCallback(async () => {
    if (!selectedProject) return;
    setIsGenerating(true);
    setError(null);
    setStreamedText("");
    streamRef.current = "";

    try {
      const res = await fetch("/api/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProject.id,
          message: customPrompt || undefined,
        }),
      });

      if (!res.ok) throw new Error("Generatie mislukt");
      if (!res.body) throw new Error("No stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        streamRef.current += chunk;
        setStreamedText(streamRef.current);
      }

      setCustomPrompt("");
      await loadData(selectedProject.id);
    } catch {
      setError("Generatie mislukt. Controleer je API-sleutel en probeer opnieuw.");
    } finally {
      setIsGenerating(false);
    }
  }, [selectedProject, customPrompt, loadData]);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(streamedText);
  }, [streamedText]);

  return (
    <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 py-6 gap-4">
      <div>
        <p className="label-tag mb-1">Stap 04</p>
        <h1 className="page-heading text-2xl">Applicatie Ontwerp</h1>
        <p className="text-slate text-sm mt-1">
          Genereer een volledig applicatie-ontwerp met architectuur, componenten en startcode.
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <ProjectSelector
            selectedId={selectedProject?.id ?? null}
            onSelect={(p) => {
              setSelectedProject(p);
              setDesign(null);
              setMessages([]);
              setStreamedText("");
            }}
            onNew={() => {}}
          />

          {selectedProject && (
            <>
              <Card>
                <SectionHeader title="Genereren" />
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Optionele instructie (bijv. 'focus op de API laag')…"
                  rows={3}
                  className="w-full bg-deep-black border border-border rounded px-3 py-2 text-sm text-off-white placeholder-slate focus:outline-none focus:border-ai-blue/60 resize-none mb-3"
                />
                <button
                  onClick={() => void handleGenerate()}
                  disabled={isGenerating}
                  className="btn-cta w-full"
                >
                  {isGenerating ? "Genereren…" : "Genereer applicatie ontwerp"}
                </button>
                {error && <p className="text-velocity-red text-xs mt-2">{error}</p>}
              </Card>

              {design && (
                <Card>
                  <p className="label-tag mb-2">Laatste generatie</p>
                  <p className="text-sm text-off-white">{design.title}</p>
                  <p className="text-xs text-slate mt-1">{formatDateRelative(design.updated_at)}</p>
                  <div className="mt-2 pt-2 border-t border-border">
                    <span className={`text-xs ${design.status === "active" ? "text-blue-light" : "text-slate"}`}>
                      {design.status === "active" ? "Actief" : "Concept"}
                    </span>
                  </div>
                </Card>
              )}

              {streamedText && (
                <button onClick={handleCopy} className="btn-outline text-sm py-2">
                  Kopieer output
                </button>
              )}
            </>
          )}
        </div>

        {/* Main content */}
        <div className="flex flex-col gap-3 min-h-0">
          {/* Tabs */}
          {(streamedText || messages.length > 0) && (
            <div className="flex gap-1 border-b border-border pb-1">
              {(["code", "history"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 text-sm rounded-t transition-colors ${
                    activeTab === tab
                      ? "bg-surface text-off-white border border-border border-b-surface"
                      : "text-slate hover:text-off-white"
                  }`}
                >
                  {tab === "code" ? "Ontwerp Output" : "Gesprekshistorie"}
                </button>
              ))}
            </div>
          )}

          {!selectedProject ? (
            <div className="bg-surface border border-border rounded-card flex items-center justify-center min-h-[400px]">
              <EmptyState
                title="Geen project geselecteerd"
                description="Selecteer een project om te beginnen."
              />
            </div>
          ) : activeTab === "code" ? (
            isGenerating ? (
              <div className="bg-surface border border-border rounded-card flex flex-col min-h-[400px]">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                  <div className="w-3 h-3 rounded-full border border-ai-blue border-t-transparent animate-spin" />
                  <span className="text-slate text-sm">Genereren…</span>
                </div>
                {streamedText && (
                  <pre className="flex-1 p-4 text-xs text-off-white font-mono overflow-auto whitespace-pre-wrap">
                    {streamedText}
                    <span className="animate-pulse text-blue-light">▋</span>
                  </pre>
                )}
              </div>
            ) : streamedText ? (
              <div className="bg-surface border border-border rounded-card flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="label-tag">Applicatie Ontwerp Output</span>
                  <button
                    onClick={handleCopy}
                    className="text-xs text-blue-light hover:underline"
                    aria-label="Kopieer naar klembord"
                  >
                    Kopieer
                  </button>
                </div>
                <pre className="flex-1 p-4 text-sm text-off-white font-mono overflow-auto whitespace-pre-wrap leading-relaxed max-h-[600px]">
                  {streamedText}
                </pre>
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-card flex items-center justify-center min-h-[400px]">
                <EmptyState
                  title="Nog geen ontwerp"
                  description="Genereer een applicatie-ontwerp op basis van je agents en procesanalyse."
                  action={
                    <button onClick={() => void handleGenerate()} className="btn-cta">
                      Genereer ontwerp
                    </button>
                  }
                />
              </div>
            )
          ) : (
            // History tab
            <div className="bg-surface border border-border rounded-card overflow-y-auto max-h-[600px]">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-slate text-sm">Nog geen geschiedenis.</p>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="w-7 h-7 rounded bg-ai-blue/20 border border-ai-blue/30 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-blue-light text-[10px] font-mono font-bold">AI</span>
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-card px-3 py-2 text-sm font-mono overflow-x-auto whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-ai-blue/20 border border-ai-blue/30 text-off-white"
                            : "bg-deep-black border border-border text-off-white"
                        }`}
                      >
                        {msg.content.length > 600
                          ? msg.content.slice(0, 600) + "…"
                          : msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ApplicatieOntWERPPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center"><p className="text-slate text-sm">Laden…</p></div>}>
      <ApplicatieOntWERPInner />
    </Suspense>
  );
}
