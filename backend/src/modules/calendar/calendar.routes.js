import { Router } from "express";

import { authorize, authorizeRolesOnly } from "../../middleware/rbac.js";
import {
  createCalendarEventHandler,
  deleteCalendarEventHandler,
  listCalendarEventsHandler,
  updateCalendarEventHandler
} from "./calendar.controller.js";

const calendarRouter = Router();
const calendarRoles = ["admin", "reception", "doctor", "nursing", "lab", "therapist", "pharmacy", "accounts", "hr"];

calendarRouter.get("/events", authorize(calendarRoles), listCalendarEventsHandler);
calendarRouter.post("/events", authorizeRolesOnly(calendarRoles), createCalendarEventHandler);
calendarRouter.put("/events/:id", authorizeRolesOnly(calendarRoles), updateCalendarEventHandler);
calendarRouter.delete("/events/:id", authorizeRolesOnly(["admin", "reception", "doctor", "hr"]), deleteCalendarEventHandler);

export { calendarRouter };
