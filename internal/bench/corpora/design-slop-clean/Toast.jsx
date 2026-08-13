// clean: toast with a live region, timer paused on hover and focus, dismissal always reachable
import { useEffect, useRef, useState } from "react";

const TONE_CLASS = {
  info: "toast",
  warning: "toast toast--warning",
  error: "toast toast--error",
};

export function Toast({ id, tone = "info", title, detail, action, onDismiss, duration = 6000 }) {
  const [paused, setPaused] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (paused || tone === "error") return undefined;
    timer.current = window.setTimeout(() => onDismiss(id), duration);
    return () => window.clearTimeout(timer.current);
  }, [paused, tone, duration, id, onDismiss]);

  return (
    <div
      className={TONE_CLASS[tone]}
      role={tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <svg className="toast__icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="14" r="0.9" fill="currentColor" />
      </svg>

      <div className="toast__body">
        <strong>{title}</strong>
        {detail && <p>{detail}</p>}
        {action && (
          <button className="toast__action" type="button" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>

      <button
        className="toast__dismiss"
        type="button"
        onClick={() => onDismiss(id)}
        aria-label={`Dismiss: ${title}`}
      >
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
          <path
            d="M6 6l8 8M14 6l-8 8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
