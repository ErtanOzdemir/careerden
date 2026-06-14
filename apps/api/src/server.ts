import { loadEnv } from "@link2cv/config";
import { createApiApp } from "./app.js";

const env = loadEnv();
const app = createApiApp({
  databaseUrl: env.DATABASE_URL,
  linkedInSessionSecret: env.LINKEDIN_SESSION_SECRET,
  linkedInSessionStorageDir: env.LINKEDIN_SESSION_STORAGE_DIR,
  redisUrl: env.REDIS_URL,
  rustFsEndpoint: env.RUSTFS_ENDPOINT,
  rustFsAccessKey: env.RUSTFS_ACCESS_KEY,
  rustFsSecretKey: env.RUSTFS_SECRET_KEY,
  rustFsBucket: env.RUSTFS_BUCKET,
  rustFsRegion: env.RUSTFS_REGION,
  rustFsPublicEndpoint: env.RUSTFS_PUBLIC_ENDPOINT,
});

app.listen(env.PORT, () => {
  console.log(`Link2CV API listening on port ${env.PORT}`);
});
