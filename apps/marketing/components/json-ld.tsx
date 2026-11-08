import { serializeJsonLd, type JsonLdObject } from "@/lib/structured-data";

// JSON-LD is a data block, not executable script, so the marketing CSP's script-src does not
// apply to it and no policy change is needed.
export function JsonLd({ data }: { data: JsonLdObject | readonly JsonLdObject[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
