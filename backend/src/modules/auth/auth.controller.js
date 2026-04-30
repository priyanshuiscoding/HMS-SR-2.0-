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

export async function loginHandler(req, res, next) {
  try {
    const result = await issueTokens(req.body);
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      sameSite: env.cookieSecure || req.secure ? "none" : "lax",
      secure: env.cookieSecure || req.secure
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export function logoutHandler(req, res, next) {
  try {
    logoutUser(req.cookies.refreshToken);
    res.clearCookie("refreshToken");
    res.json({ message: "Logged out successfully." });
  } catch (error) {
    next(error);
  }
}

export async function refreshHandler(req, res, next) {
  try {
    const result = await refreshAccessToken(req.cookies.refreshToken);
    res.json(result);
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
