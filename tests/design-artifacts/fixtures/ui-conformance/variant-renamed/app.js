// D3 — variant-defects ships this file with the listener registration removed,
// leaving the button present, styled and inert: a dead click handler.
document.querySelector('[data-probe-id="toggle"]').addEventListener('click', (event) => {
  const panel = document.querySelector('[data-probe-id="panel"]');
  const opening = panel.hasAttribute('hidden');
  if (opening) panel.removeAttribute('hidden');
  else panel.setAttribute('hidden', '');
  event.currentTarget.setAttribute('aria-expanded', String(opening));
});
