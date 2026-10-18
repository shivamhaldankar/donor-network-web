# Database

PostgreSQL 16+, database name `donor_network`. Every member runs their own local copy.

## File order

| File | Owner | What it holds |
|---|---|---|
| `00_reset.sql` | shared | Wipes the schema (local dev only) |
| `01_schema.sql` | shared | All tables, domains, indexes |
| `02_seed.sql` | shared | Demo data and demo logins |
| `10_*.sql` – `19_*.sql` | Member A | Blood matching, eligibility, scheduler |
| `20_*.sql` – `29_*.sql` | Member B | Audit triggers, notification trigger |
| `30_*.sql` – `39_*.sql` | Member C | Organ matching |
| `tests/sliceN_tests.sql` | each owner | Self-checking tests (`PASS` / `FAIL` notices) |

Files are written to be re-runnable (`CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS`).

## Create the database (once)

In pgAdmin: right-click Databases → Create → Database → name it `donor_network`.

## Rebuild from scratch

Run the files in this order. Either paste each into pgAdmin's Query Tool and press F5, or use `psql`:

```
psql -U postgres -d donor_network -f database/00_reset.sql
psql -U postgres -d donor_network -f database/01_schema.sql
psql -U postgres -d donor_network -f database/02_seed.sql
psql -U postgres -d donor_network -f database/10_blood_matching.sql
```

…and so on for every numbered file in ascending order. On Windows `psql` lives in `C:\Program Files\PostgreSQL\<version>\bin`; add that folder to PATH or run it by full path.

## Rules

- Never edit `01_schema.sql` or `02_seed.sql` alone. Open a PR all three members approve, or add an `ALTER TABLE` in your own numbered file.
- Seed data assumes a fresh database (IDs start at 1). Run `00_reset.sql` first if you re-seed.
