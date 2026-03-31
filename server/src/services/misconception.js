// import { pool } from "../db/client.js";

/**
 * Return the top N concepts where the user has the weakest understanding,
 * ordered by weight descending (higher weight = more confused).
 *
 * @param {string} userId
 * @param {number} limit
 * @returns {Promise<Array<{ concept: string, weight: number }>>}
 */
export async function getRecommendations(userId, limit = 5) {
  // TODO:
  // const { rows } = await pool.query(
  //   `SELECT concept, weight FROM misconceptions
  //    WHERE user_id = $1 ORDER BY weight DESC LIMIT $2`,
  //   [userId, limit]
  // );
  // return rows;
  throw new Error("getRecommendations: not implemented");
}

/**
 * Update the misconception weight for a concept after a user interaction.
 * Decreases weight on correct answer, increases on incorrect.
 *
 * @param {string}  userId
 * @param {string}  concept
 * @param {boolean} correct - Whether the user answered correctly
 */
export async function recordInteraction(userId, concept, correct) {
  const delta = correct ? -0.2 : 0.3;

  // TODO:
  // await pool.query(
  //   `INSERT INTO misconceptions (user_id, concept, weight)
  //    VALUES ($1, $2, $3)
  //    ON CONFLICT (user_id, concept)
  //    DO UPDATE SET
  //      weight = GREATEST(0, misconceptions.weight + $4),
  //      updated_at = NOW()`,
  //   [userId, concept, 1.0 + delta, delta]
  // );
  throw new Error("recordInteraction: not implemented");
}
