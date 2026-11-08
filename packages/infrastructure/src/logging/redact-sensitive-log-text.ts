const maximumLogTextLength = 16_384;

// Removes credentials, tokens, and authentication headers from text bound for a log. Every
// runtime that writes logs, including the desktop log file, shares this one rule set.
export function redactSensitiveLogText(value: string): string {
  const redacted = value
    .replace(/\b(authorization|cookie|set-cookie)\s*:\s*[^\r\n]*/gi, "$1: [REDACTED]")
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [REDACTED]")
    .replace(/([a-z][a-z0-9+.-]*:\/\/)([^/\s:@]+):([^@\s/]+)@/gi, "$1[REDACTED]@")
    .replace(
      /(["']?\b(?:password|passcode|secret|token|otp|api[_-]?key|access[_-]?key|refresh[_-]?token)\b["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;\r\n]+)/gi,
      "$1[REDACTED]",
    )
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED]");

  return redacted.length > maximumLogTextLength
    ? `${redacted.slice(0, maximumLogTextLength)}...[TRUNCATED]`
    : redacted;
}
