import { createError } from "./errors.js";

export function requireWorkflowReason(payload = {}, label = "Reason") {
  const reason = String(payload.reason || payload.note || "").trim();
  if (!reason) {
    throw createError(`${label} is required.`);
  }
  return reason;
}

export function workflowMetadata(payload = {}, actor = {}, action = "") {
  const reason = requireWorkflowReason(payload);
  const event = {
    action,
    reason,
    note: String(payload.note || "").trim(),
    changedBy: actor?.sub || actor || "",
    changedAt: new Date().toISOString()
  };

  return {
    workflow: event,
    workflowHistory: [event]
  };
}

export function appendWorkflowMetadata(existing = {}, payload = {}, actor = {}, action = "") {
  const event = workflowMetadata(payload, actor, action).workflow;
  return {
    ...(existing || {}),
    workflow: event,
    workflowHistory: [
      ...((existing || {}).workflowHistory || []),
      event
    ]
  };
}
