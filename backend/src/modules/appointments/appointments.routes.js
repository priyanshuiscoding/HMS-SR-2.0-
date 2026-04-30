import { Router } from "express";

import { authorize } from "../../middleware/rbac.js";
import {
  appointmentMastersHandler,
  availableSlotsHandler,
  cancelAppointmentHandler,
  createAppointmentHandler,
  getAppointmentHandler,
  listAppointmentsHandler,
  todayAppointmentsHandler,
  updateAppointmentStatusHandler,
  updateAppointmentHandler
} from "./appointments.controller.js";

const appointmentsRouter = Router();

appointmentsRouter.get("/", authorize(["admin", "reception", "doctor"]), listAppointmentsHandler);
appointmentsRouter.post("/", authorize(["admin", "reception"]), createAppointmentHandler);
appointmentsRouter.get("/today", authorize(["admin", "reception", "doctor"]), todayAppointmentsHandler);
appointmentsRouter.get("/available-slots", authorize(["admin", "reception", "doctor"]), availableSlotsHandler);
appointmentsRouter.get("/masters", authorize(["admin", "reception", "doctor"]), appointmentMastersHandler);
appointmentsRouter.get("/:id", authorize(["admin", "reception", "doctor"]), getAppointmentHandler);
appointmentsRouter.put("/:id", authorize(["admin", "reception"]), updateAppointmentHandler);
appointmentsRouter.put("/:id/status", authorize(["admin", "reception", "doctor"]), updateAppointmentStatusHandler);
appointmentsRouter.delete("/:id", authorize(["admin", "reception"]), cancelAppointmentHandler);

export { appointmentsRouter };
