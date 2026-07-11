import { apiErrorResponseSchema } from "@link2cv/contracts";
import type { ApiErrorCode } from "@link2cv/contracts";

export class DesktopApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: ApiErrorCode,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "DesktopApiError";
  }

  static async fromResponse(response: Response): Promise<DesktopApiError> {
    const fallbackMessage = `API request failed with status ${response.status}`;

    try {
      const payload: unknown = await response.json();
      const parsed = apiErrorResponseSchema.safeParse(payload);

      if (parsed.success) {
        const { code, error, ...details } = parsed.data;
        return new DesktopApiError(response.status, error, code, details);
      }
    } catch {
      // Proxies and unavailable services may return an empty or non-JSON body.
    }

    return new DesktopApiError(response.status, fallbackMessage);
  }
}

export function isTerminalClaimApiError(error: unknown): error is DesktopApiError {
  return error instanceof DesktopApiError && [400, 401, 403, 404, 409].includes(error.status);
}
