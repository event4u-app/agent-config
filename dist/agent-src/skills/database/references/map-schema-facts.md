# Schema facts from the map (data lane)

`agent-config code-graph build` reads the schema into `table` / `column` facts,
from files only — AC never connects to a database and never reads a `.env`
value. The source ladder:

- **T1** migrations and SQL schema files, replayed per connection, drops and
  renames included.
- **T2** committed dumps (`database/schema/*.sql`, a committed `mysqldump` /
  `pg_dump` file) — only what nothing else creates.
- **T3** a schema-only snapshot **the user** produced (`pg_dump --schema-only`,
  `mysqldump --no-data`) and saved as `agents/map/data/snapshot/<connection>.sql` <!-- ref-ignore -->
  (`default.sql` is the default connection).
- **T4** framework oracle output **the user** saved as
  `agents/map/data/oracle/*.json`, one JSON file per model from the framework's <!-- ref-ignore -->
  own model-inspection command.

T3 and T4 are the actual schema (ids end in `@actual` / `@oracle`); T1/T2 are the
intended one. Need the actual schema? Ask the user for the snapshot — never
connect to fetch it. Waivers live in `agents/map/data/declarations.json`: <!-- ref-ignore -->
`fk_mode` per connection (`"none"` for a keyless connection exempts DR-1) and
`virtual_relations` (subject + reason).

Drift findings are advice, never a gate: **DR-1** relation without a foreign key ·
**DR-2** foreign key without a relation · **DR-3** model without a table ·
**DR-4** missing pivot · **DR-5** key type mismatch · **DR-6** foreign key
without a leading index · **DR-7** SET NULL on NOT NULL · **DR-8** CASCADE from
a soft-deleting parent · **DR-9** delete hooks bypassed by a cascade · **DR-10**
key before its target table · **DR-11** intended and actual schema disagree ·
**DR-12** redundant index · **DR-13** implied relation (suggestion). Before acting
on a column fact, confirm it (`agent-config code-graph confirm <id>`) — see
[`code-intelligence`](../../code-intelligence/SKILL.md).
