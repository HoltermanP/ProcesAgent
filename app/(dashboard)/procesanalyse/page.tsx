"use client";

import { useState, useCallback, useEffect } from "react";
import ChatInterface, { type ChatMessage } from "@/components/ui/ChatInterface";
import ProjectSelector from "@/components/ui/ProjectSelector";
import { Card, SectionHeader } from "@/components/ui/Card";
import { type Project, type Message } from "@/lib/db";
import Link from "next/link";

export default function ProcesanalysePage() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load history when project changes
  useEffect(() => {
    if (!selectedProject) {
      setMessages([]);
      return;
    }
    setLoadingHistory(true);
    fetch(`/api/analyze?projectId=${selectedProject.id}`)
      .then((r) => r.json())
      .then((data: Message[]) => {
        setMessages(
          data.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          }))
        );
      })
      .catch(() => {
        // ignore
      })
      .finally(() => setLoadingHistory(false));
  }, [selectedProject]);

  const handleSend = useCallback(
    async (message: string) => {
      if (!selectedProject) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: message,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      const assistantMsgId = crypto.randomUUID();
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
      };
      setMessages((prev) => [...prev, assistantMsg]);

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: selectedProject.id, message }),
        });

        if (!res.ok) throw new Error("Request failed");
        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content: accumulated } : m
            )
          );
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: "Er is een fout opgetreden. Controleer je API-sleutel." }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [selectedProject]
  );

  const STARTER_QUESTIONS = [
    "Beschrijf het proces dat je wilt automatiseren.",
    "Wat zijn de huidige knelpunten in dit proces?",
    "Wie zijn er betrokken bij dit proces?",
    "Welke data of documenten worden verwerkt?",
  ];

  return (
    <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 py-6 gap-4">
      <div>
        <p className="label-tag mb-1">Stap 01</p>
        <h1 className="page-heading text-2xl">Procesanalyse</h1>
        <p className="text-slate text-sm mt-1">
          Voer een AI-gesprek om je proces volledig te documenteren en agent-kansen te identificeren.
        </p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 min-h-0">
        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <ProjectSelector
            selectedId={selectedProject?.id ?? null}
            onSelect={setSelectedProject}
            onNew={(id) => {
              setSelectedProject({ id, name: "", description: null, status: "draft", created_at: "", updated_at: "" });
            }}
          />

          {/* Starter questions */}
          <Card>
            <SectionHeader title="Startvragen" />
            <div className="space-y-2">
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => selectedProject && handleSend(q)}
                  disabled={!selectedProject || isLoading}
                  className="w-full text-left text-xs text-slate hover:text-off-white p-2 rounded hover:bg-deep-black/50 transition-colors border border-transparent hover:border-border disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {q}
                </button>
              ))}
            </div>
          </Card>

          {/* Status */}
          {selectedProject && (
            <Card>
              <p className="text-xs text-slate mb-2">Project</p>
              <p className="text-sm text-off-white font-medium">{selectedProject.name || "—"}</p>
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate">Berichten</span>
                  <span className="text-off-white font-mono">{messages.length}</span>
                </div>
              </div>
            </Card>
          )}

          {/* CTA to next step */}
          {messages.length > 2 && (
            <Link
              href={`/visueel-ontwerp${selectedProject ? `?projectId=${selectedProject.id}` : ""}`}
              className="btn-primary text-center text-sm py-2"
            >
              Naar visueel ontwerp →
            </Link>
          )}
        </div>

        {/* Chat */}
        <div className="bg-surface border border-border rounded-card flex flex-col min-h-[500px] lg:min-h-0">
          {!selectedProject ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-ai-blue/10 border border-ai-blue/20 flex items-center justify-center">
                <span className="text-blue-light font-mono font-bold text-sm">AI</span>
              </div>
              <p className="text-off-white font-medium">Selecteer een project</p>
              <p className="text-slate text-sm max-w-xs">
                Kies een bestaand project of maak een nieuw project aan om te beginnen.
              </p>
            </div>
          ) : loadingHistory ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-slate text-sm">Laden…</p>
            </div>
          ) : (
            <ChatInterface
              messages={messages}
              onSend={handleSend}
              isLoading={isLoading}
              placeholder="Beschrijf je proces, stel een vraag, of geef aanvullende context…"
              className="flex-1"
            />
          )}
        </div>
      </div>
    </div>
  );
}
