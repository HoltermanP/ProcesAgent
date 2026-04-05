import { NextRequest, NextResponse } from "next/server";
import { generateText, SYSTEM_PROMPTS, parseJsonFromAI } from "@/lib/ai";
import {
  getProcess,
  upsertProcess,
  getProcessSteps,
  upsertProcessSteps,
  getMessages,
  saveMessage,
} from "@/lib/db";
import type { CanvasData } from "@/components/ui/ProcessCanvas";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      projectId: string;
      message?: string;
    };

    if (!body.projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // Get analysis history for context
    const analysisHistory = await getMessages(body.projectId, "procesanalyse");
    const analysisSummary = analysisHistory
      .map((m) => `${m.role === "user" ? "Gebruiker" : "AI"}: ${m.content}`)
      .join("\n\n");

    if (!analysisSummary.trim()) {
      return NextResponse.json(
        { error: "Geen procesanalyse gevonden. Voer eerst een analyse uit." },
        { status: 400 }
      );
    }

    const prompt = body.message
      ? `${body.message}\n\nProcesanalyse:\n${analysisSummary}`
      : `Genereer het procesmodel voor dit proces:\n\n${analysisSummary}`;

    const responseText = await generateText(
      SYSTEM_PROMPTS.visueelOntwerp,
      prompt
    );

    let canvasData: CanvasData | null = null;
    try {
      const parsed = parseJsonFromAI(responseText) as unknown as CanvasData;
      if (Array.isArray(parsed.nodes)) {
        canvasData = parsed;
      }
    } catch {
      // If parsing fails, still save the raw response
    }

    // Save to DB
    const canvasRecord = canvasData
      ? (canvasData as unknown as Record<string, unknown>)
      : undefined;
    await upsertProcess(body.projectId, canvasRecord, { rawResponse: responseText });

    if (canvasData?.nodes) {
      const steps = canvasData.nodes
        .filter((n) => n.type !== "start" && n.type !== "end")
        .map((n, i) => ({
          name: n.label,
          description: null,
          order_index: i,
          step_type: (n.type === "decision" ? "decision" : n.type === "agent" ? "manual" : "manual") as
            | "manual"
            | "decision"
            | "start"
            | "end",
          agent_opportunity: n.agentOpportunity ?? false,
          opportunity_score: n.opportunityScore ?? null,
        }));
      await upsertProcessSteps(body.projectId, steps);
    }

    // Save to messages for design context
    if (body.message) {
      await saveMessage(body.projectId, "visueel", "user", body.message);
    }
    await saveMessage(body.projectId, "visueel", "assistant", responseText);

    return NextResponse.json({ canvas: canvasData, raw: responseText });
  } catch (error) {
    console.error("[POST /api/design]", error);
    return NextResponse.json({ error: "Failed to generate process design" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  try {
    const [process, steps] = await Promise.all([
      getProcess(projectId),
      getProcessSteps(projectId),
    ]);
    return NextResponse.json({ process, steps });
  } catch (error) {
    console.error("[GET /api/design]", error);
    return NextResponse.json({ error: "Failed to fetch design" }, { status: 500 });
  }
}
