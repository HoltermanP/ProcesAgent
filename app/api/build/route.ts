import { NextRequest, NextResponse } from "next/server";
import { getProject, getProcessSteps, getAgents } from "@/lib/db";
import type { ProcessStep, Agent } from "@/lib/db";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  try {
    const [project, steps, agents] = await Promise.all([
      getProject(projectId),
      getProcessSteps(projectId),
      getAgents(projectId),
    ]);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const files = generateAppFiles(project.name, steps, agents);
    return NextResponse.json({ files, project, steps, agents });
  } catch (error) {
    console.error("[GET /api/build]", error);
    return NextResponse.json({ error: "Failed to generate app" }, { status: 500 });
  }
}

// ─── Code generators ──────────────────────────────────────────────────────────

function generateAppFiles(
  projectName: string,
  steps: ProcessStep[],
  agents: Agent[]
): Record<string, string> {
  return {
    "package.json": generatePackageJson(projectName),
    ".env.example": generateEnvExample(),
    "app/layout.tsx": generateLayout(projectName),
    "app/globals.css": generateGlobalsCss(),
    "app/page.tsx": generateMainPage(projectName, steps, agents),
    "app/api/run-agent/route.ts": generateAgentRoute(),
    "next.config.mjs": generateNextConfig(),
    "tailwind.config.ts": generateTailwindConfig(),
    "tsconfig.json": generateTsConfig(),
  };
}

function generatePackageJson(name: string): string {
  const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return JSON.stringify(
    {
      name: safeName || "procesagent-app",
      version: "1.0.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
      },
      dependencies: {
        "@anthropic-ai/sdk": "^0.82.0",
        next: "14.2.35",
        react: "^18",
        "react-dom": "^18",
      },
      devDependencies: {
        "@types/node": "^20",
        "@types/react": "^18",
        "@types/react-dom": "^18",
        autoprefixer: "^10",
        postcss: "^8",
        tailwindcss: "^3.4.1",
        typescript: "^5",
      },
    },
    null,
    2
  );
}

function generateEnvExample(): string {
  return `# Vereist: Anthropic API sleutel
ANTHROPIC_API_KEY=sk-ant-...
`;
}

function generateNextConfig(): string {
  return `/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
`;
}

function generateTailwindConfig(): string {
  return `import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
export default config;
`;
}

function generateTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [{ name: "next" }],
        paths: { "@/*": ["./*"] },
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    },
    null,
    2
  );
}

function generateLayout(projectName: string): string {
  return `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "${projectName}",
  description: "Gegenereerd door ProcesAgents — AI-Group",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="bg-gray-950 text-gray-100 min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
`;
}

function generateGlobalsCss(): string {
  return `@tailwind base;
@tailwind components;
@tailwind utilities;

body { font-family: system-ui, sans-serif; }
`;
}

function generateAgentRoute(): string {
  return `import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    systemPrompt: string;
    input: string;
    model?: string;
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const s = await client.messages.stream({
          model: body.model ?? "claude-sonnet-4-6",
          max_tokens: 2048,
          system: body.systemPrompt,
          messages: [{ role: "user", content: body.input }],
        });

        for await (const chunk of s) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Agent fout";
        controller.enqueue(encoder.encode(\`[FOUT: \${msg}]\`));
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
`;
}

