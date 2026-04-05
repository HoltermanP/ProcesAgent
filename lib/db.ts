import { neon } from "@neondatabase/serverless";

// sql is lazily initialized — missing DATABASE_URL causes runtime errors per query, not at module load
const sql = process.env.DATABASE_URL
  ? neon(process.env.DATABASE_URL)
  : null;

export { sql };

export type Project = {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  created_at: string;
  updated_at: string;
};

export type ProcessStep = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  order_index: number;
  step_type: "manual" | "decision" | "start" | "end";
  agent_opportunity: boolean;
  opportunity_score: number | null;
  created_at: string;
  updated_at: string;
};

export type Process = {
  id: string;
  project_id: string;
  canvas_data: Record<string, unknown> | null;
  analysis: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type Agent = {
  id: string;
  project_id: string;
  process_step_id: string | null;
  name: string;
  description: string | null;
  agent_type: "assistant" | "extractor" | "router" | "coder";
  model: string;
  system_prompt: string | null;
  tools: Record<string, unknown>[] | null;
  config: Record<string, unknown> | null;
  status: "draft" | "active" | "paused";
  created_at: string;
  updated_at: string;
};

export type ApplicationDesign = {
  id: string;
  project_id: string;
  title: string;
  tech_stack: Record<string, unknown> | null;
  architecture: Record<string, unknown> | null;
  components: Record<string, unknown> | null;
  api_routes: Record<string, unknown> | null;
  generated_code: string | null;
  status: "draft" | "active";
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  project_id: string;
  context: string;
  role: "user" | "assistant";
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

// --- Project helpers ---

export async function getProjects(): Promise<Project[]> {
  if (!sql) return [];
  const rows = await sql`
    SELECT * FROM projects ORDER BY updated_at DESC
  `;
  return rows as Project[];
}

export async function getProject(id: string): Promise<Project | null> {
  if (!sql) return null;
  const rows = await sql`
    SELECT * FROM projects WHERE id = ${id} LIMIT 1
  `;
  return (rows[0] as Project) ?? null;
}

export async function createProject(
  name: string,
  description?: string
): Promise<Project> {
  if (!sql) throw new Error("Database not configured");
  const rows = await sql`
    INSERT INTO projects (name, description)
    VALUES (${name}, ${description ?? null})
    RETURNING *
  `;
  return rows[0] as Project;
}

export async function updateProject(
  id: string,
  data: Partial<Pick<Project, "name" | "description" | "status">>
): Promise<Project> {
  if (!sql) throw new Error("Database not configured");
  const rows = await sql`
    UPDATE projects
    SET
      name        = COALESCE(${data.name ?? null}, name),
      description = COALESCE(${data.description ?? null}, description),
      status      = COALESCE(${data.status ?? null}, status)
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] as Project;
}

export async function deleteProject(id: string): Promise<void> {
  if (!sql) throw new Error("Database not configured");
  await sql`DELETE FROM projects WHERE id = ${id}`;
}

// --- ProcessStep helpers ---

export async function getProcessSteps(projectId: string): Promise<ProcessStep[]> {
  if (!sql) return [];
  const rows = await sql`
    SELECT * FROM process_steps
    WHERE project_id = ${projectId}
    ORDER BY order_index ASC
  `;
  return rows as ProcessStep[];
}

export async function upsertProcessSteps(
  projectId: string,
  steps: Array<Omit<ProcessStep, "id" | "project_id" | "created_at" | "updated_at"> & { id?: string }>
): Promise<ProcessStep[]> {
  if (!sql) throw new Error("Database not configured");
  // Delete existing and re-insert for simplicity
  await sql`DELETE FROM process_steps WHERE project_id = ${projectId}`;
  if (steps.length === 0) return [];
  const result: ProcessStep[] = [];
  for (const step of steps) {
    const rows = await sql`
      INSERT INTO process_steps (project_id, name, description, order_index, step_type, agent_opportunity, opportunity_score)
      VALUES (
        ${projectId},
        ${step.name},
        ${step.description ?? null},
        ${step.order_index},
        ${step.step_type},
        ${step.agent_opportunity},
        ${step.opportunity_score ?? null}
      )
      RETURNING *
    `;
    result.push(rows[0] as ProcessStep);
  }
  return result;
}

// --- Process helpers ---

export async function getProcess(projectId: string): Promise<Process | null> {
  if (!sql) return null;
  const rows = await sql`
    SELECT * FROM processes WHERE project_id = ${projectId} LIMIT 1
  `;
  return (rows[0] as Process) ?? null;
}

export async function upsertProcess(
  projectId: string,
  canvasData?: Record<string, unknown>,
  analysis?: Record<string, unknown>
): Promise<Process> {
  if (!sql) throw new Error("Database not configured");
  const rows = await sql`
    INSERT INTO processes (project_id, canvas_data, analysis)
    VALUES (${projectId}, ${canvasData ? JSON.stringify(canvasData) : null}, ${analysis ? JSON.stringify(analysis) : null})
    ON CONFLICT (project_id) DO UPDATE
      SET canvas_data = EXCLUDED.canvas_data,
          analysis    = EXCLUDED.analysis
    RETURNING *
  `;
  return rows[0] as Process;
}

// --- Agent helpers ---

export async function getAgents(projectId: string): Promise<Agent[]> {
  if (!sql) return [];
  const rows = await sql`
    SELECT * FROM agents WHERE project_id = ${projectId} ORDER BY created_at ASC
  `;
  return rows as Agent[];
}

export async function createAgent(
  data: Omit<Agent, "id" | "created_at" | "updated_at">
): Promise<Agent> {
  if (!sql) throw new Error("Database not configured");
  const rows = await sql`
    INSERT INTO agents (project_id, process_step_id, name, description, agent_type, model, system_prompt, tools, config, status)
    VALUES (
      ${data.project_id},
      ${data.process_step_id ?? null},
      ${data.name},
      ${data.description ?? null},
      ${data.agent_type},
      ${data.model},
      ${data.system_prompt ?? null},
      ${data.tools ? JSON.stringify(data.tools) : null},
      ${data.config ? JSON.stringify(data.config) : null},
      ${data.status}
    )
    RETURNING *
  `;
  return rows[0] as Agent;
}

export async function updateAgent(
  id: string,
  data: Partial<Omit<Agent, "id" | "created_at" | "updated_at">>
): Promise<Agent> {
  if (!sql) throw new Error("Database not configured");
  const rows = await sql`
    UPDATE agents SET
      name            = COALESCE(${data.name ?? null}, name),
      description     = COALESCE(${data.description ?? null}, description),
      system_prompt   = COALESCE(${data.system_prompt ?? null}, system_prompt),
      status          = COALESCE(${data.status ?? null}, status),
      tools           = COALESCE(${data.tools ? JSON.stringify(data.tools) : null}::jsonb, tools),
      config          = COALESCE(${data.config ? JSON.stringify(data.config) : null}::jsonb, config)
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] as Agent;
}

export async function deleteAgent(id: string): Promise<void> {
  if (!sql) throw new Error("Database not configured");
  await sql`DELETE FROM agents WHERE id = ${id}`;
}

// --- ApplicationDesign helpers ---

export async function getApplicationDesign(projectId: string): Promise<ApplicationDesign | null> {
  if (!sql) return null;
  const rows = await sql`
    SELECT * FROM application_designs WHERE project_id = ${projectId} LIMIT 1
  `;
  return (rows[0] as ApplicationDesign) ?? null;
}

export async function upsertApplicationDesign(
  projectId: string,
  data: Partial<Omit<ApplicationDesign, "id" | "project_id" | "created_at" | "updated_at">>
): Promise<ApplicationDesign> {
  if (!sql) throw new Error("Database not configured");
  const rows = await sql`
    INSERT INTO application_designs (project_id, title, tech_stack, architecture, components, api_routes, generated_code, status)
    VALUES (
      ${projectId},
      ${data.title ?? "Untitled Application"},
      ${data.tech_stack ? JSON.stringify(data.tech_stack) : null},
      ${data.architecture ? JSON.stringify(data.architecture) : null},
      ${data.components ? JSON.stringify(data.components) : null},
      ${data.api_routes ? JSON.stringify(data.api_routes) : null},
      ${data.generated_code ?? null},
      ${data.status ?? "draft"}
    )
    ON CONFLICT (project_id) DO UPDATE SET
      title           = EXCLUDED.title,
      tech_stack      = EXCLUDED.tech_stack,
      architecture    = EXCLUDED.architecture,
      components      = EXCLUDED.components,
      api_routes      = EXCLUDED.api_routes,
      generated_code  = EXCLUDED.generated_code,
      status          = EXCLUDED.status
    RETURNING *
  `;
  return rows[0] as ApplicationDesign;
}

// --- Message helpers ---

export async function getMessages(projectId: string, context: string): Promise<Message[]> {
  if (!sql) return [];
  const rows = await sql`
    SELECT * FROM messages
    WHERE project_id = ${projectId} AND context = ${context}
    ORDER BY created_at ASC
    LIMIT 100
  `;
  return rows as Message[];
}

export async function saveMessage(
  projectId: string,
  context: string,
  role: "user" | "assistant",
  content: string,
  metadata?: Record<string, unknown>
): Promise<Message> {
  if (!sql) throw new Error("Database not configured");
  const rows = await sql`
    INSERT INTO messages (project_id, context, role, content, metadata)
    VALUES (${projectId}, ${context}, ${role}, ${content}, ${metadata ? JSON.stringify(metadata) : null})
    RETURNING *
  `;
  return rows[0] as Message;
}
