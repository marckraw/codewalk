type LogFields = Record<string, unknown>;

export function logCodewalkEvent(event: string, fields: LogFields = {}) {
  console.info(JSON.stringify(buildLogRecord("info", event, fields)));
}

export function logCodewalkWarning(event: string, fields: LogFields = {}) {
  console.warn(JSON.stringify(buildLogRecord("warn", event, fields)));
}

export function logCodewalkError(event: string, fields: LogFields = {}) {
  console.error(JSON.stringify(buildLogRecord("error", event, fields)));
}

function buildLogRecord(level: "error" | "info" | "warn", event: string, fields: LogFields) {
  return {
    event,
    level,
    timestamp: new Date().toISOString(),
    ...normalizeFields(fields),
  };
}

function normalizeFields(fields: LogFields): LogFields {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, normalizeValue(value)]),
  );
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      message: value.message,
      name: value.name,
    };
  }

  return value;
}
