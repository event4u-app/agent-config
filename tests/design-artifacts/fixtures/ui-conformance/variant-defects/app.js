// D3 (dead click handler): the reference registers a click listener on
// [data-probe-id="toggle"] that toggles the panel and flips aria-expanded. The
// registration is deliberately absent here, so the button renders identically
// and does nothing. The query below runs and its result is discarded, which is
// what a real dead handler usually looks like after a refactor.
document.querySelector('[data-probe-id="toggle"]');
