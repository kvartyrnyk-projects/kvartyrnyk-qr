import assert from "node:assert";

assert.ok(process.env.BOT_TOKEN, "BOT_TOKEN environment variable is required");
export const botToken = process.env.BOT_TOKEN;
