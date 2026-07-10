import { Router } from "express";

import { authorize } from "../../middleware/rbac.js";
import { validateBody, validateParams, validators } from "../../middleware/validate.js";
import {
  createUserHandler,
  deleteUserHandler,
  departmentsListHandler,
  doctorsListHandler,
  moduleCatalogHandler,
  therapistsListHandler,
  updateModuleAccessHandler,
  updateUserHandler,
  userDetailsHandler,
  usersListHandler,
  usersSummaryHandler
} from "./users.controller.js";

const usersRouter = Router();
const userRoles = ["admin", "reception", "doctor", "pharmacy", "lab", "therapist", "nursing", "housekeeping", "accounts", "hr"];
const userIdParam = validateParams({ id: [validators.required("User ID"), validators.uuid("User ID")] });
const userCreateSchema = {
  employeeId: [validators.required("Employee ID")],
  fullName: [validators.required("Full name"), validators.minLength("Full name", 2)],
  email: [validators.required("Email"), validators.email()],
  password: [validators.optional(validators.minLength("Password", 8))],
  role: [validators.required("Role"), validators.oneOf("Role", userRoles)],
  department: [validators.required("Department")]
};
const userUpdateSchema = {
  email: [validators.optional(validators.email())],
  password: [validators.optional(validators.minLength("Password", 8))],
  role: [validators.optional(validators.oneOf("Role", userRoles))]
};

usersRouter.get("/", authorize(["admin", "hr"]), usersListHandler);
usersRouter.post("/", authorize(["admin"]), validateBody(userCreateSchema), createUserHandler);
usersRouter.get("/summary", authorize(["admin", "hr"]), usersSummaryHandler);
usersRouter.get("/module-catalog", authorize(["admin"]), moduleCatalogHandler);
usersRouter.put("/:id/module-access", authorize(["admin"]), userIdParam, updateModuleAccessHandler);
usersRouter.get("/doctors", authorize(["admin", "reception", "doctor"]), doctorsListHandler);
usersRouter.get("/therapists", authorize(["admin", "reception", "doctor"]), therapistsListHandler);
usersRouter.get("/departments", authorize(["admin", "reception", "doctor", "hr"]), departmentsListHandler);
usersRouter.get("/:id", authorize(["admin", "hr"]), userIdParam, userDetailsHandler);
usersRouter.put("/:id", authorize(["admin"]), userIdParam, validateBody(userUpdateSchema), updateUserHandler);
usersRouter.delete("/:id", authorize(["admin"]), userIdParam, deleteUserHandler);

export { usersRouter };
