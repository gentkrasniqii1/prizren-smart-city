/** Keys that must never appear in process logs (JWT, provider keys, raw tokens). */
const SENSITIVE_KEY =
  /password|secret|token|authorization|cookie|api[_-]?key|jwt|bearer|resend|smtp(pass|user)|private[_-]?key|^raw$/i;

const JWT_SHAPE = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./;

export function sanitizeLogValue(value: unknown, key = ''): unknown {
  if (SENSITIVE_KEY.test(key)) {
    return '[redacted]';
  }
  if (typeof value === 'string') {
    return JWT_SHAPE.test(value) ? '[redacted]' : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, child]) => [
        childKey,
        sanitizeLogValue(child, childKey),
      ]),
    );
  }
  return value;
}

/** Staff notes stay in AuditLog rows; they must not appear in process logs. */
export function omitLogNotes(metadata: unknown): unknown {
  if (metadata == null) {
    return null;
  }
  const cleaned = sanitizeLogValue(metadata);
  if (!cleaned || typeof cleaned !== 'object' || Array.isArray(cleaned)) {
    return cleaned;
  }
  const record = { ...(cleaned as Record<string, unknown>) };
  delete record.note;
  delete record.notes;
  delete record.text;
  delete record.html;
  return record;
}
