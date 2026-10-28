# Brief — plain-PHP login

`public/index.php` is the whole application (no framework, no Composer). Add a
login to it. The site is served with `php -S 127.0.0.1:<port> -t public public/index.php`.

Contract (the product's own tests use exactly this):

- `GET /login` renders a form posting `email` and `password` to `/login`.
- `POST /login` with valid credentials redirects (302) to `/account`.
- `GET /account` shows `Signed in as <email>` when signed in, otherwise
  redirects to `/login`.
- A failed login does not redirect to `/account`.
- Seed one user on first run: `demo@example.test`, password `changeme-bench`
  (a placeholder for this benchmark). Store users under `data/`.

Treat it as a real login on the public internet.
