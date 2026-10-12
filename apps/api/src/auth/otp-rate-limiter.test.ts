import { describe, expect, it, vi } from "vitest";
import {
  PostgresOtpRateLimiter,
  createOtpRateLimitKey,
  defaultOtpRateLimitRules,
} from "./otp-rate-limiter.js";

describe("createOtpRateLimitKey", () => {
  it("hashes normalized emails so raw addresses are never stored", () => {
    const key = createOtpRateLimitKey(" Ada@Example.com ", "verify");

    expect(key).toBe(createOtpRateLimitKey("ada@example.com", "verify"));
    expect(key).toMatch(/^verify:[0-9a-f]{64}$/);
    expect(key).not.toContain("ada");
    expect(createOtpRateLimitKey("ada@example.com", "send")).not.toBe(key);
  });
});

describe("defaultOtpRateLimitRules", () => {
  it("allows 5 codes per hour 90 seconds apart and 10 verification attempts per hour", () => {
    expect(defaultOtpRateLimitRules).toEqual({
      send: { max: 5, windowSeconds: 3600, minIntervalSeconds: 90 },
      verify: { max: 10, windowSeconds: 3600, minIntervalSeconds: 0 },
    });
  });
});

describe("PostgresOtpRateLimiter", () => {
  it("allows the attempt when the atomic upsert counts it", async () => {
    const query = vi.fn(async () => ({ rows: [{ key: "send:hash" }] }));
    const limiter = new PostgresOtpRateLimiter({ query });

    await expect(limiter.consume("ada@example.com", "send")).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    expect(query).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(expect.stringContaining("ON CONFLICT (key) DO UPDATE"), [
      createOtpRateLimitKey("ada@example.com", "send"),
      3600,
      5,
      90,
    ]);
  });

  it("rejects the attempt with the remaining delay when the upsert is blocked", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ retry_after_seconds: "74.2" }] });
    const limiter = new PostgresOtpRateLimiter({ query });

    await expect(limiter.consume("ada@example.com", "send")).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 75,
    });
  });

  it("deletes the counter on reset", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const limiter = new PostgresOtpRateLimiter({ query });

    await limiter.reset("ada@example.com", "verify");

    expect(query).toHaveBeenCalledWith("DELETE FROM auth_otp_rate_limit WHERE key = $1", [
      createOtpRateLimitKey("ada@example.com", "verify"),
    ]);
  });
});
