/**
 * @struct/domain — canonical identifiers, Effect Schemas, typed errors, value/event contracts.
 *
 * This is the leaf package (layer 0). It imports nothing from other internal packages.
 * It exports the authoritative type contracts consumed by all other packages and apps.
 */

export * from './branded-ids.js'
export * from './directory-manifest.js'
export * from './dataset-catalog.js'
export * from './dataset-query-evidence.js'
export * from './directory-controls.js'
export * from './ingestion-job.js'
export * from './document.js'
export * from './logical-refs.js'
export * from './research-execution.js'
export * from './research-events.js'
export * from './research-plan.js'
export * from './schemas.js'
export * from './source-version.js'
export * from './source-uploads.js'
export * from './typed-errors.js'
