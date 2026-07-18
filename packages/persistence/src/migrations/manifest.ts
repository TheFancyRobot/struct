/**
 * Migration manifest — ordered list of migrations with their up/down SQL paths.
 *
 * The runner reads this manifest and applies migrations in order.
 * Each entry has a unique name used for tracking applied migrations.
 */
export interface Migration {
  readonly name: string
  readonly upPath: string
  readonly downPath: string
}

export const migrations: readonly Migration[] = [
  {
    name: '0001_enable_pgvector',
    upPath: new URL('./0001_enable_pgvector.sql', import.meta.url).pathname,
    downPath: new URL('./0001_enable_pgvector.down.sql', import.meta.url).pathname,
  },
  {
    name: '0002_init_tables',
    upPath: new URL('./0002_init_tables.sql', import.meta.url).pathname,
    downPath: new URL('./0002_init_tables.down.sql', import.meta.url).pathname,
  },
] as const
