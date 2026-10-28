# Tally — acceptance behaviour

1. Typing into `#new-todo` and submitting `#new-todo-form` adds an item to
   `#list` as an `li.todo`; empty or whitespace-only input adds nothing.
2. `#count` reads `N items left` (`1 item left` for one) counting open items.
3. Each `li.todo` has a checkbox `input.toggle`; checking it marks the item
   done (class `done`) and updates `#count`.
4. Each `li.todo` has a `button.delete` that removes it.
5. Buttons `[data-filter=all]`, `[data-filter=open]`, `[data-filter=done]`
   render only the matching items in `#list`.
6. Items survive a page reload (stored in `localStorage` under `tally.todos`).
