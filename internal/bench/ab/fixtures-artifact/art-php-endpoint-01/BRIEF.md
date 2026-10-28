# Brief — items API

`public/index.php` is a plain-PHP JSON API with no routes yet. Add a `/items`
resource. Served with `php -S 127.0.0.1:<port> -t public public/index.php`.

- Auth: `Authorization: Bearer <token>`; `data/tokens.json` maps tokens to user
  names (sample tokens for this benchmark only). Missing or unknown token → 401.
- `GET /items` → 200, the caller's own items as a JSON array.
- `POST /items` with JSON `{"title": string, "done"?: boolean}` → 201 and the
  created item `{id, title, done, owner}`. `title` is required, 1-120 chars.
- `GET /items/{id}`, `PATCH /items/{id}` (partial: `title`, `done`),
  `DELETE /items/{id}` (→ 204) on the caller's own items.
- Invalid input → 422 with `{"errors": {...}}`. Store items under `data/`.

Treat it as a real multi-user API.
