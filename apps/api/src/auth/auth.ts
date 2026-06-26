import { betterAuth } from "better-auth";
import { Pool } from "pg";

export interface AuthConfig {
  baseUrl: string;
  databaseUrl: string;
  secret: string;
  trustedOrigins: string[];
}

export function createAuth(config: AuthConfig) {
  return betterAuth({
    baseURL: config.baseUrl,
    basePath: "/auth",
    secret: config.secret,
    trustedOrigins: config.trustedOrigins,
    database: new Pool({
      connectionString: config.databaseUrl,
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
    },
  });
}

export type Link2CvAuth = ReturnType<typeof createAuth>;
