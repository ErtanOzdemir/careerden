import opentelemetry from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { ApiEnv } from "./env.js";
import { RedisInstrumentation } from "@opentelemetry/instrumentation-redis";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";

export function setupTracing(env: ApiEnv) {
  const sdk = new opentelemetry.NodeSDK({
    traceExporter: new OTLPTraceExporter({
      url: env.OPEN_OBSERVE_URL,
      headers: {
        Authorization: `Basic ${env.OPEN_OBSERVE_KEY}`,
      },
    }),
    instrumentations: [
      getNodeAutoInstrumentations(),
      new PgInstrumentation(),
      new RedisInstrumentation(),
    ],
    serviceName: "link2cv-api",
  });

  sdk.start();
}
