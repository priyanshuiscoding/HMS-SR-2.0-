import { useEffect } from "react";

// Floating, auto-dismissing alert. Renders nothing when there is no message.
// Pass the page's existing `message`/`error` state and an onClose that clears it.
export function Toast({ message, type = "success", onClose, duration = 3500 }) {
  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timer = setTimeout(() => onClose?.(), duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) {
    return null;
  }

  return (
    <div className={`toast toast-${type}`} role="status" aria-live="polite">
      <span className="toast-icon">{type === "error" ? "!" : "✓"}</span>
      <span className="toast-message">{message}</span>
      <button type="button" className="toast-close" onClick={() => onClose?.()} aria-label="Dismiss">
        &times;
      </button>
    </div>
  );
}
