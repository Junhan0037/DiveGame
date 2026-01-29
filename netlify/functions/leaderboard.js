// Netlify Function: fetch leaderboard from PostgreSQL
const { Client } = require("pg");

// Build CORS headers based on optional allowed origin
function buildCorsHeaders() {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
}

// Parse leaderboard limit safely
function parseLimit(raw) {
  const limit = Number(raw);
  if (!Number.isFinite(limit)) {
    return 10;
  }
  return Math.min(Math.max(limit, 1), 50);
}

// Create PostgreSQL client with SSL fallback
function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return { error: "DATABASE_URL missing" };
  }

  const sslMode = process.env.PGSSLMODE;
  const useSSL = sslMode !== "disable";

  const client = new Client({
    connectionString,
    ssl: useSSL ? { rejectUnauthorized: false } : false,
  });

  return { client };
}

// Netlify Function entry point
exports.handler = async (event) => {
  const headers = buildCorsHeaders();

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, message: "Method Not Allowed" }) };
  }

  const limit = parseLimit(event.queryStringParameters?.limit);
  const clientResult = createClient();

  if (clientResult.error) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, message: clientResult.error }) };
  }

  const client = clientResult.client;

  try {
    await client.connect();

    const result = await client.query(
      "select name, depth, character, created_at from dive_scores order by depth desc, created_at asc limit $1",
      [limit]
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, data: result.rows }),
    };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, message: "DB error" }) };
  } finally {
    await client.end();
  }
};
