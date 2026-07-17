

<!-- agent-vault:start -->

## Agent Vault

Use `.agent-vault/` as durable project memory. Prefer MCP tools over direct edits.

### Start

1. Read `.agent-vault/00_Home/Active_Context.md`.
2. Follow only the links needed for the current task.
3. Create or update notes with MCP tools.

### MCP Tools

- `vault_traverse` - load narrow linked context
- `vault_extract` - extract one heading or generated block without loading a whole note
- `vault_lookup_code_graph` - symbol/file lookup without loading the full index
- `vault_create` - create phase, step, session, bug, and decision notes
- `vault_mutate` - update frontmatter or append sections
- `vault_refresh` - rebuild indexes, active context, or code graph
- `vault_validate` - run vault integrity checks
- `vault_help` - command help

### Rules

- Use bounded mutations only.
- Do not rewrite whole notes or delete human prose.
- Do not load the whole vault by default.
- Prefer `vault_extract` when a specific heading or generated block is enough.
- Treat `01_Architecture/Code_Graph.md` as summary-only; use `vault_lookup_code_graph` for detail.
- See `.agent-vault/AGENTS.md` for the full contract.

<!-- agent-vault:end -->
