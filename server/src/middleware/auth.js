import { auth } from "../db/firebase.js";

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
  } catch {
    res.status(401).json({ error: "Invalid or expired Firebase token" });
  }
}

