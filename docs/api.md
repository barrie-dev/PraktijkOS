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

## Local Storage

The API writes development data to `data/dev-db.json`. This file is ignored by git.

## Next Backend Steps

- Replace file storage with a database.
- Add authentication and practice scoping.
- Add role-based authorization.
- Move frontend localStorage writes behind API calls.
- Add validation schemas and automated tests.
