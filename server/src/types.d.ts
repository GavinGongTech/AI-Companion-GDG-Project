import { type DecodedIdToken } from "firebase-admin/auth";

declare global {
  namespace Express {
    interface Request {
      user?: DecodedIdToken & {
        name?: string;
        email?: string;
      };
    }
  }
}
