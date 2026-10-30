import process from "node:process";
import waitOn from "wait-on";

// The local edition starts its own backend, so only the cloud edition waits for the API.
const resources =
  process.env.CAREERDEN_EDITION === "local"
    ? ["http://localhost:5173"]
    : ["http://localhost:3000/health", "http://localhost:5173"];

await waitOn({ resources, timeout: 120_000 });
