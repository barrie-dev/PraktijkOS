# API Draft

The current API is a dependency-free Node development server. It is not the final production backend, but it defines the first resource boundaries.

## Run

```powershell
npm run api
```

## Endpoints

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/state`
- `POST /api/clients`
- `POST /api/appointments`
- `POST /api/ai/drafts`
- `POST /api/ai/drafts/:id/approve`
- `POST /api/billing/proposals`
- `POST /api/tasks/:id/complete`
- `PUT /api/practice`
- `POST /api/team`

## Local Storage

The API writes development data to `data/dev-db.json`. This file is ignored by git.

## Next Backend Steps

- Replace file storage with a database.
- Add authentication and practice scoping.
- Add role-based authorization.
- Move the remaining offline fallback into a deliberate sync strategy.
- Add validation schemas and automated tests.
