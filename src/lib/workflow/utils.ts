export function toEnvName(str: string): string {
  // convert camelCase to kebab-case
  // convert kebab-case to ENV_NAME
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
    .split('-').map((word) => word.toUpperCase())
    .join('_');
}
