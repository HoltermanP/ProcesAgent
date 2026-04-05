import { NextRequest, NextResponse } from "next/server";
import { streamText, SYSTEM_PROMPTS } from "@/lib/ai";
import { saveMessage, getMessages } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      projectId: string;
      message: string;
    };

    if (!body.projectId || !body.message?.trim()) {
      return NextResponse.json(
        { error: "projectId and message are required" },
        { status: 400 }
      );
    }

    // Save user message
    await saveMessage(body.projectId, "procesanalyse", "user", body.message);

    // Load history for context
    const history = await getMessages(body.projectId, "procesanalyse");
    const chatMessages = history.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Stream response
    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamText(
            SYSTEM_PROMPTS.procesanalyse,
            chatMessages,
            "claude-sonnet-4-6"
          )) {
            fullResponse += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
          // Save assistant response
          await saveMessage(body.projectId, "procesanalyse", "assistant", fullResponse);
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
    console.error("[POST /api/analyze]", error);
    return NextResponse.json(
      { error: "Failed to process analysis request" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  try {
    const messages = await getMessages(projectId, "procesanalyse");
    return NextResponse.json(messages);
  } catch (error) {
    console.error("[GET /api/analyze]", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}
