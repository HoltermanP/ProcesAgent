import { NextRequest, NextResponse } from "next/server";
import { updateAgent, deleteAgent } from "@/lib/db";

type Params = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const body = (await request.json()) as Parameters<typeof updateAgent>[1];
    const agent = await updateAgent(params.id, body);
    return NextResponse.json(agent);
  } catch (error) {
    console.error("[PATCH /api/agents/[id]]", error);
    return NextResponse.json({ error: "Failed to update agent" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await deleteAgent(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/agents/[id]]", error);
    return NextResponse.json({ error: "Failed to delete agent" }, { status: 500 });
  }
}
