import { NextRequest, NextResponse } from "next/server";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { getProject, getProcessSteps, getAgents } from "@/lib/db";
import { BUILD_DIRS } from "@/lib/build-store";
import { mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

export const maxDuration = 300; // 5 min — Vercel Pro/local

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { projectId: string };

  if (!body.projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const [project, steps, agents] = await Promise.all([
    getProject(body.projectId),
    getProcessSteps(body.projectId),
    getAgents(body.projectId),
  ]);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const buildId = randomBytes(8).toString("hex");
  const buildDir = join(tmpdir(), `procesagents-${buildId}`);
  mkdirSync(buildDir, { recursive: true });
  BUILD_DIRS.set(buildId, buildDir);

  // ── Prompt voor Claude Code ──────────────────────────────────────────────
  const stepsText = steps
    .map((s, i) => `${i + 1}. ${s.name}${s.description ? ` — ${s.description}` : ""} (agent: ${s.agent_opportunity ? "ja" : "nee"})`)
    .join("\n");

  const agentsText = agents
    .map((a) => {
      const step = steps.find((s) => s.id === a.process_step_id);
      return `- Agent: ${a.name} | Type: ${a.agent_type} | Model: ${a.model} | Stap: ${step?.name ?? "geen"}\n  System prompt: ${(a.system_prompt ?? "").slice(0, 300)}`;
    })
    .join("\n\n");

  const prompt = `Bouw een complete, productie-klare Next.js 14 applicatie in de huidige map voor het project "${project.name}".

## Processtappen
${stepsText}

## Ontworpen Agents
${agentsText || "Geen agents ontworpen."}

## Technische eisen
- Next.js 14 App Router + TypeScript strict
- Tailwind CSS (dark theme: achtergrond #0A0A0B)
- Anthropic Claude API (@anthropic-ai/sdk) voor agents
- Iedere processtap is een sectie/kaart in de UI
- Per stap een toggle om de agent aan/uit te zetten (opgeslagen in localStorage)
- Output van stap N wordt automatisch input voor stap N+1
- "Alles uitvoeren" knop voert de hele flow sequentieel uit
- Streaming agent-output per stap (tekst verschijnt live)
- API route /api/run-agent die Claude aanroept met het juiste system_prompt
- Foutafhandeling + loading states op alle async acties
- .env.example met ANTHROPIC_API_KEY
- README.md met installatie-instructies (npm install && npm run dev)

## Opbouw
1. Maak package.json aan (next, react, react-dom, @anthropic-ai/sdk, tailwindcss)
2. Maak de configuratiebestanden (next.config.mjs, tailwind.config.ts, tsconfig.json, postcss.config.mjs)
3. Maak app/globals.css, app/layout.tsx
4. Maak app/api/run-agent/route.ts (streaming Claude route met system_prompt param)
5. Maak app/page.tsx (de volledige process runner)
6. Maak .env.example en README.md
7. Voer npm install uit om te verifiëren dat alles klopt

Schrijf volledige, werkende code — geen placeholders. Sluit af met een samenvatting van wat je gebouwd hebt.`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: unknown) => {
        try {
          const payload = typeof data === "object" && data !== null ? { type, ...data } : { type, value: data };
          const line = "data: " + JSON.stringify(payload) + "\n\n";
          controller.enqueue(encoder.encode(line));
        } catch {
          // client disconnected
        }
      };

      send("start", { buildId, buildDir });

      try {
        for await (const message of query({
          prompt,
          options: {
            cwd: buildDir,
            allowedTools: ["Write", "Edit", "Read", "Bash"],
            permissionMode: "bypassPermissions",
            allowDangerouslySkipPermissions: true,
            maxTurns: 80,
          },
        })) {
          // Tool use events
          if (message.type === "assistant" && "message" in message) {
            const msg = message.message as { content?: Array<{ type: string; name?: string; input?: unknown; text?: string }> };
            for (const block of msg.content ?? []) {
              if (block.type === "tool_use") {
                send("tool", { name: block.name, input: block.input });
              } else if (block.type === "text" && block.text) {
                send("text", { text: block.text });
              }
            }
          }

          // Result
          if ("result" in message) {
            send("result", {
              result: message.result,
              buildId,
            });
          }

          // System init
          if (message.type === "system" && "subtype" in message && message.subtype === "init") {
            send("init", { sessionId: (message as { session_id?: string }).session_id });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Build mislukt";
        // Check if it's a missing claude CLI error
        if (msg.includes("claude") && (msg.includes("not found") || msg.includes("ENOENT") || msg.includes("spawn"))) {
          send("error", {
            text: "Claude Code CLI niet gevonden. Installeer het met: npm install -g @anthropic-ai/claude-code",
            fatal: true,
          });
        } else {
          send("error", { text: msg, fatal: true });
        }
      }

      try { controller.close(); } catch { /* already closed */ }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
