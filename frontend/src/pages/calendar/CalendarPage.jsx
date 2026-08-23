import { useEffect, useMemo, useState } from "react";
import { Link } from "../../router.jsx";

import { Button } from "../../components/common/Button.jsx";
import { SearchableSelect } from "../../components/common/SearchableSelect.jsx";
import { DashboardLayout } from "../../components/layout/DashboardLayout.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvents,
  getPatients,
  getUsers,
  updateCalendarEvent
} from "../../services/api.js";

const eventTypes = [
  ["general", "General"],
  ["follow_up", "Follow-up"],
  ["meeting", "Meeting"],
  ["task", "Task"],
  ["reminder", "Reminder"],
  ["lab", "Lab"],
  ["panchkarma", "Panchkarma"],
  ["ipd", "IPD"],
  ["maintenance", "Maintenance"]
];

const initialForm = {
  id: "",
  title: "",
  description: "",
  eventType: "general",
  startsAt: "",
  endsAt: "",
  allDay: false,
  location: "",
  patientId: "",
  assignedTo: "",
  reminderMinutes: "30",
  status: "scheduled"
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function toDateInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toLocalDateTimeInput(date) {
  return `${toDateInput(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function monthRange(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { dateFrom: toDateInput(first), dateTo: toDateInput(last) };
}

function weekRange(anchor) {
  const start = new Date(anchor);
  const offset = start.getDay();
  start.setDate(start.getDate() - offset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { dateFrom: toDateInput(start), dateTo: toDateInput(end) };
}

function visibleRange(view, anchor) {
  if (view === "day") {
    return { dateFrom: toDateInput(anchor), dateTo: toDateInput(anchor) };
  }

  if (view === "week") {
    return weekRange(anchor);
  }

  return monthRange(anchor);
}

function buildMonthDays(anchor) {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function eventDateKey(event) {
  return toDateInput(new Date(event.startsAt));
}

function timeLabel(event) {
  if (event.allDay) {
    return "All day";
  }

  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  const startLabel = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const endLabel = end ? end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  return endLabel ? `${startLabel} - ${endLabel}` : startLabel;
}

function defaultStartForDate(date) {
  const next = new Date(date);
  next.setHours(10, 0, 0, 0);
  return toLocalDateTimeInput(next);
}

function patientLabel(patient) {
  return `${patient.uhid || patient.registrationNumber || "UHID"} - ${patient.fullName || `${patient.firstName || ""} ${patient.lastName || ""}`.trim()}`.trim();
}

export function CalendarPage() {
  const { user } = useAuth();
  const [view, setView] = useState("month");
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(toDateInput(new Date()));
  const [events, setEvents] = useState([]);
  const [patients, setPatients] = useState([]);
  const [users, setUsers] = useState([]);
  const [formState, setFormState] = useState({ ...initialForm, startsAt: defaultStartForDate(new Date()) });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const range = useMemo(() => visibleRange(view, anchorDate), [view, anchorDate]);
  const canWrite = ["admin", "reception", "doctor", "nursing", "lab", "therapist", "pharmacy", "accounts", "hr"].includes(user?.role);
  const canDelete = ["admin", "reception", "doctor", "hr"].includes(user?.role);

  async function loadCalendar() {
    setLoading(true);
    try {
      const response = await getCalendarEvents(range);
      setEvents(response.items);
    } catch (apiError) {
      setError(apiError.message || "Unable to load calendar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCalendar();
  }, [range.dateFrom, range.dateTo]);

  useEffect(() => {
    async function loadLookups() {
      try {
        const [patientsResponse, usersResponse] = await Promise.all([getPatients(), getUsers()]);
        setPatients(patientsResponse.items || []);
        setUsers(usersResponse.items || []);
      } catch {
        setPatients([]);
        setUsers([]);
      }
    }

    loadLookups();
  }, []);

  const eventsByDate = useMemo(() => {
    return events.reduce((map, event) => {
      const key = eventDateKey(event);
      map[key] = [...(map[key] || []), event];
      return map;
    }, {});
  }, [events]);

  const selectedEvents = eventsByDate[selectedDate] || [];
  const monthDays = useMemo(() => buildMonthDays(anchorDate), [anchorDate]);

  const summary = useMemo(() => ({
    total: events.length,
    appointments: events.filter((event) => event.eventType === "appointment").length,
    manual: events.filter((event) => event.source === "manual").length,
    reminders: events.filter((event) => event.reminderMinutes !== "").length
  }), [events]);

  const changeAnchor = (direction) => {
    setAnchorDate((current) => {
      const next = new Date(current);
      if (view === "day") {
        next.setDate(current.getDate() + direction);
      } else if (view === "week") {
        next.setDate(current.getDate() + direction * 7);
      } else {
        next.setMonth(current.getMonth() + direction);
      }
      setSelectedDate(toDateInput(next));
      return next;
    });
  };

  const startNewEvent = (dateValue = selectedDate) => {
    const date = new Date(`${dateValue}T10:00:00`);
    setFormState({ ...initialForm, startsAt: defaultStartForDate(date) });
    setSelectedDate(dateValue);
    setSuccess("");
    setError("");
  };

  const editEvent = (event) => {
    if (event.source !== "manual") {
      setError("System calendar items are edited from their original module.");
      return;
    }

    setFormState({
      id: event.id,
      title: event.title,
      description: event.description || "",
      eventType: event.eventType || "general",
      startsAt: toLocalDateTimeInput(new Date(event.startsAt)),
      endsAt: event.endsAt ? toLocalDateTimeInput(new Date(event.endsAt)) : "",
      allDay: Boolean(event.allDay),
      location: event.location || "",
      patientId: event.patientId || "",
      assignedTo: event.assignedTo || "",
      reminderMinutes: event.reminderMinutes === "" ? "" : String(event.reminderMinutes),
      status: event.status || "scheduled"
    });
    setSelectedDate(eventDateKey(event));
    setSuccess("");
    setError("");
  };

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormState((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const updateFormField = (name, value) => {
    setFormState((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canWrite) {
      setError("You do not have permission to schedule calendar events.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        ...formState,
        startsAt: new Date(formState.startsAt).toISOString(),
        endsAt: formState.endsAt ? new Date(formState.endsAt).toISOString() : null
      };
      const response = formState.id
        ? await updateCalendarEvent(formState.id, payload)
        : await createCalendarEvent(payload);

      setSuccess(response.message);
      startNewEvent(selectedDate);
      await loadCalendar();
    } catch (apiError) {
      setError(apiError.message || "Unable to save calendar event.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!formState.id || !canDelete) {
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await deleteCalendarEvent(formState.id);
      setSuccess(response.message);
      startNewEvent(selectedDate);
      await loadCalendar();
    } catch (apiError) {
      setError(apiError.message || "Unable to remove calendar event.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <section className="hero-panel">
        <div className="eyebrow">Calendar</div>
        <h2>Hospital schedule for appointments, reminders, follow-ups, therapies, and operational work.</h2>
        <p>Manual events can be added here, while appointments, lab orders, and Panchkarma sessions appear automatically from their modules.</p>
      </section>

      <section className="stat-grid compact-stat-grid">
        <article className="stat-card"><div className="stat-label">Visible Events</div><div className="stat-value">{summary.total}</div><div className="stat-note">{range.dateFrom} to {range.dateTo}</div></article>
        <article className="stat-card"><div className="stat-label">Appointments</div><div className="stat-value">{summary.appointments}</div><div className="stat-note">Auto from bookings</div></article>
        <article className="stat-card"><div className="stat-label">Manual</div><div className="stat-value">{summary.manual}</div><div className="stat-note">Added in calendar</div></article>
        <article className="stat-card"><div className="stat-label">Reminders</div><div className="stat-value">{summary.reminders}</div><div className="stat-note">With reminder time</div></article>
      </section>

      <section className="calendar-layout">
        <article className="content-card calendar-board-card">
          <div className="calendar-toolbar">
            <div className="action-row">
              <Button variant="secondary" onClick={() => changeAnchor(-1)}>Previous</Button>
              <Button variant="secondary" onClick={() => { const today = new Date(); setAnchorDate(today); setSelectedDate(toDateInput(today)); }}>Today</Button>
              <Button variant="secondary" onClick={() => changeAnchor(1)}>Next</Button>
            </div>
            <div>
              <div className="eyebrow">{view}</div>
              <h3>{anchorDate.toLocaleDateString([], { month: "long", year: "numeric" })}</h3>
            </div>
            <div className="segmented-control">
              {["month", "week", "day"].map((item) => (
                <button key={item} type="button" className={view === item ? "active" : ""} onClick={() => setView(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          {loading ? <div className="empty-state">Loading calendar...</div> : null}

          {view === "month" ? (
            <div className="calendar-month-grid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="calendar-weekday">{day}</div>)}
              {monthDays.map((day) => {
                const key = toDateInput(day);
                const dayEvents = eventsByDate[key] || [];
                const isOutside = day.getMonth() !== anchorDate.getMonth();
                return (
                  <button key={key} type="button" className={`calendar-day ${selectedDate === key ? "selected" : ""} ${isOutside ? "outside" : ""}`} onClick={() => { setSelectedDate(key); startNewEvent(key); }}>
                    <span>{day.getDate()}</span>
                    <div className="calendar-day-events">
                      {dayEvents.slice(0, 3).map((event) => <em key={`${event.source}-${event.id}`} className={event.eventType}>{event.title}</em>)}
                      {dayEvents.length > 3 ? <small>+{dayEvents.length - 3} more</small> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="calendar-agenda">
              {(view === "week" ? Array.from({ length: 7 }, (_, index) => {
                const start = new Date(range.dateFrom);
                start.setDate(start.getDate() + index);
                return start;
              }) : [anchorDate]).map((day) => {
                const key = toDateInput(day);
                return (
                  <div key={key} className={`agenda-day ${selectedDate === key ? "selected" : ""}`}>
                    <button type="button" className="agenda-day-head" onClick={() => { setSelectedDate(key); startNewEvent(key); }}>
                      <strong>{day.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}</strong>
                    </button>
                    {(eventsByDate[key] || []).map((event) => (
                      <button key={`${event.source}-${event.id}`} type="button" className={`agenda-event ${event.eventType}`} onClick={() => editEvent(event)}>
                        <strong>{timeLabel(event)}</strong>
                        <span>{event.title}</span>
                      </button>
                    ))}
                    {!(eventsByDate[key] || []).length ? <div className="empty-state">No events.</div> : null}
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <aside className="content-card calendar-side-card">
          <div className="section-header">
            <div>
              <div className="eyebrow">Selected Day</div>
              <h3>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}</h3>
            </div>
            <Button variant="secondary" onClick={() => startNewEvent(selectedDate)}>New</Button>
          </div>

          <div className="stack-list compact-list">
            {selectedEvents.map((event) => (
              <button key={`${event.source}-${event.id}`} type="button" className={`quick-action calendar-event-card ${event.eventType}`} onClick={() => editEvent(event)}>
                <strong>{event.title}</strong>
                <div className="timeline-copy">{timeLabel(event)} - {event.source === "manual" ? "Manual" : event.source}</div>
                <div className="timeline-copy">{event.patientName || event.assignedToName || event.location || "No linked person"}</div>
              </button>
            ))}
            {!selectedEvents.length ? <div className="empty-state">No events on this date.</div> : null}
          </div>

          <form className="form-grid calendar-form" onSubmit={handleSubmit}>
            <div className="field field-span-2">
              <label>Title</label>
              <input name="title" value={formState.title} onChange={handleInputChange} />
            </div>
            <div className="field">
              <label>Type</label>
              <select name="eventType" value={formState.eventType} onChange={handleInputChange}>
                {eventTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select name="status" value={formState.status} onChange={handleInputChange}>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="field">
              <label>Starts</label>
              <input name="startsAt" type="datetime-local" value={formState.startsAt} onChange={handleInputChange} />
            </div>
            <div className="field">
              <label>Ends</label>
              <input name="endsAt" type="datetime-local" value={formState.endsAt} onChange={handleInputChange} />
            </div>
            <label className="checkbox-chip field-span-2">
              <input name="allDay" type="checkbox" checked={formState.allDay} onChange={handleInputChange} />
              <span>All day</span>
            </label>
            <div className="field">
              <label>Patient</label>
              <SearchableSelect
                value={formState.patientId}
                options={patients}
                loadOptions={(query) => getPatients(query, { pageSize: 30 }).then((response) => response.items || [])}
                onChange={(value) => updateFormField("patientId", value)}
                placeholder="Search patient"
                emptyLabel="No matching patient"
                getOptionLabel={patientLabel}
                getOptionMeta={(patient) => patient.phone || patient.cityDistrict || patient.city || ""}
                getSearchText={(patient) => [
                  patient.uhid,
                  patient.registrationNumber,
                  patient.fullName,
                  patient.firstName,
                  patient.lastName,
                  patient.fatherName,
                  patient.phone,
                  patient.cityDistrict,
                  patient.city
                ].filter(Boolean).join(" ")}
              />
            </div>
            <div className="field">
              <label>Assign to</label>
              <select name="assignedTo" value={formState.assignedTo} onChange={handleInputChange}>
                <option value="">Unassigned</option>
                {users.map((entry) => <option key={entry.id} value={entry.id}>{entry.fullName} ({entry.role})</option>)}
              </select>
            </div>
            <div className="field">
              <label>Reminder</label>
              <select name="reminderMinutes" value={formState.reminderMinutes} onChange={handleInputChange}>
                <option value="">None</option>
                <option value="10">10 minutes before</option>
                <option value="30">30 minutes before</option>
                <option value="60">1 hour before</option>
                <option value="1440">1 day before</option>
              </select>
            </div>
            <div className="field">
              <label>Location</label>
              <input name="location" value={formState.location} onChange={handleInputChange} />
            </div>
            <div className="field field-span-2">
              <label>Description</label>
              <textarea name="description" value={formState.description} onChange={handleInputChange} />
            </div>

            {error ? <div className="error-text field-span-2">{error}</div> : null}
            {success ? <div className="success-text field-span-2">{success}</div> : null}

            <div className="field-span-2 action-row">
              <Button type="submit" disabled={submitting || !canWrite}>{formState.id ? "Update Event" : "Schedule Event"}</Button>
              {formState.id && canDelete ? <Button type="button" variant="secondary" onClick={handleDelete} disabled={submitting}>Remove</Button> : null}
            </div>
          </form>

          <div className="empty-state calendar-note">
            Appointment, lab, and Panchkarma items open here for review. To change them, use their original module.
          </div>
          <Link className="inline-link" to="/appointments">Go to appointments</Link>
        </aside>
      </section>
    </DashboardLayout>
  );
}
