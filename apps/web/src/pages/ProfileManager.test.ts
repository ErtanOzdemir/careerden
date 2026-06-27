import { describe, expect, it } from "vitest";
import { toProfileDetailsPayload } from "./ProfileManager";

describe("ProfileManager", () => {
  it("saves the profile description as the profile summary", () => {
    expect(
      toProfileDetailsPayload({
        email: " ada@example.com ",
        fullName: " Ada Lovelace ",
        links: [" https://example.com ", ""],
        location: " Remote ",
        profession: " Engineer ",
        summary: " Builds CV-focused product systems. ",
      }),
    ).toEqual({
      email: "ada@example.com",
      fullName: "Ada Lovelace",
      links: ["https://example.com"],
      location: "Remote",
      profession: "Engineer",
      summary: "Builds CV-focused product systems.",
    });
  });
});
