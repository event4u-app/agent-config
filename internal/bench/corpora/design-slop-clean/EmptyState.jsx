// clean: empty state variants keyed to cause, each with a concrete recovery action
const VARIANTS = {
  noData: {
    title: "No invoices yet",
    body: "Invoices appear here the day after your first billable event.",
    action: { label: "Read how billing works", href: "/docs/billing" },
  },
  filtered: {
    title: "No invoices in this range",
    body: "The selected range is 1 to 8 March. The most recent invoice is dated 28 February.",
    action: { label: "Show the last 12 months", onClick: "resetRange" },
  },
  failed: {
    title: "Invoices could not be loaded",
    body: "The billing service did not respond within 10 seconds. Your data is unaffected.",
    action: { label: "Try again", onClick: "retry" },
  },
};

export function EmptyState({ variant = "noData", onAction }) {
  const config = VARIANTS[variant];
  if (!config) return null;

  const { title, body, action } = config;

  return (
    <div className="empty" role="status">
      <h2 className="empty__title">{title}</h2>
      <p className="empty__body">{body}</p>

      <div className="empty__actions">
        {action.href ? (
          <a className="button button--quiet" href={action.href}>
            {action.label}
          </a>
        ) : (
          <button
            className="button button--primary"
            type="button"
            onClick={() => onAction?.(action.onClick)}
          >
            {action.label}
          </button>
        )}
      </div>

      {variant === "failed" && (
        <p className="empty__aside">
          If this keeps happening, quote request id in your message to support.
        </p>
      )}
    </div>
  );
}
