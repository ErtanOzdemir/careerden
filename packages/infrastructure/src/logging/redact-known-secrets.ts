const minimumFragmentLength = 8;
const maximumFragmentLength = 32;

// Replaces secrets the caller holds, such as an API key or a session token, with a marker.
// Providers sometimes echo part of a key back, so long prefixes and suffixes are removed too.
export function redactKnownSecrets(text: string, secrets: Iterable<string>): string {
  let redacted = text;
  for (const secret of secrets) {
    if (secret.length === 0) continue;
    redacted = redacted.split(secret).join("[REDACTED]");
    const longestFragment = Math.min(secret.length - 1, maximumFragmentLength);
    for (let length = longestFragment; length >= minimumFragmentLength; length -= 1) {
      redacted = redacted.split(secret.slice(0, length)).join("[REDACTED]");
      redacted = redacted.split(secret.slice(-length)).join("[REDACTED]");
    }
  }
  return redacted;
}
