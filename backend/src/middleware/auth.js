import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required." });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    req.user = jwt.verify(token, env.jwtAccessSecret, {
      algorithms: ["HS256"],
      issuer: env.jwtIssuer,
      audience: env.jwtAudience
    });
    if (req.user.type !== "access" || !req.user.sub) {
      return res.status(401).json({ message: "Invalid or expired token." });
    }
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}
