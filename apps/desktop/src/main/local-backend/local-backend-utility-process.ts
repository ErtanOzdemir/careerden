import process from "node:process";
import { createLocalApiRuntime, prepareLocalDataImport } from "@careerden/api-app/local";
import { startLocalBackendHost } from "./local-backend-host.js";

const parentPort = process.parentPort;

if (!parentPort) {
  throw new Error("Local backend utility process requires an Electron parent port");
}

startLocalBackendHost(parentPort, createLocalApiRuntime, {
  prepareImport: prepareLocalDataImport,
});
