import { env } from "../../config/env.js";
import {
  changePassword,
  getCurrentUser,
  issueTokens,
  logoutUser,
  refreshAccessToken,
  requestPasswordReset,
  resetPassword
} from "./auth.service.js";

function refreshCookieOptions(req, expiresAt) {
  const secure = env.cookieSecure || req.secure;
  return {
    httpOnly: true,
    sameSite: env.cookieSameSite,
    secure,
    path: "/api/v1/auth",
    ...(expiresAt ? { expires: new Date(expiresAt) } : {})
  };
}

function publicAuthResult(result) {
  const { refreshToken: _refreshToken, refreshExpiresAt: _refreshExpiresAt, ...publicResult } = result;
  return publicResult;
}

export async function loginHandler(req, res, next) {
  try {
    const result = await issueTokens(req.body);
    res.cookie("refreshToken", result.refreshToken, refreshCookieOptions(req, result.refreshExpiresAt));

    res.json(publicAuthResult(result));
  } catch (error) {
    next(error);
  }
}

export async function logoutHandler(req, res, next) {
  try {
    await logoutUser(req.cookies.refreshToken);
    res.clearCookie("refreshToken", refreshCookieOptions(req));
    res.json({ message: "Logged out successfully." });
  } catch (error) {
    next(error);
  }
}

export async function refreshHandler(req, res, next) {
  try {
    const result = await refreshAccessToken(req.cookies.refreshToken);
    res.cookie("refreshToken", result.refreshToken, refreshCookieOptions(req, result.refreshExpiresAt));
    res.json(publicAuthResult(result));
  } catch (error) {
    next(error);
  }
}

export async function meHandler(req, res, next) {
  try {
    res.json({ user: await getCurrentUser(req.user.email) });
  } catch (error) {
    next(error);
  }
}

export async function forgotPasswordHandler(req, res, next) {
  try {
    res.json(await requestPasswordReset(req.body.email));
  } catch (error) {
    next(error);
  }
}

export async function resetPasswordHandler(req, res, next) {
  try {
    res.json(await resetPassword(req.body));
  } catch (error) {
    next(error);
  }
}

export async function changePasswordHandler(req, res, next) {
  try {
    res.json(await changePassword(req.user.email, req.body));
  } catch (error) {
    next(error);
  }
}
