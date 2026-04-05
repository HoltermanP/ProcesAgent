-- Add unique constraints for upsert operations
ALTER TABLE processes ADD CONSTRAINT uq_processes_project UNIQUE (project_id);
ALTER TABLE application_designs ADD CONSTRAINT uq_app_designs_project UNIQUE (project_id);
