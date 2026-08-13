// clean: utility-class filter bar, enumerated transitions, removable chips with accessible names
export function FilterBar({ filters, onRemove, onClearAll, resultCount }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <span>Status</span>
        <select
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"
          defaultValue={filters.status ?? ""}
        >
          <option value="">Any</option>
          <option value="succeeded">Succeeded</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <span>Since</span>
        <input
          type="date"
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"
          defaultValue={filters.since ?? ""}
        />
      </label>

      <ul className="flex flex-wrap items-center gap-2">
        {filters.tags.map((tag) => (
          <li key={tag}>
            <button
              type="button"
              onClick={() => onRemove(tag)}
              aria-label={`Remove tag filter ${tag}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-800 transition-colors duration-150 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"
            >
              {tag}
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
          </li>
        ))}
      </ul>

      {filters.tags.length > 0 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-sm text-sky-800 underline underline-offset-2"
        >
          Clear all filters
        </button>
      )}

      <p className="ml-auto text-sm text-slate-600" role="status">
        {resultCount} runs
      </p>
    </div>
  );
}
