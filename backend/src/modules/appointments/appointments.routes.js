import { Router } from "express";

import { authorize, authorizeRolesOnly } from "../../middleware/rbac.js";
import {
  appointmentMastersHandler,
  availableSlotsHandler,
  cancelAppointmentHandler,
  createAppointmentHandler,
  getAppointmentHandler,
  listAppointmentsHandler,
  updateAppointmentQueueActionHandler,
  todayAppointmentsHandler,
  updateAppointmentStatusHandler,
  updateAppointmentHandler
} from "./appointments.controller.js";

const appointmentsRouter = Router();

appointmentsRouter.get("/", authorize(["admin", "reception", "doctor"]), listAppointmentsHandler);
appointmentsRouter.post("/", authorizeRolesOnly(["admin", "reception", "doctor"]), createAppointmentHandler);
appointmentsRouter.get("/today", authorize(["admin", "reception", "doctor"]), todayAppointmentsHandler);
appointmentsRouter.get("/available-slots", authorize(["admin", "reception", "doctor"]), availableSlotsHandler);
appointmentsRouter.get("/masters", authorize(["admin", "reception", "doctor"]), appointmentMastersHandler);
appointmentsRouter.get("/:id", authorize(["admin", "reception", "doctor"]), getAppointmentHandler);
appointmentsRouter.put("/:id", authorizeRolesOnly(["admin", "reception", "doctor"]), updateAppointmentHandler);
appointmentsRouter.put("/:id/status", authorizeRolesOnly(["admin", "reception", "doctor"]), updateAppointmentStatusHandler);
appointmentsRouter.put("/:id/queue-action", authorizeRolesOnly(["admin", "reception", "doctor"]), updateAppointmentQueueActionHandler);
appointmentsRouter.delete("/:id", authorizeRolesOnly(["admin", "reception", "doctor"]), cancelAppointmentHandler);

export { appointmentsRouter };
