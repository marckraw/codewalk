export function resolvePositiveIntegerEnv(
  env: Record<string, string | undefined>,
  key: string,
  defaultValue: number,
) {
  const rawValue = env[key]?.trim();

  if (!rawValue) {
    return defaultValue;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    return defaultValue;
  }

  return value;
}
