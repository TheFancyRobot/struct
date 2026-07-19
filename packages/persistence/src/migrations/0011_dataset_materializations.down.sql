DROP TRIGGER IF EXISTS dataset_materializations_immutable
  ON dataset_materializations;
DROP TABLE IF EXISTS dataset_materializations;
DELETE FROM job_queue
WHERE id IN (SELECT job_id FROM dataset_materialization_jobs);
DROP TABLE IF EXISTS dataset_materialization_jobs;
