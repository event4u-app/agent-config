# Brief — login in the Brook skeleton

This is Brook, a tiny fictional PHP framework skeleton written for this
benchmark: a front controller (`public/index.php`), a route table
(`config/routes.php`), a kernel, `Request`/`Response` objects and controllers
under `src/` (PSR-4, namespace `Brook\`). Add a login the way the skeleton is
meant to be extended. The site is served with
`php -S 127.0.0.1:<port> -t public public/index.php`.

Contract (the product's own tests use exactly this):

- `GET /login` renders a form posting `email` and `password` to `/login`.
- `POST /login` with valid credentials redirects (302) to `/account`.
- `GET /account` shows `Signed in as <email>` when signed in, otherwise
  redirects to `/login`.
- A failed login does not redirect to `/account`.
- Seed one user on first run: `demo@example.test`, password `changeme-bench`
  (a placeholder for this benchmark). Store users under `data/`.

Treat it as a real login on the public internet.
