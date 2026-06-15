# Smoke task — list banned users

Implement a function `list_banned_users(session)` that returns, for every banned
user, a dict with their `username` and `signup_date`. Keep it consistent with
the existing `User` model in this codebase.

Return ONLY a JSON object on the last line of your answer, of the form:

```
{"code": "<the function source>", "fields_referenced": ["<every model field / column / status value your code uses>"]}
```

List every structural name your implementation depends on in `fields_referenced`
(field names, column names, and any status/enum values).
