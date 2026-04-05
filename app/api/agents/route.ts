import { NextRequest, NextResponse } from "next/server";
import { generateText, SYSTEM_PROMPTS, parseJsonFromAI } from "@/lib/ai";
import { getAgents, createAgent, getProcessSteps, saveMessage } from "@/lib/db";
import type { Agent } from "@/lib/db";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  try {
    const [agents, steps] = await Promise.all([
      getAgents(projectId),
      getProcessSteps(projectId),
    ]);
    return NextResponse.json({ agents, steps });
  } catch (error) {
    console.error("[GET /api/agents]", error);
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      projectId: string;
      stepId?: string;
      stepName?: string;
      customPrompt?: string;
    };

    if (!body.projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const stepName = body.stepName ?? "onbekende stap";
    const prompt = body.customPrompt
      ? body.customPrompt
      : `Ontwerp een Claude-agent voor de volgende processtap: "${stepName}".

Geef een JSON-object terug met de volgende velden:
- name: string (agentnaam)
- description: string (wat de agent doet)
- agent_type: "assistant" | "extractor" | "router" | "coder"
- model: string (gebruik "claude-sonnet-4-6")
- system_prompt: string (gedetailleerde systeemprompt)
- tools: array van tool-objecten (bv. [{"type": "text_editor"}, {"type": "bash"}])
- config: object met extra instellingen

Wees specifiek en productie-klaar.`;

    const responseText = await generateText(SYSTEM_PROMPTS.agentOntwerp, prompt);

    let agentData: Partial<Omit<Agent, "id" | "created_at" | "updated_at">> = {};
    try {
      const parsed = parseJsonFromAI(responseText) as Partial<Agent>;
      agentData = {
        name: parsed.name ?? stepName + " Agent",
        description: parsed.description ?? null,
        agent_type: parsed.agent_type ?? "assistant",
        model: parsed.model ?? "claude-sonnet-4-6",
        system_prompt: parsed.system_prompt ?? null,
        tools: parsed.tools ?? null,
        config: parsed.config ?? null,
      };
    } catch {
      agentData = {
        name: stepName + " Agent",
        description: null,
        agent_type: "assistant",
        model: "claude-sonnet-4-6",
        system_prompt: responseText,
        tools: null,
        config: null,
      };
    }

    const agent = await createAgent({
      project_id: body.projectId,
      process_step_id: body.stepId ?? null,
      status: "draft",
      name: agentData.name ?? stepName + " Agent",
      description: agentData.description ?? null,
      agent_type: agentData.agent_type ?? "assistant",
      model: agentData.model ?? "claude-sonnet-4-6",
      system_prompt: agentData.system_prompt ?? null,
      tools: agentData.tools ?? null,
      config: agentData.config ?? null,
    });

    await saveMessage(body.projectId, "agents", "assistant", responseText, {
      agentId: agent.id,
      stepName,
    });

    return NextResponse.json({ agent, raw: responseText }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/agents]", error);
    return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
  }
}
