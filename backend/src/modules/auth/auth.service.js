import jwt from "jsonwebtoken";
import crypto from "crypto";

import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { createError } from "../../utils/errors.js";
import { findUserByEmail, hashPasswordForStorage, updateUserPasswordHash, updateUserRecord, verifyPassword } from "../users/users.repository.js";
import {
  createRefreshSession,
  deleteExpiredRefreshSessions,
  revokeRefreshSession,
  rotateRefreshSession
} from "./auth.repository.js";

const resetOtpStore = new Map();

function sanitizeUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      type: "access"
    },
    env.jwtAccessSecret,
    { algorithm: "HS256", expiresIn: env.jwtAccessExpires, issuer: env.jwtIssuer, audience: env.jwtAudience }
  );
}

function createRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      type: "refresh",
      jti: crypto.randomUUID()
    },
    env.jwtRefreshSecret,
    { algorithm: "HS256", expiresIn: env.jwtRefreshExpires, issuer: env.jwtIssuer, audience: env.jwtAudience }
  );
}

function tokenExpiry(token) {
  const decoded = jwt.decode(token);
  return new Date(Number(decoded?.exp || 0) * 1000);
}

export async function issueTokens({ email, password }) {
  let user;

  try {
    user = await findUserByEmail(email);
  } catch (error) {
    const databaseErrorCodes = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "28P01", "3D000", "42P01"]);
    if (databaseErrorCodes.has(error.code)) {
      throw createError("Database is not ready for login. Verify the PostgreSQL environment variables, run migrations, and seed users.", 503);
    }

    throw error;
  }

  if (!user || !(await verifyPassword(user, password))) {
    throw createError("Invalid email or password.", 401);
  }

  if (user.passwordHash?.startsWith("seed-sha256:")) {
    await updateUserPasswordHash(user.id, await hashPasswordForStorage(user.email, password));
  }

  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  await createRefreshSession({ userId: user.id, token: refreshToken, expiresAt: tokenExpiry(refreshToken) });
  deleteExpiredRefreshSessions().catch((error) => {
    logger.error(`Refresh-session cleanup failed: ${error.message}`);
  });

  return {
    accessToken,
    refreshToken,
    refreshExpiresAt: tokenExpiry(refreshToken),
    user: sanitizeUser(user)
  };
}

export async function refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    throw createError("Refresh token is required.", 401);
  }

  let payload;

  try {
    payload = jwt.verify(refreshToken, env.jwtRefreshSecret, {
      algorithms: ["HS256"],
      issuer: env.jwtIssuer,
      audience: env.jwtAudience
    });
  } catch {
    throw createError("Invalid or expired refresh token.", 401);
  }
  if (payload.type !== "refresh" || !payload.sub) {
    throw createError("Invalid refresh token.", 401);
  }
  const user = await findUserByEmail(payload.email);

  if (!user || user.id !== payload.sub || user.isActive === false) {
    throw createError("Refresh token is not active.", 401);
  }

  const nextRefreshToken = createRefreshToken(user);
  const rotated = await rotateRefreshSession({
    currentToken: refreshToken,
    userId: user.id,
    nextToken: nextRefreshToken,
    nextExpiresAt: tokenExpiry(nextRefreshToken)
  });

  if (!rotated) {
    throw createError("Refresh token is not active.", 401);
  }

  return {
    accessToken: createAccessToken(user),
    refreshToken: nextRefreshToken,
    refreshExpiresAt: tokenExpiry(nextRefreshToken),
    user: sanitizeUser(user)
  };
}

export async function logoutUser(refreshToken) {
  await revokeRefreshSession(refreshToken);
}

export async function getCurrentUser(email) {
  const user = await findUserByEmail(email);

  if (!user) {
    throw createError("User not found.", 404);
  }

  return sanitizeUser(user);
}

export async function requestPasswordReset(email) {
  if (env.otpDeliveryMode === "disabled") {
    return { message: "If the account exists, contact an administrator to reset the password." };
  }

  const user = await findUserByEmail(email);

  if (!user) {
    return { message: "If the account exists, an OTP reset flow has been initiated." };
  }

  const otp = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = Date.now() + Math.max(env.otpTtlMinutes, 1) * 60 * 1000;
  resetOtpStore.set(user.email, { otp, expiresAt });
  await deliverResetOtp(user, otp);

  return {
    message: env.otpDeliveryMode === "dev"
      ? "OTP generated in development mode. Check backend logs."
      : "If the account exists, an OTP reset flow has been initiated."
  };
}

export async function resetPassword({ email, otp, newPassword }) {
  const expectedOtp = resetOtpStore.get(email);

  if (!expectedOtp || expectedOtp.otp !== otp || expectedOtp.expiresAt < Date.now()) {
    throw createError("Invalid OTP.", 400);
  }

  const user = await findUserByEmail(email);

  if (!user) {
    throw createError("User not found.", 404);
  }

  await updateUserRecord(user.id, { email: user.email, password: newPassword });
  resetOtpStore.delete(email);

  return { message: "Password updated successfully." };
}

async function deliverResetOtp(user, otp) {
  if (env.otpDeliveryMode === "dev") {
    logger.info(`Password reset OTP for ${user.email}: ${otp}`);
    return;
  }

  throw createError("Password-reset delivery is not configured. Contact an administrator.", 503);
}

export async function changePassword(email, payload) {
  const user = await findUserByEmail(email);

  if (!user) {
    throw createError("User not found.", 404);
  }

  if (!(await verifyPassword(user, payload.currentPassword))) {
    throw createError("Current password is incorrect.", 400);
  }

  await updateUserRecord(user.id, { email: user.email, password: payload.newPassword });
  return { message: "Password changed successfully." };
}
