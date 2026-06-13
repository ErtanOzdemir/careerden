import { loadEnv } from "@link2cv/config";
import { createApiApp } from "./app.js";

const env = loadEnv();
const app = createApiApp({
  databaseUrl: env.DATABASE_URL,
  linkedInSessionSecret: env.LINKEDIN_SESSION_SECRET,
  linkedInSessionStorageDir: env.LINKEDIN_SESSION_STORAGE_DIR,
  redisUrl: env.REDIS_URL,
  storageDir: env.FILE_STORAGE_DIR
});

app.listen(env.PORT, () => {
  console.log(`Link2CV API listening on port ${env.PORT}`);
});