function generateMainPage(
  projectName: string,
  steps: ProcessStep[],
  agents: Agent[]
): string {
  // Build embedded data objects (sanitised — no secrets)
  const stepsData = steps.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    order_index: s.order_index,
    step_type: s.step_type,
    agent_opportunity: s.agent_opportunity,
    opportunity_score: s.opportunity_score,
  }));

  const agentsData = agents.map((a) => ({
    id: a.id,
    process_step_id: a.process_step_id,
    name: a.name,
    description: a.description,
    agent_type: a.agent_type,
    model: a.model,
    system_prompt: a.system_prompt,
  }));

  const stepsJson = JSON.stringify(stepsData, null, 2)
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$");
  const agentsJson = JSON.stringify(agentsData, null, 2)
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$");

  return `"use client";

import { useState, useCallback, useRef } from "react";

// ─── Embedded process data (gegenereerd door ProcesAgents) ──────────────────
const PROCESS_STEPS = ${stepsJson} as const;

const AGENTS = ${agentsJson} as const;

// ─── Types ───────────────────────────────────────────────────────────────────
type StepState = {
  input: string;
  output: string;
  isRunning: boolean;
  agentEnabled: boolean;
  error: string | null;
  done: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getAgentForStep(stepId: string) {
  return AGENTS.find((a) => a.process_step_id === stepId) ?? null;
}

function initStepState(): Record<string, StepState> {
  return Object.fromEntries(
    PROCESS_STEPS.map((s) => [
      s.id,
      {
        input: "",
        output: "",
        isRunning: false,
        agentEnabled: s.agent_opportunity,
        error: null,
        done: false,
      },
    ])
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ProcessRunner() {
  const [stepStates, setStepStates] = useState<Record<string, StepState>>(initStepState);
  const [activeStep, setActiveStep] = useState<string | null>(
    PROCESS_STEPS[0]?.id ?? null
  );
  const [isRunningAll, setIsRunningAll] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);

  const updateStep = useCallback(
    (stepId: string, patch: Partial<StepState>) => {
      setStepStates((prev) => ({
        ...prev,
        [stepId]: { ...prev[stepId], ...patch },
      }));
    },
    []
  );

  const runStep = useCallback(
    async (stepId: string, inputOverride?: string): Promise<string> => {
      const step = PROCESS_STEPS.find((s) => s.id === stepId);
      if (!step) return "";

      const state = stepStates[stepId];
      const agent = getAgentForStep(stepId);
      const input = inputOverride ?? state.input;

      // Without agent: just mark as done and pass input through
      if (!state.agentEnabled || !agent?.system_prompt) {
        updateStep(stepId, {
          output: input || \`[\${step.name} afgerond — geen agent actief]\`,
          done: true,
          error: null,
        });
        return input || \`[\${step.name} afgerond]\`;
      }

      updateStep(stepId, { isRunning: true, output: "", error: null, done: false });

      let aborted = false;
      abortRef.current = () => { aborted = true; };

      try {
        const res = await fetch("/api/run-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemPrompt: agent.system_prompt,
            input: input || \`Voer de stap uit: \${step.name}\`,
            model: agent.model ?? "claude-sonnet-4-6",
          }),
        });

        if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
        if (!res.body) throw new Error("Geen response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          if (aborted) break;
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          updateStep(stepId, { output: accumulated });
        }

        updateStep(stepId, { isRunning: false, done: true });
        return accumulated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Onbekende fout";
        updateStep(stepId, { isRunning: false, error: msg, done: false });
        return "";
      } finally {
        abortRef.current = null;
      }
    },
    [stepStates, updateStep]
  );

  const handleRunAll = useCallback(async () => {
    setIsRunningAll(true);
    let previousOutput = "";

    for (const step of PROCESS_STEPS) {
      // Feed previous output as input if step has no manual input
      if (previousOutput && !stepStates[step.id].input) {
        updateStep(step.id, { input: previousOutput });
      }
      setActiveStep(step.id);
      previousOutput = await runStep(step.id, previousOutput || undefined);
    }

    setIsRunningAll(false);
  }, [stepStates, runStep, updateStep]);

  const handleReset = useCallback(() => {
    setStepStates(initStepState());
    setActiveStep(PROCESS_STEPS[0]?.id ?? null);
  }, []);

  const completedCount = Object.values(stepStates).filter((s) => s.done).length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">${projectName}</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {completedCount}/{PROCESS_STEPS.length} stappen voltooid
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-sm border border-gray-700 rounded hover:border-gray-500 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={() => void handleRunAll()}
            disabled={isRunningAll}
            className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded font-medium transition-colors flex items-center gap-2"
          >
            {isRunningAll && (
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {isRunningAll ? "Bezig…" : "Alles uitvoeren"}
          </button>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-gray-800">
        <div
          className="h-full bg-blue-500 transition-all duration-500"
          style={{ width: \`\${PROCESS_STEPS.length ? (completedCount / PROCESS_STEPS.length) * 100 : 0}%\` }}
        />
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        {PROCESS_STEPS.map((step, index) => {
          const state = stepStates[step.id];
          const agent = getAgentForStep(step.id);
          const isActive = activeStep === step.id;
          const prevStep = PROCESS_STEPS[index - 1];
          const prevDone = !prevStep || stepStates[prevStep.id]?.done;

          return (
            <div
              key={step.id}
              className={\`border rounded-xl transition-all \${
                isActive
                  ? "border-blue-500/50 bg-gray-900"
                  : state.done
                  ? "border-green-800/50 bg-gray-900/50"
                  : "border-gray-800 bg-gray-900/30"
              }\`}
            >
              {/* Step header */}
              <button
                className="w-full text-left px-5 py-4 flex items-center gap-4"
                onClick={() => setActiveStep(isActive ? null : step.id)}
              >
                {/* Step number / status */}
                <div
                  className={\`w-8 h-8 rounded-full flex items-center justify-center text-sm font-mono font-bold shrink-0 \${
                    state.done
                      ? "bg-green-900 text-green-400 border border-green-700"
                      : state.isRunning
                      ? "bg-blue-900 text-blue-400 border border-blue-600"
                      : "bg-gray-800 text-gray-400 border border-gray-700"
                  }\`}
                >
                  {state.done ? "✓" : state.isRunning ? "…" : String(index + 1).padStart(2, "0")}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-100">{step.name}</p>
                  {step.description && (
                    <p className="text-gray-400 text-sm truncate mt-0.5">{step.description}</p>
                  )}
                </div>

                {/* Agent toggle */}
                {agent && (
                  <div
                    className="flex items-center gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-xs text-gray-500">Agent</span>
                    <button
                      role="switch"
                      aria-checked={state.agentEnabled}
                      aria-label={\`Agent \${state.agentEnabled ? "uitschakelen" : "inschakelen"} voor \${step.name}\`}
                      onClick={() => updateStep(step.id, { agentEnabled: !state.agentEnabled })}
                      className={\`relative w-10 h-5 rounded-full transition-colors \${
                        state.agentEnabled ? "bg-blue-600" : "bg-gray-700"
                      }\`}
                    >
                      <span
                        className={\`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform \${
                          state.agentEnabled ? "translate-x-5" : "translate-x-0"
                        }\`}
                      />
                    </button>
                  </div>
                )}

                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className={\`text-gray-500 shrink-0 transition-transform \${isActive ? "rotate-180" : ""}\`}
                >
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>

              {/* Expanded content */}
              {isActive && (
                <div className="px-5 pb-5 border-t border-gray-800/50 pt-4 space-y-3">
                  {/* Agent info */}
                  {agent && (
                    <div className={\`text-xs px-3 py-2 rounded border \${
                      state.agentEnabled
                        ? "bg-blue-950/50 border-blue-800/50 text-blue-300"
                        : "bg-gray-800/50 border-gray-700 text-gray-500"
                    }\`}>
                      {state.agentEnabled
                        ? \`Agent actief: \${agent.name} (\${agent.model ?? "claude-sonnet-4-6"})\`
                        : \`Agent uitgeschakeld: \${agent.name} — stap wordt handmatig doorgegeven\`}
                    </div>
                  )}

                  {/* Input */}
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">
                      Input {prevStep && "(output vorige stap of handmatige invoer)"}
                    </label>
                    <textarea
                      value={state.input}
                      onChange={(e) => updateStep(step.id, { input: e.target.value })}
                      placeholder={prevStep
                        ? "Automatisch gevuld vanuit vorige stap, of type eigen input…"
                        : "Beschrijf de input voor dit proces…"}
                      rows={3}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500/60 resize-y"
                    />
                  </div>

                  {/* Run button */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void runStep(step.id)}
                      disabled={state.isRunning || !prevDone}
                      className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      {state.isRunning && (
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      )}
                      {state.isRunning ? "Bezig…" : \`Voer stap uit\${agent && state.agentEnabled ? " met agent" : ""}\`}
                    </button>
                    {!prevDone && (
                      <p className="text-xs text-gray-600">Wacht op vorige stap</p>
                    )}
                    {state.done && (
                      <button
                        onClick={() => updateStep(step.id, { done: false, output: "", error: null })}
                        className="text-xs text-gray-500 hover:text-gray-300"
                      >
                        Herhaal
                      </button>
                    )}
                  </div>

                  {/* Error */}
                  {state.error && (
                    <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/30 rounded p-2">
                      Fout: {state.error}
                    </div>
                  )}

                  {/* Output */}
                  {state.output && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Output</p>
                      <pre className="bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm text-gray-100 whitespace-pre-wrap font-mono overflow-x-auto max-h-64 overflow-y-auto">
                        {state.output}
                        {state.isRunning && (
                          <span className="animate-pulse text-blue-400">▋</span>
                        )}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {completedCount === PROCESS_STEPS.length && PROCESS_STEPS.length > 0 && (
          <div className="border border-green-800/50 bg-green-950/20 rounded-xl px-5 py-6 text-center">
            <p className="text-green-400 font-medium text-lg">Proces voltooid</p>
            <p className="text-gray-400 text-sm mt-1">
              Alle {PROCESS_STEPS.length} stappen zijn succesvol uitgevoerd.
            </p>
            <button
              onClick={handleReset}
              className="mt-4 px-4 py-2 text-sm border border-green-700 text-green-400 rounded-lg hover:bg-green-900/20 transition-colors"
            >
              Opnieuw starten
            </button>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-800 py-4 text-center text-xs text-gray-600 mt-8">
        Gegenereerd door ProcesAgents · AI-Group · AI-FIRST · WE SHIP FAST
      </footer>
    </div>
  );
}
`;
}
