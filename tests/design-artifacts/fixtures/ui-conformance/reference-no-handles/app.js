// Class-keyed, and that is the point rather than a convenience: a handover that
// carries no `data-probe-id` also has no handle for its own script to bind to,
// so keying on `.action` / `.panel` is what such a file actually looks like.
// The behaviour is identical to `reference/app.js`; only the selectors differ.
document.querySelector('.action').addEventListener('click', (event) => {
  const panel = document.querySelector('.panel');
  const opening = panel.hasAttribute('hidden');
  if (opening) panel.removeAttribute('hidden');
  else panel.setAttribute('hidden', '');
  event.currentTarget.setAttribute('aria-expanded', String(opening));
});
