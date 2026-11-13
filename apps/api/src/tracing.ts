import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import type { ApiEnv } from "./env.js";

export function setupTracing(env: ApiEnv) {
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({
      url: env.OPEN_OBSERVE_URL,
      headers: {
        Authorization: `Basic ${env.OPEN_OBSERVE_KEY}`,
      },
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-express": { enabled: true },
      }),
    ],
    serviceName: "careerden-api",
  });

  sdk.start();
}
