CREATE TABLE research_run_dataset_citations (
  run_id UUID NOT NULL REFERENCES research_run_results(run_id) ON DELETE CASCADE,
  dataset_citation_id UUID NOT NULL REFERENCES dataset_citations(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (run_id, ordinal),
  CONSTRAINT uq_research_run_dataset_citation
    UNIQUE (run_id, dataset_citation_id)
);

CREATE INDEX idx_research_run_dataset_citations_citation
  ON research_run_dataset_citations (dataset_citation_id, run_id);
