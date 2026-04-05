import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export const DEFAULT_MODEL = "claude-sonnet-4-6";

// Streaming helper — yields text chunks
export async function* streamText(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  model = DEFAULT_MODEL
): AsyncGenerator<string> {
  const client = getClient();

  const stream = await client.messages.stream({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  for await (const chunk of stream) {
    if (
      chunk.type === "content_block_delta" &&
      chunk.delta.type === "text_delta"
    ) {
      yield chunk.delta.text;
    }
  }
}

// Non-streaming helper — returns full text
export async function generateText(
  systemPrompt: string,
  userMessage: string,
  model = DEFAULT_MODEL
): Promise<string> {
  const client = getClient();

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }
  return block.text;
}

// System prompts
export const SYSTEM_PROMPTS = {
  procesanalyse: `Je bent een expert business process analyst voor AI-Group.
Je helpt gebruikers hun bedrijfsprocessen te analyseren en identificeert kansen voor AI-automatisering.
Stel gerichte vragen om het proces volledig te begrijpen: inputs, outputs, betrokkenen, beslissingspunten, knelpunten.
Geef gestructureerde analyses terug in JSON-formaat waar van toepassing.
Taal: Nederlands. Wees concreet, bondig en professioneel.`,

  visueelOntwerp: `Je bent een expert in business process modeling (BPMN-achtig) voor AI-Group.
Op basis van een procesanalyse ontwerp je een visueel procesmodel als JSON-datastructuur met nodes en edges.
Node types: start, end, task, decision, agent.
Geef een JSON-object terug met 'nodes' en 'edges' arrays.
Identificeer welke stappen de beste agent-kansen zijn (hoge opportunity_score).
Taal: Nederlands.`,

  agentOntwerp: `Je bent een expert AI-agent architect voor AI-Group.
Op basis van een processtap ontwerp je een Claude-agent met: naam, beschrijving, system prompt, tools, en configuratie.
Gebruik het claude-sonnet-4-6 model als default.
Geef concrete, productie-klare agent-specificaties terug.
Taal: Nederlands.`,

  applicatieOntwerp: `Je bent een senior software architect voor AI-Group.
Op basis van een procesanalyse en agent-ontwerpen genereer je een volledig applicatie-ontwerp.
Tech stack: Next.js 14 + TypeScript + Tailwind + NEON + Claude API.
Geef architectuur, componenten, API routes, en starter code terug.
Taal: Nederlands voor beschrijvingen, Engels voor code.`,
} as const;

// Parse JSON from AI response (handles markdown code blocks)
export function parseJsonFromAI(text: string): Record<string, unknown> {
  // Strip markdown code fences if present
  const cleaned = text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
  return JSON.parse(cleaned) as Record<string, unknown>;
}
