import fs from "node:fs/promises";
import process from "node:process";
import pg from "pg";

const { Client } = pg;

async function loadLocalEnv() {
  try {
    const env = await fs.readFile(new URL("../.env.local", import.meta.url), "utf8");

    for (const line of env.split("\n")) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const [key, ...valueParts] = trimmed.split("=");
      process.env[key] ??= valueParts.join("=");
    }
  } catch {
    // .env.local is optional; production can provide real environment variables.
  }
}

await loadLocalEnv();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const schema = await fs.readFile(new URL("./schema.sql", import.meta.url), "utf8");
const appDatabaseUrl = new URL(connectionString);
const databaseName = appDatabaseUrl.pathname.slice(1);

if (!databaseName) {
  console.error("DATABASE_URL must include a database name.");
  process.exit(1);
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function ensureDatabaseExists() {
  const adminUrl = new URL(connectionString);
  adminUrl.pathname = "/postgres";
  const adminClient = new Client({ connectionString: adminUrl.toString() });

  try {
    await adminClient.connect();

    const result = await adminClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);

    if (result.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
      console.log(`Created database ${databaseName}.`);
    }
  } finally {
    await adminClient.end();
  }
}

await ensureDatabaseExists();

const client = new Client({ connectionString });

try {
  await client.connect();
  await client.query(schema);
  const { rows } = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM projects) AS projects,
      (SELECT COUNT(*)::int FROM tasks) AS tasks
  `);

  console.log("Database schema initialized.");
  console.log(`Seeded ${rows[0].users} users, ${rows[0].projects} projects, and ${rows[0].tasks} tasks.`);
  console.log("Demo admin login: admin@example.com / Password123!");
} finally {
  await client.end();
}
