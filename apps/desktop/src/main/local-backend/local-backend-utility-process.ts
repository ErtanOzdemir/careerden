import process from "node:process";
import {
  createLocalApiRuntime,
  describeLocalDatabaseStartupError,
  prepareLocalDataImport,
} from "@careerden/api-app/local";
import { startLocalBackendHost } from "./local-backend-host.js";

const parentPort = process.parentPort;

if (!parentPort) {
  throw new Error("Local backend utility process requires an Electron parent port");
}

startLocalBackendHost(parentPort, createLocalApiRuntime, {
  prepareImport: prepareLocalDataImport,
  describeStartupError: describeLocalDatabaseStartupError,
  // Leaves a turn for the shutdown message to reach the main process before exiting.
  exit: (code) => setImmediate(() => process.exit(code)),
});
