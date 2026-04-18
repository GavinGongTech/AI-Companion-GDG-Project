import { auth } from "../db/firebase.js";
import { logger } from "../logger.js";

/**
 * Middleware that verifies a Firebase ID token from the Authorization header.
 * Attaches the decoded token (uid, email, name, etc.) to req.user.
 * Responds 401 if the token is missing or invalid.
 */
export async function requireFirebaseAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    req.user = decoded; // { uid, email, name, picture, ... }
    next();
  } catch (err) {
    logger.warn({ code: err?.code, msg: err?.message }, "Firebase token verification failed");
    if (err?.code === "auth/user-disabled") {
      return res.status(403).json({ error: "Account disabled. Please contact support." });
    }
    if (err?.code === "auth/argument-error") {
      return res.status(400).json({ error: "Malformed authorization token." });
    }
    if (!err?.code || !err.code.startsWith("auth/")) {
      return res.status(503).json({ error: "Authentication service temporarily unavailable." });
    }
    return res.status(401).json({ error: "Invalid or expired auth token. Please sign in again." });
  }
}

