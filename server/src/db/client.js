// TODO: install pg — npm install pg
// import pg from "pg";
// import { env } from "../env.js";

// const { Pool } = pg;

/**
 * Shared PostgreSQL connection pool.
 * All services should import this pool rather than creating their own connections.
 *
 * Usage:
 *   import { pool } from "../db/client.js";
 *   const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
 */

// export const pool = new Pool({ connectionString: env.databaseUrl });

// Stub export so imports don't break before pg is installed
export const pool = null; // TODO: replace with real Pool once pg is added
