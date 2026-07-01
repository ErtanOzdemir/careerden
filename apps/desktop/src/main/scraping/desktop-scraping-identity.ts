import { randomUUID } from "node:crypto";

export function getDesktopScrapingClaimOwner(): string {
  return `desktop:${randomUUID()}`;
}
