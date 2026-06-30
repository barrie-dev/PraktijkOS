# Database

PraktijkOS now uses SQLite for the development database.

## Runtime

The server uses Node's built-in `node:sqlite` module, available in the current Node 24 runtime. No native npm database package is required.

## Database File

Development data is stored at:

```text
data/praktijkos.sqlite
```

The SQLite database, WAL and shared-memory files are ignored by git.

## Current Schema

- `users`: local platform users.
- `sessions`: cookie-backed login sessions.
- `practice`: one row containing practice configuration.
- `clients`: relational client records.
- `appointments`: relational appointments linked to clients with a foreign key.
- `invoices`: relational billing records linked to clients and appointments where available.
- `records`: collection-based records for team, work queue, intakes, notes, messages, portal invites, documents, AI drafts, integration readiness, ISO evidence packs, SaaS invoices, SaaS usage ledger, SaaS plan changes, SaaS onboarding checklist, SaaS feature entitlements, SaaS admin activity, SaaS support queue, SaaS lifecycle requests, SaaS contract documents, SaaS implementation milestones and audit log.

This gives us durable database persistence now, with strict tables for the first high-value entities and flexible records for areas still moving quickly.

## Local Login

The development seed creates local accounts for the first role model:

```text
admin@praktijkos.local
praktijkos

zorg@praktijkos.local
praktijkos

onthaal@praktijkos.local
praktijkos
```

The password is the same in local development only. The roles are `Praktijkhouder`, `Zorgverlener` and `Administratie`.

## Next Step

As the domain stabilizes, split messages and documents into stricter relational tables with foreign keys and versioned migrations.
