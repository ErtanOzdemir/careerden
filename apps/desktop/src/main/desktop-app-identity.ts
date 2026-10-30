import type { DesktopEdition } from "./desktop-runtime-config.js";

export interface DesktopAppIdentity {
  id: string;
  name: string;
}

// Each edition installs as its own app, so their data, keychain entries, and updates never mix.
const identities: Record<DesktopEdition, DesktopAppIdentity> = {
  cloud: { id: "com.careerden.desktop", name: "Careerden" },
  local: { id: "com.careerden.unplugged", name: "Careerden Unplugged" },
};

export function getDesktopAppIdentity(edition: DesktopEdition): DesktopAppIdentity {
  return identities[edition];
}
