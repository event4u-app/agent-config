## Startup contract

- **When:** editing endpoint/route/query/serializer on user/tenant data or auth/session/tenant path; model-filled tool arg = request-supplied id.
- **Must:** AUTHENTICATED IS NOT AUTHORIZED → every request id/filter gets server-derived owner/tenant check before data leaves; role decides fields, server strips them · done only when 3 negative tests pass: unauthenticated → 401 · not-owner → 403/404 · cross-tenant → 403/404 (prefer 404 on sensitive: hides existence); small task-aligned touched gap → fix + negative test, same commit.
- **Never:** happy-path 200 alone as done; frontend field-hiding as protection; silently patch live cross-user exposure (notifiable breach); bigger gap → surface.
- **Except:** public data w/o principal concept; prose/docs/config-only edits.
