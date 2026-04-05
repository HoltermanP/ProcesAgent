import { NextRequest, NextResponse } from "next/server";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { getProject, getProcessSteps, getAgents } from "@/lib/db";
import { BUILD_DIRS } from "@/lib/build-store";
import { mkdirSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";
import { execSync } from "child_process";

export const maxDuration = 300;

// Resolve the `claude` binary at startup so Next.js API routes get the right path
function findClaudePath(): string {
  // 1. Explicit env override
  if (process.env.CLAUDE_PATH) return process.env.CLAUDE_PATH;

  // 2. Try `which claude` via shell (inherits user PATH incl. nvm/fnm/homebrew)
  try {
    const found = execSync("which claude", { encoding: "utf-8" }).trim();
    if (found && existsSync(found)) return found;
  } catch { /* not in PATH */ }

  // 3. Common locations
  const candidates = [
    join(process.env.HOME ?? "", ".nvm/versions/node/v20.19.5/bin/claude"),
    join(process.env.HOME ?? "", ".nvm/versions/node/v22.0.0/bin/claude"),
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
    join(process.env.HOME ?? "", ".npm-global/bin/claude"),
    join(process.env.HOME ?? "", ".local/bin/claude"),
  ];
  // Also scan all nvm node versions
  const nvmDir = process.env.NVM_DIR ?? join(process.env.HOME ?? "", ".nvm");
  try {
    const versions = execSync(`ls "${nvmDir}/versions/node/"`, { encoding: "utf-8" })
      .trim().split("\n");
    for (const v of versions) {
      candidates.push(join(nvmDir, "versions/node", v, "bin/claude"));
    }
  } catch { /* no nvm */ }

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }

  throw new Error(
    "Claude Code CLI niet gevonden. Installeer het met: npm install -g @anthropic-ai/claude-code\n" +
    "Of stel CLAUDE_PATH in op het absolute pad."
  );
}

let CLAUDE_PATH: string | null = null;
try {
  CLAUDE_PATH = findClaudePath();
} catch { /* will error at request time */ }

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { projectId: string };

  if (!body.projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  // Resolve claude path now (throws with helpful message if not found)
  let claudePath: string;
  try {
    claudePath = CLAUDE_PATH ?? findClaudePath();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
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

  // ── Prompt ────────────────────────────────────────────────────────────────
  const stepsText = steps
    .map(
      (s, i) =>
        `${i + 1}. ${s.name}${s.description ? ` — ${s.description}` : ""} (agent: ${s.agent_opportunity ? "ja" : "nee"})`
    )
    .join("\n");

  const agentsText = agents
    .map((a) => {
      const step = steps.find((s) => s.id === a.process_step_id);
      return `- ${a.name} | ${a.agent_type} | ${a.model} | stap: ${step?.name ?? "n.v.t."}\n  prompt: ${(a.system_prompt ?? "").slice(0, 300)}`;
    })
    .join("\n\n");

  const prompt = `Je werkt in de map: ${buildDir}

Bouw een complete Next.js 14 applicatie voor het project "${project.name}". Alle bestanden moeten RELATIEF in de huidige map worden aangemaakt (dus "package.json", "app/page.tsx" etc — nooit absolute paden).

## Processtappen
${stepsText}

## Agents
${agentsText || "Geen agents ontworpen."}

## Wat te bouwen
1. package.json — dependencies: next@14, react, react-dom, @anthropic-ai/sdk, tailwindcss, autoprefixer, postcss
2. next.config.mjs, tailwind.config.ts, tsconfig.json, postcss.config.mjs
3. app/globals.css (dark theme, @tailwind directives)
4. app/layout.tsx
5. app/api/run-agent/route.ts — POST route die Claude aanroept via @anthropic-ai/sdk, streamt tekst terug
6. app/page.tsx — process runner:
   - Alle processtappen als uitklapbare kaarten op volgorde
   - Per stap een toggle (aan/uit) voor de agent, opgeslagen in localStorage
   - "Voer uit" knop per stap, output van stap N wordt input voor stap N+1
   - "Alles uitvoeren" knop
   - Streaming output zichtbaar per stap
7. .env.example met ANTHROPIC_API_KEY=
8. README.md met: npm install, .env.local aanmaken, npm run dev

Schrijf volledige werkende code. Gebruik ALLEEN relatieve paden bij Write/Edit tools.`;

  // ── Stream ────────────────────────────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: unknown) => {
        try {
          const payload =
            typeof data === "object" && data !== null
              ? { type, ...data }
              : { type, value: data };
          controller.enqueue(encoder.encode("data: " + JSON.stringify(payload) + "\n\n"));
        } catch { /* client disconnected */ }
      };

      send("start", { buildId, buildDir, claudePath });

      try {
        for await (const message of query({
          prompt,
          options: {
            cwd: buildDir,
            allowedTools: ["Write", "Edit", "Read", "Bash", "Glob"],
            permissionMode: "bypassPermissions",
            allowDangerouslySkipPermissions: true,
            maxTurns: 80,
            pathToClaudeCodeExecutable: claudePath,
            env: {
              ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
              PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
              HOME: process.env.HOME ?? "",
              NODE_ENV: "production",
            },
          },
        })) {
          if (message.type === "assistant" && "message" in message) {
            const msg = message.message as {
              content?: Array<{ type: string; name?: string; input?: unknown; text?: string }>;
            };
            for (const block of msg.content ?? []) {
              if (block.type === "tool_use") {
                send("tool", { name: block.name, input: block.input });
              } else if (block.type === "text" && block.text?.trim()) {
                send("text", { text: block.text });
              }
            }
          }

          if ("result" in message) {
            send("result", { result: message.result, buildId });
          }

          if (
            message.type === "system" &&
            "subtype" in message &&
            message.subtype === "init"
          ) {
            send("init", {
              sessionId: (message as { session_id?: string }).session_id,
            });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Build mislukt";
        send("error", { text: msg, fatal: true });
      }

      try { controller.close(); } catch { /* already closed */ }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
