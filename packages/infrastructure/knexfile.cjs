require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

module.exports = {
  client: "pg",
  connection: process.env.DATABASE_URL,
  migrations: {
    directory: "./src/persistence/postgres-migrations",
    extension: "cjs",
    loadExtensions: [".cjs"],
  },
};
