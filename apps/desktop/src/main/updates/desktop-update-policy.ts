import { lt, valid } from "semver";
import { z } from "zod";

export const desktopUpdatePolicySchema = z.object({
  schemaVersion: z.literal(1),
  minimumSupportedVersion: z
    .string()
    .refine((version) => valid(version) !== null, "Must be a valid semantic version"),
});

export type DesktopUpdatePolicy = z.infer<typeof desktopUpdatePolicySchema>;

export function parseDesktopUpdatePolicy(value: unknown): DesktopUpdatePolicy {
  return desktopUpdatePolicySchema.parse(value);
}

export function isDesktopUpdateRequired(
  currentVersion: string,
  policy: DesktopUpdatePolicy | undefined,
): boolean {
  return policy ? lt(currentVersion, policy.minimumSupportedVersion) : false;
}
