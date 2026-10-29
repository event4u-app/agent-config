// Tally store: a list of {id, title, done} kept in localStorage.
window.TallyStore = (function () {
  const KEY = 'tally.todos';
  let items = [];
  try { items = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { items = []; }
  const save = () => localStorage.setItem(KEY, JSON.stringify(items));
  let next = items.reduce((m, t) => Math.max(m, t.id), 0) + 1;
  return {
    all: () => items.slice(),
    add(title) { items.push({ id: next++, title, done: false }); save(); },
    toggle(id) { items = items.map((t) => (t.id === id ? { ...t, done: !t.done } : t)); save(); },
    remove(id) { items = items.filter((t) => t.id !== id); save(); },
  };
})();
