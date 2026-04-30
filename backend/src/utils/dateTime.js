export function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function currentTime() {
  return new Date().toTimeString().slice(0, 5);
}

export function nowIso() {
  return new Date().toISOString();
}

export function toIsoDate(value) {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

export function toIsoDateTime(value) {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

export function toTime(value) {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 5);
}
