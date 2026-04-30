import {
  cancelAppointment,
  createAppointment,
  getAppointmentById,
  getAppointmentMasters,
  getAvailableSlots,
  getTodayAppointments,
  listAppointments,
  updateAppointmentStatus,
  updateAppointment
} from "./appointments.service.js";

export async function listAppointmentsHandler(req, res, next) {
  try {
    res.json({ items: await listAppointments(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function createAppointmentHandler(req, res, next) {
  try {
    const item = await createAppointment(req.body, req.user.sub);
    res.status(201).json({ item, message: "Appointment booked successfully." });
  } catch (error) {
    next(error);
  }
}

export async function getAppointmentHandler(req, res, next) {
  try {
    res.json({ item: await getAppointmentById(req.params.id) });
  } catch (error) {
    next(error);
  }
}

export async function updateAppointmentHandler(req, res, next) {
  try {
    res.json({ item: await updateAppointment(req.params.id, req.body), message: "Appointment updated successfully." });
  } catch (error) {
    next(error);
  }
}

export async function cancelAppointmentHandler(req, res, next) {
  try {
    res.json({ item: await cancelAppointment(req.params.id), message: "Appointment cancelled successfully." });
  } catch (error) {
    next(error);
  }
}

export async function updateAppointmentStatusHandler(req, res, next) {
  try {
    const item = await updateAppointmentStatus(req.params.id, req.body, req.user);
    res.json({ item, message: "Appointment status updated successfully." });
  } catch (error) {
    next(error);
  }
}

export async function todayAppointmentsHandler(_req, res, next) {
  try {
    res.json({ items: await getTodayAppointments() });
  } catch (error) {
    next(error);
  }
}

export async function availableSlotsHandler(req, res, next) {
  try {
    res.json({ items: await getAvailableSlots(req.query.date, req.query.doctorId) });
  } catch (error) {
    next(error);
  }
}

export async function appointmentMastersHandler(_req, res, next) {
  try {
    res.json(await getAppointmentMasters());
  } catch (error) {
    next(error);
  }
}
