# Execution Brief

- Record why the step exists, prerequisites, likely code paths, and the smallest execution checklist here.

- Prerequisite: STEP-10-05 stable citation and run context.
- Required reading: Domain Model; Phase 08; DEC-0006; finding/report lifecycle code; approved Note requirements.
- Starting files: `packages/domain/src/finding.ts`, `packages/domain/src/report.ts`, persistence migrations and durable-artifact repositories/routes, `apps/web/src/api/artifacts.ts`, and `NotebookView.tsx`.
- Checklist: define a distinct Note model with authorship, revisions, and provenance; add greenfield persistence and repository; expose authenticated CRUD/archive routes; add a typed web client; implement list/editor/autosave; implement Save as note; retain citation navigation.
- Edge cases: empty title/content, concurrent edit, autosave failure, reload during save, citation drift, archived note, cross-workspace access, and note creation from partial output.
- Assumption: notes are user-authored durable objects, not aliases for generated findings; the greenfield policy permits direct schema creation without compatibility layers.

## Related Notes

- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_06_add-durable-user-notes-with-provenance|STEP-10-06 Add Durable User Notes with Provenance]]
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
