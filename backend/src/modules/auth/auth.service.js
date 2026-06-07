import jwt from "jsonwebtoken";
import crypto from "crypto";

import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { createError } from "../../utils/errors.js";
import { findUserByEmail, hashPasswordForStorage, updateUserPasswordHash, updateUserRecord, verifyPassword } from "../users/users.repository.js";

const refreshStore = new Map();
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
      fullName: user.fullName
    },
    env.jwtAccessSecret,
    { expiresIn: env.jwtAccessExpires }
  );
}

function createRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      type: "refresh"
    },
    env.jwtRefreshSecret,
    { expiresIn: env.jwtRefreshExpires }
  );
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

  refreshStore.set(refreshToken, user.email);

  return {
    accessToken,
    refreshToken,
    user: sanitizeUser(user)
  };
}

export async function refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    throw createError("Refresh token is required.", 401);
  }

  if (!refreshStore.has(refreshToken)) {
    throw createError("Refresh token is not active.", 401);
  }

  const payload = jwt.verify(refreshToken, env.jwtRefreshSecret);
  const user = await findUserByEmail(payload.email);

  if (!user) {
    throw createError("User no longer exists.", 404);
  }

  return { accessToken: createAccessToken(user) };
}

export function logoutUser(refreshToken) {
  if (refreshToken) {
    refreshStore.delete(refreshToken);
  }
}

export async function getCurrentUser(email) {
  const user = await findUserByEmail(email);

  if (!user) {
    throw createError("User not found.", 404);
  }

  return sanitizeUser(user);
}

export async function requestPasswordReset(email) {
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

  if (["email", "email_sms"].includes(env.otpDeliveryMode)) {
    logger.info(`Email OTP requested for ${user.email}. Configure SMTP integration to send it.`);
  }

  if (["sms", "email_sms"].includes(env.otpDeliveryMode)) {
    logger.info(`SMS OTP requested for ${user.phone || user.email}. Configure SMS_PROVIDER_URL/SMS_PROVIDER_TOKEN to send it.`);
  }
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
