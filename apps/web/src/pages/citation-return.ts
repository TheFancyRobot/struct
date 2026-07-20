export function reportReturnPath(
  projectId: string,
  value: string | undefined,
): string | undefined {
  const notebook = `/projects/${projectId}/notebook`
  return value === notebook || value?.startsWith(`${notebook}?`)
    ? value
    : undefined
}
