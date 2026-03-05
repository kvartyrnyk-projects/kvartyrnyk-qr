import postgres from "postgres";
import assert from "node:assert";

assert.ok(
  process.env.DATABASE_URL,
  "DATABASE_URL environment variable is required",
);

const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
});

export { sql };
