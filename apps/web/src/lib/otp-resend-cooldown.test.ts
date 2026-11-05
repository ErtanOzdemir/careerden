import { describe, expect, it } from "vitest";
import { formatOtpCooldown, getOtpRetryAfterSeconds } from "./otp-resend-cooldown.js";

describe("formatOtpCooldown", () => {
  it("formats remaining seconds as minutes and seconds", () => {
    expect(formatOtpCooldown(90)).toBe("1:30");
    expect(formatOtpCooldown(5)).toBe("0:05");
    expect(formatOtpCooldown(3600)).toBe("60:00");
  });
});

describe("getOtpRetryAfterSeconds", () => {
  it("uses the server retry delay for rate-limited responses", () => {
    expect(getOtpRetryAfterSeconds({ status: 429, retryAfterSeconds: 74.2 })).toBe(75);
    expect(getOtpRetryAfterSeconds({ code: "OTP_RATE_LIMITED", retryAfterSeconds: 600 })).toBe(600);
  });

  it("falls back to the default cooldown when the delay is missing", () => {
    expect(getOtpRetryAfterSeconds({ status: 429 })).toBe(90);
  });

  it("ignores errors that are not rate limits", () => {
    expect(getOtpRetryAfterSeconds({ status: 400, code: "INVALID_OTP" })).toBeNull();
  });
});
