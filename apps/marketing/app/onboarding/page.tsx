import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "How Link2CV Works",
  description:
    "See how Link2CV turns each captured opportunity into a trackable application record and reviewable document pack.",
  path: "/onboarding",
  index: false,
});

export default function OnboardingPage() {
  redirect("/#how-it-works");
}
