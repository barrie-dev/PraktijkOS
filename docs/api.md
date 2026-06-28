# API Draft

The current API is a dependency-free Node development server. It is not the final production backend, but it defines the first resource boundaries.

## Run

```powershell
npm run api
```

## Endpoints

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/dashboard`
- `GET /api/state`
- `POST /api/clients`
- `POST /api/appointments`
- `POST /api/invoices`
- `POST /api/ai/drafts`
- `POST /api/ai/drafts/:id/approve`
- `POST /api/billing/proposals`
- `PATCH /api/invoices/:id`
- `POST /api/invoices/:id/reminder`
- `POST /api/tasks/:id/complete`
- `PUT /api/practice`
- `POST /api/team`
- `POST /api/intakes`
- `POST /api/messages`
- `POST /api/notes`
- `POST /api/portal/invites`
- `GET /api/portal/:token`
- `POST /api/documents`

## Local Database

The API writes development data to `data/praktijkos.sqlite`. SQLite database files are ignored by git.

Most API endpoints require an authenticated session cookie. Mutating endpoints also enforce the first role permissions:

- `Praktijkhouder`: practice setup, team, care, scheduling, billing, AI review and tasks.
- `Zorgverlener`: care, scheduling, AI review and tasks.
- `Administratie`: scheduling, billing and tasks.

The local seed users are documented in `docs/database.md`.

## Next Backend Steps

- Add migrations as versioned files once the schema stabilizes.
- Add practice scoping to every table.
- Move the remaining offline fallback into a deliberate sync strategy.
- Add validation schemas and automated tests.
