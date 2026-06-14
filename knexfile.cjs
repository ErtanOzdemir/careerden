const { join } = require("node:path");

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://link2cv:link2cv@localhost:5432/link2cv";

module.exports = {
  client: "pg",
  connection: databaseUrl,
  migrations: {
    directory: join(__dirname, "packages/infrastructure/src/db/migrations"),
    extension: "cjs",
    loadExtensions: [".cjs"],
  },
};

