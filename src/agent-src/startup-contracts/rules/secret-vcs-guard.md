## Startup contract

- **When:** about to (a) write/edit a value that looks like a live credential into a (to-be-)tracked file or (b) `git add` / `git commit` / svn/hg / push content holding one (keys, PEM, JWTs, DB URLs, `password=`).
- **Never:** write a credential into a (to-be-)tracked file or stage/commit one in any VCS (git · svn · hg) w/o stopping first · silently commit or strip a secret · decide for the user · echo the full secret back.
- **Must:** on high-confidence hit: STOP (no write, stage or commit) → show the match (`file:line`, kind, masked preview, why risky) → ask via numbered options (store/false-positive allow-marker/commit anyway) → offer alternative tiered to context (gitignored `.env` + committed `.env.example`; else secret manager/SOPS/OIDC) · recommend user also enable CI secret-scan + push-protection.
- **Except:** `.env.example`/`*.sample`/`*.example` placeholders · audited allow-marker or listed in `.secret-allow` · obvious placeholders, test fixtures explicitly marked as such, hashes/UUIDs w/ no credential keyword nearby.
- **Stop:** already in history → rotate/revoke credential first; state plainly `git rm` and even a history rewrite do NOT un-leak; only if user wants, point to history purge (filter-repo/BFG) + force-push + re-clone.
