import { Router } from "express";

import { authorize } from "../../middleware/rbac.js";
import {
  createCalendarEventHandler,
  deleteCalendarEventHandler,
  listCalendarEventsHandler,
  updateCalendarEventHandler
} from "./calendar.controller.js";

const calendarRouter = Router();
const calendarRoles = ["admin", "reception", "doctor", "nursing", "lab", "therapist", "pharmacy", "accounts", "hr"];

calendarRouter.get("/events", authorize(calendarRoles), listCalendarEventsHandler);
calendarRouter.post("/events", authorize(calendarRoles), createCalendarEventHandler);
calendarRouter.put("/events/:id", authorize(calendarRoles), updateCalendarEventHandler);
calendarRouter.delete("/events/:id", authorize(["admin", "reception", "doctor", "hr"]), deleteCalendarEventHandler);

export { calendarRouter };
