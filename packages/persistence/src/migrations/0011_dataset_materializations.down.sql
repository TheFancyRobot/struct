DROP TRIGGER IF EXISTS dataset_materializations_immutable
  ON dataset_materializations;
DROP TABLE IF EXISTS dataset_materializations;
DELETE FROM job_queue
WHERE id IN (SELECT job_id FROM dataset_materialization_jobs);
DROP TRIGGER IF EXISTS dataset_materialization_jobs_delete_queue_row
  ON dataset_materialization_jobs;
DROP TABLE IF EXISTS dataset_materialization_jobs;
DROP FUNCTION IF EXISTS delete_dataset_materialization_queue_row();
