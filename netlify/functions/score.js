// Netlify Function: store score to PostgreSQL
const { Client } = require("pg");

// Build CORS headers based on optional allowed origin
function buildCorsHeaders() {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}

// Parse JSON payload safely
function parsePayload(body) {
  if (!body) {
    return { error: "empty body" };
  }

  try {
    return { data: JSON.parse(body) };
  } catch (error) {
    return { error: "invalid json" };
  }
}

// Validate incoming score fields
function validatePayload(payload) {
  const name = (payload.name || "").trim().slice(0, 20);
  const phone = (payload.phone || "").trim().slice(0, 20);
  const depth = Number(payload.depth);
  const character = payload.character;

  if (!name) {
    return { error: "name required" };
  }
  if (!phone || !/^[0-9-]+$/.test(phone)) {
    return { error: "phone invalid" };
  }
  if (!Number.isFinite(depth) || depth <= 0 || depth > 9999) {
    return { error: "depth invalid" };
  }
  if (character !== "longfin" && character !== "shortfin") {
    return { error: "character invalid" };
  }

  return {
    data: {
      name,
      phone,
      depth: Number(depth.toFixed(2)),
      character,
    },
  };
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

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, message: "Method Not Allowed" }) };
  }

  const parsed = parsePayload(event.body);
  if (parsed.error) {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, message: parsed.error }) };
  }

  const validation = validatePayload(parsed.data);
  if (validation.error) {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, message: validation.error }) };
  }

  const clientResult = createClient();
  if (clientResult.error) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, message: clientResult.error }) };
  }

  const client = clientResult.client;

  try {
    await client.connect();

    const result = await client.query(
      "insert into dive_scores (name, phone, depth, character) values ($1, $2, $3, $4) returning id, created_at",
      [validation.data.name, validation.data.phone, validation.data.depth, validation.data.character]
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        id: result.rows[0]?.id,
        created_at: result.rows[0]?.created_at,
      }),
    };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, message: "DB error" }) };
  } finally {
    await client.end();
  }
};
