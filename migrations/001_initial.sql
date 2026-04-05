-- ProcesAgents — Initial Schema
-- Run via: psql $DATABASE_URL -f migrations/001_initial.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'draft',  -- draft | active | archived
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Process steps within a project
CREATE TABLE IF NOT EXISTS process_steps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  order_index  INTEGER NOT NULL DEFAULT 0,
  step_type    TEXT NOT NULL DEFAULT 'manual',  -- manual | decision | start | end
  agent_opportunity BOOLEAN NOT NULL DEFAULT FALSE,
  opportunity_score INTEGER,                    -- 1–10
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Full process model (JSON blob for visual design)
CREATE TABLE IF NOT EXISTS processes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  canvas_data JSONB,                            -- node/edge graph data
  analysis    JSONB,                            -- AI analysis results
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agents designed for specific process steps
CREATE TABLE IF NOT EXISTS agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  process_step_id UUID REFERENCES process_steps(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  agent_type      TEXT NOT NULL DEFAULT 'assistant',  -- assistant | extractor | router | coder
  model           TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  system_prompt   TEXT,
  tools           JSONB,                        -- list of tool configs
  config          JSONB,                        -- extra config
  status          TEXT NOT NULL DEFAULT 'draft', -- draft | active | paused
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Application designs (final output specs)
CREATE TABLE IF NOT EXISTS application_designs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  tech_stack   JSONB,
  architecture JSONB,
  components   JSONB,
  api_routes   JSONB,
  generated_code TEXT,
  status       TEXT NOT NULL DEFAULT 'draft',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI conversation messages per project (for continuity)
CREATE TABLE IF NOT EXISTS messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  context     TEXT NOT NULL,   -- procesanalyse | visueel | agents | applicatie
  role        TEXT NOT NULL,   -- user | assistant
  content     TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_process_steps_project  ON process_steps(project_id);
CREATE INDEX IF NOT EXISTS idx_processes_project      ON processes(project_id);
CREATE INDEX IF NOT EXISTS idx_agents_project         ON agents(project_id);
CREATE INDEX IF NOT EXISTS idx_agents_step            ON agents(process_step_id);
CREATE INDEX IF NOT EXISTS idx_app_designs_project    ON application_designs(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_project       ON messages(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_context       ON messages(project_id, context);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects','process_steps','processes','agents','application_designs'] LOOP
    EXECUTE format(
      'CREATE TRIGGER trigger_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      t
    );
  END LOOP;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;
