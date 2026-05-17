import {
  createCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent
} from "./calendar.service.js";

export async function listCalendarEventsHandler(req, res, next) {
  try {
    res.json({ items: await listCalendarEvents(req.query) });
  } catch (error) {
    next(error);
  }
}

export async function createCalendarEventHandler(req, res, next) {
  try {
    const event = await createCalendarEvent(req.body, req.user.sub);
    res.status(201).json({ item: event, message: "Calendar event scheduled successfully." });
  } catch (error) {
    next(error);
  }
}

export async function updateCalendarEventHandler(req, res, next) {
  try {
    res.json({ item: await updateCalendarEvent(req.params.id, req.body), message: "Calendar event updated successfully." });
  } catch (error) {
    next(error);
  }
}

export async function deleteCalendarEventHandler(req, res, next) {
  try {
    res.json({ item: await deleteCalendarEvent(req.params.id), message: "Calendar event removed successfully." });
  } catch (error) {
    next(error);
  }
}
