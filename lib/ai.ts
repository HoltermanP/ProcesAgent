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

  visueelOntwerp: `Je bent een expert in business process modeling voor AI-Group.
Op basis van een procesanalyse genereer je ALTIJD een geldig JSON-object — niets anders, geen uitleg, geen markdown, alleen pure JSON.

Formaat (strikt verplicht):
{
  "nodes": [
    { "id": "n1", "type": "start", "label": "Start", "x": 40, "y": 150 },
    { "id": "n2", "type": "task", "label": "Taaknaam", "x": 240, "y": 150, "agentOpportunity": false },
    { "id": "n3", "type": "decision", "label": "Beslissing?", "x": 440, "y": 150 },
    { "id": "n4", "type": "agent", "label": "Agent stap", "x": 640, "y": 150, "agentOpportunity": true, "opportunityScore": 9 },
    { "id": "n5", "type": "end", "label": "Einde", "x": 840, "y": 150 }
  ],
  "edges": [
    { "id": "e1", "from": "n1", "to": "n2" },
    { "id": "e2", "from": "n2", "to": "n3" },
    { "id": "e3", "from": "n3", "to": "n4", "label": "Ja" },
    { "id": "e4", "from": "n4", "to": "n5" }
  ]
}

Regels:
- x-coördinaten: begin op 40, stap 200px per node
- y-coördinaten: hoofdlijn op 150, vertakkingen op 300
- node types: start, end, task, decision, agent
- agentOpportunity: true als AI hier zinvol is, met opportunityScore 1-10
- Label maximaal 20 tekens
- Geef ALLEEN het JSON-object terug, geen tekst eromheen`,

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

// Parse JSON from AI response (handles markdown code blocks and inline JSON)
export function parseJsonFromAI(text: string): Record<string, unknown> {
  // 1. Strip markdown code fences
  let cleaned = text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  // 2. Try direct parse first
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    // 3. Find the first { ... } block in the text
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      cleaned = cleaned.slice(start, end + 1);
      return JSON.parse(cleaned) as Record<string, unknown>;
    }
    throw new Error("No valid JSON found in response");
  }
}
