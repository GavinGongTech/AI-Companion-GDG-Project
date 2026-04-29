import { Request, Response, NextFunction } from "express";
import { auth } from "../db/firebase";
import { logger } from "../logger";
import { sendError } from "../http/responses";
import { DecodedIdToken } from "firebase-admin/auth";

declare global {
  namespace Express {
    interface Request {
      user?: DecodedIdToken;
    }
  }
}

/**
 * Middleware that verifies a Firebase ID token from the Authorization header.
 * Attaches the decoded token (uid, email, name, etc.) to req.user.
 * Responds 401 if the token is missing or invalid.
 */
export async function requireFirebaseAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return sendError(res, 401, "Missing auth token");
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    req.user = decoded; // { uid, email, name, picture, ... }
    next();
  } catch (err: any) {
    logger.warn({ code: err?.code, msg: err?.message }, "Firebase token verification failed");
    if (err?.code === "auth/user-disabled") {
      return sendError(res, 403, "Account disabled. Please contact support.");
    }
    if (err?.code === "auth/argument-error") {
      return sendError(res, 400, "Malformed authorization token.");
    }
    if (!err?.code || !err.code.startsWith("auth/")) {
      return sendError(res, 503, "Authentication service temporarily unavailable.");
    }
    return sendError(res, 401, "Invalid or expired auth token. Please sign in again.");
  }
}
