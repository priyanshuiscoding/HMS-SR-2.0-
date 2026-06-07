import { Router } from "express";

import { authenticate } from "../../middleware/auth.js";
import { auditWrites } from "../../middleware/audit.js";
import { rateLimit } from "../../middleware/security.js";
import { validateBody, validators } from "../../middleware/validate.js";
import {
  changePasswordHandler,
  forgotPasswordHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  resetPasswordHandler
} from "./auth.controller.js";

const authRouter = Router();

authRouter.post(
  "/login",
  rateLimit({ keyPrefix: "login", max: 10 }),
  validateBody({
    email: [validators.required("Email"), validators.email()],
    password: [validators.required("Password")]
  }),
  loginHandler
);
authRouter.post("/logout", logoutHandler);
authRouter.post("/refresh", refreshHandler);
authRouter.post(
  "/forgot-password",
  rateLimit({ keyPrefix: "forgot-password", max: 5 }),
  validateBody({
    email: [validators.required("Email"), validators.email()]
  }),
  forgotPasswordHandler
);
authRouter.post(
  "/reset-password",
  rateLimit({ keyPrefix: "reset-password", max: 8 }),
  validateBody({
    email: [validators.required("Email"), validators.email()],
    otp: [validators.required("OTP"), validators.minLength("OTP", 6)],
    newPassword: [validators.required("New password"), validators.minLength("New password", 8)]
  }),
  resetPasswordHandler
);
authRouter.put(
  "/change-password",
  authenticate,
  auditWrites,
  validateBody({
    currentPassword: [validators.required("Current password")],
    newPassword: [validators.required("New password"), validators.minLength("New password", 8)]
  }),
  changePasswordHandler
);
authRouter.get("/me", authenticate, meHandler);

export { authRouter };
