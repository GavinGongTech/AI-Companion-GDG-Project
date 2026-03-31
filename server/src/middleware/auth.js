// TODO: implement with jsonwebtoken
// import jwt from "jsonwebtoken";
// import { env } from "../env.js";

/**
 * Middleware that verifies the Bearer JWT and attaches the decoded user to req.user.
 * Responds 401 if the token is missing or invalid.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  // TODO: replace stub with real verification
  // try {
  //   req.user = jwt.verify(token, env.jwtSecret);
  //   next();
  // } catch {
  //   res.status(401).json({ error: "Invalid or expired token" });
  // }

  // Stub: pass through with placeholder user
  req.user = { id: "stub", email: "stub@example.com" };
  next();
}
