// Tally view: renders the store and wires the controls.
(function () {
  const store = window.TallyStore;
  let filter = 'all';
  const list = document.getElementById('list');
  const count = document.getElementById('count');
  function render() {
    const all = store.all();
    const open = all.filter((t) => !t.done).length;
    count.textContent = open + (open === 1 ? ' item left' : ' items left');
    list.textContent = '';
    for (const t of all.filter((t) => filter === 'all' || (filter === 'done') === t.done)) {
      const li = document.createElement('li');
      li.className = 'todo' + (t.done ? ' done' : '');
      const box = document.createElement('input');
      box.type = 'checkbox'; box.className = 'toggle'; box.checked = t.done;
      box.setAttribute('aria-label', 'Done: ' + t.title);
      box.addEventListener('change', () => { store.toggle(t.id); render(); });
      const span = document.createElement('span'); span.textContent = t.title;
      const del = document.createElement('button'); del.className = 'delete'; del.textContent = 'Delete';
      del.addEventListener('click', () => { store.remove(t.id); render(); });
      li.append(box, span, del);
      list.append(li);
    }
  }
  document.getElementById('new-todo-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('new-todo');
    const title = input.value.trim();
    if (title) store.add(title);
    input.value = '';
    render();
  });
  for (const b of document.querySelectorAll('[data-filter]')) {
    b.addEventListener('click', () => { filter = b.dataset.filter; render(); });
  }
  render();
})();
