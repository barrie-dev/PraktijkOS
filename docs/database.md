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

- `practice`: one row containing practice configuration.
- `records`: collection-based records for team, clients, appointments, invoices, work queue, intakes, messages, documents, AI drafts and audit log.

This gives us durable database persistence now while keeping the schema flexible during early product development.

## Next Step

As the domain stabilizes, split high-value entities into stricter relational tables with foreign keys and versioned migrations.
