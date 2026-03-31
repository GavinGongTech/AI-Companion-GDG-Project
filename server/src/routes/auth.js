import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

// TODO: implement with bcryptjs for password hashing and jsonwebtoken for sessions

export const authRouter = Router();

authRouter.post("/register", async (req, res, next) => {
  try {
    // TODO: validate body, hash password, INSERT user, return JWT
    res.status(501).json({ todo: true, message: "register not implemented" });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    // TODO: find user by email, compare bcrypt hash, sign JWT, set cookie
    res.status(501).json({ todo: true, message: "login not implemented" });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", (req, res) => {
  // TODO: clear session cookie / invalidate token
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    // TODO: return req.user fetched from DB
    res.status(501).json({ todo: true, message: "me not implemented" });
  } catch (err) {
    next(err);
  }
});
