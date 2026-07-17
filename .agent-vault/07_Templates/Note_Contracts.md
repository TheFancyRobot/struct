# Note Contracts

Use this note as the shared contract for all Agent Vault note templates in \`07_Templates/\`.

## Shared Frontmatter Contract

- Every note starts with YAML frontmatter.
- Every note declares `note_type`, `template_version`, and `contract_version`.
- Dates use `YYYY-MM-DD`.
- Link collections stay as YAML lists.

## Source Of Truth Boundaries

- Home notes summarize and route.
- Phase, architecture, bug, and decision notes hold durable truth.
- Session notes capture chronology and handoff state.
- Index notes improve discovery only.

## Stable Heading Contract

- Do not rename required headings.
- Keep heading order stable unless the template contract changes.

## Generated Block Contract

- Agent-managed regions use this exact wrapper:

\`\`\`md
<!-- AGENT-START:block-name -->
...
<!-- AGENT-END:block-name -->
\`\`\`

- Block names are stable identifiers.
- Automation may replace block contents.
- Do not nest generated blocks.
- Keep one logical data set per block.

## Editing Rules

- Keep human narrative outside generated blocks.
- Prefer updating frontmatter lists and generated blocks before rewriting prose.
- Bump `contract_version` when required fields change.

## Manual-Edit Friendly Rules

- Reserve generated blocks for summaries, indexes, snapshots, and append-only history.
- Keep judgment calls and nuanced explanation in normal prose.
- Split oversized sections into linked notes.

## Template Inventory

- [[07_Templates/Phase_Template|Phase Template]]
- [[07_Templates/Step_Template|Step Template]]
- [[07_Templates/Bug_Template|Bug Template]]
- [[07_Templates/Decision_Template|Decision Template]]
- [[07_Templates/Session_Template|Session Template]]
- [[07_Templates/Architecture_Template|Architecture Template]]
