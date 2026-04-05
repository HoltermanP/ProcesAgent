import { NextRequest, NextResponse } from "next/server";
import { streamText, SYSTEM_PROMPTS } from "@/lib/ai";
import {
  getApplicationDesign,
  upsertApplicationDesign,
  getAgents,
  getProcessSteps,
  saveMessage,
  getMessages,
} from "@/lib/db";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  try {
    const [design, messages] = await Promise.all([
      getApplicationDesign(projectId),
      getMessages(projectId, "applicatie"),
    ]);
    return NextResponse.json({ design, messages });
  } catch (error) {
    console.error("[GET /api/application]", error);
    return NextResponse.json({ error: "Failed to fetch application design" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      projectId: string;
      message?: string;
    };

    if (!body.projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const [agents, steps, history] = await Promise.all([
      getAgents(body.projectId),
      getProcessSteps(body.projectId),
      getMessages(body.projectId, "applicatie"),
    ]);

    const agentSummary = agents
      .map((a) => `- ${a.name} (${a.agent_type}): ${a.description ?? "geen beschrijving"}`)
      .join("\n");

    const stepSummary = steps
      .map((s) => `- ${s.name} (agent kans: ${s.agent_opportunity ? "ja" : "nee"})`)
      .join("\n");

    const systemContext = `Processtappen:\n${stepSummary}\n\nOntworpen agents:\n${agentSummary}`;

    const userMessage = body.message
      ? body.message
      : `Genereer een volledig applicatie-ontwerp voor dit AI-agent systeem.\n\n${systemContext}`;

    const chatMessages = [
      ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: userMessage },
    ];

    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamText(
            SYSTEM_PROMPTS.applicatieOntwerp,
            chatMessages,
            "claude-sonnet-4-6"
          )) {
            fullResponse += chunk;
            controller.enqueue(encoder.encode(chunk));
          }

          // Save messages
          await saveMessage(body.projectId, "applicatie", "user", userMessage);
          await saveMessage(body.projectId, "applicatie", "assistant", fullResponse);

          // Upsert design with generated code
          await upsertApplicationDesign(body.projectId, {
            title: "Applicatie Ontwerp",
            generated_code: fullResponse,
            status: "draft",
          });

          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[POST /api/application]", error);
    return NextResponse.json({ error: "Failed to generate application design" }, { status: 500 });
  }
}
