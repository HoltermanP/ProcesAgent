"use client";

import { useState } from "react";
import { Card, SectionHeader, Badge } from "@/components/ui/Card";

const ENV_VARS = [
  {
    key: "ANTHROPIC_API_KEY",
    label: "Anthropic API Key",
    description: "Vereist voor alle AI-functies (procesanalyse, ontwerp, agents).",
    link: "https://console.anthropic.com/",
    required: true,
  },
  {
    key: "DATABASE_URL",
    label: "NEON Database URL",
    description: "PostgreSQL connection string van NEON. Vereist voor projectopslag.",
    link: "https://neon.tech/",
    required: true,
  },
  {
    key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    label: "Clerk Publishable Key",
    description: "Voor authenticatie (optioneel, niet actief geconfigureerd).",
    required: false,
  },
  {
    key: "CLERK_SECRET_KEY",
    label: "Clerk Secret Key",
    description: "Server-side Clerk sleutel.",
    required: false,
  },
];

const MODEL_INFO = [
  { model: "claude-sonnet-4-6", use: "Alle AI-functies (default)", speed: "Snel", quality: "Hoog" },
  { model: "claude-opus-4-6", use: "Complexe analyses (handmatig)", speed: "Langzaam", quality: "Zeer hoog" },
  { model: "claude-haiku-4-5", use: "Snelle queries (optioneel)", speed: "Zeer snel", quality: "Middel" },
];

export default function SettingsPage() {
  const [dbTestResult, setDbTestResult] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [aiTestResult, setAiTestResult] = useState<"idle" | "loading" | "ok" | "error">("idle");

  const testDatabase = async () => {
    setDbTestResult("loading");
    try {
      const res = await fetch("/api/projects");
      setDbTestResult(res.ok ? "ok" : "error");
    } catch {
      setDbTestResult("error");
    }
  };

  const testAI = async () => {
    setAiTestResult("loading");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "test", message: "ping" }),
      });
      // 400 = missing projectId but API reached, 500 = API key issue
      setAiTestResult(res.status !== 500 ? "ok" : "error");
    } catch {
      setAiTestResult("error");
    }
  };

  const getStatusBadge = (status: "idle" | "loading" | "ok" | "error") => {
    if (status === "idle") return null;
    if (status === "loading") return <Badge>Testen…</Badge>;
    if (status === "ok") return <Badge variant="green">Verbonden</Badge>;
    return <Badge variant="red">Fout</Badge>;
  };

  return (
    <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-6">
      <div>
        <p className="label-tag mb-1">Configuratie</p>
        <h1 className="page-heading text-2xl">Instellingen</h1>
        <p className="text-slate text-sm mt-1">
          Beheer je API-sleutels, database-verbinding en model-configuratie.
        </p>
      </div>

      {/* ENV vars */}
      <Card>
        <SectionHeader
          title="Environment Variabelen"
          subtitle="Stel in via Vercel Dashboard → Settings → Environment Variables"
        />
        <div className="space-y-4">
          {ENV_VARS.map((env) => (
            <div key={env.key} className="flex items-start justify-between gap-4 py-3 border-b border-border/50 last:border-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-blue-light text-sm font-mono">{env.key}</code>
                  {env.required && <Badge variant="blue">Vereist</Badge>}
                </div>
                <p className="text-slate text-xs">{env.description}</p>
                {env.link && (
                  <p className="text-xs text-slate mt-1">
                    Verkrijg sleutel:{" "}
                    <span className="text-blue-light">{env.link}</span>
                  </p>
                )}
              </div>
              <div className="shrink-0">
                <span className="label-tag bg-deep-black border border-border rounded px-2 py-1">
                  process.env
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-deep-black border border-border rounded text-xs font-mono text-slate">
          <p className="text-off-white mb-2">Lokale ontwikkeling (.env.local):</p>
          <p>DATABASE_URL=postgresql://...</p>
          <p>ANTHROPIC_API_KEY=sk-ant-...</p>
        </div>
      </Card>

      {/* Connection test */}
      <Card>
        <SectionHeader title="Verbindingstests" />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-off-white">Database (NEON)</p>
              <p className="text-xs text-slate">Test projecten ophalen via /api/projects</p>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(dbTestResult)}
              <button
                onClick={() => void testDatabase()}
                disabled={dbTestResult === "loading"}
                className="btn-outline text-xs px-3 py-1.5"
              >
                Test
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border/50 pt-3">
            <div>
              <p className="text-sm text-off-white">Anthropic API</p>
              <p className="text-xs text-slate">Test of de API key bereikbaar is</p>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(aiTestResult)}
              <button
                onClick={() => void testAI()}
                disabled={aiTestResult === "loading"}
                className="btn-outline text-xs px-3 py-1.5"
              >
                Test
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Models */}
      <Card>
        <SectionHeader title="Beschikbare Modellen" subtitle="Anthropic Claude — gebruikt via API" />
        <div className="space-y-2">
          {MODEL_INFO.map((m) => (
            <div key={m.model} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div>
                <code className="text-blue-light text-sm">{m.model}</code>
                <p className="text-xs text-slate mt-0.5">{m.use}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-off-white">{m.quality}</p>
                <p className="text-xs text-slate">{m.speed}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Tech stack */}
      <Card>
        <SectionHeader title="Tech Stack" />
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            ["Framework", "Next.js 14 (App Router)"],
            ["Taal", "TypeScript (strict)"],
            ["Styling", "Tailwind CSS"],
            ["Database", "NEON PostgreSQL"],
            ["AI", "Anthropic Claude"],
            ["Deployment", "Vercel"],
            ["Fonts", "Space Grotesk + IBM Plex Mono"],
            ["Authenticatie", "Niet geconfigureerd"],
          ].map(([label, value]) => (
            <div key={label} className="py-1">
              <p className="label-tag">{label}</p>
              <p className="text-off-white text-sm mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Version info */}
      <div className="text-center">
        <p className="label-tag">
          ProcesAgents · <span className="text-blue-light">AI</span>-Group · v1.0.0
        </p>
        <p className="label-tag mt-1 tracking-[0.2em]">AI-FIRST · WE SHIP FAST</p>
      </div>
    </div>
  );
}
