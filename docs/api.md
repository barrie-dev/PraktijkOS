# API Draft

The current API is a dependency-free Node development server. It is not the final production backend, but it defines the first resource boundaries.

## Run

```powershell
npm run api
```

Run the product verification smoke test with:

```powershell
npm run verify
```

## Endpoints

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/dashboard`
- `GET /api/analytics`
- `GET /api/state`
- `GET /api/audit/export?filter=all|exports|access|ai|retention|import|portal|billing`
- `POST /api/clients`
- `POST /api/clients/:id/access-overrides`
- `POST /api/clients/:id/voice-consent`
- `POST /api/clients/:id/voice-notes`
- `PATCH /api/access-overrides/:id`
- `PATCH /api/retention-policies/:id`
- `POST /api/retention-policies/:id/review`
- `POST /api/integration-readiness/:id/review`
- `POST /api/iso-evidence/:id/collect`
- `POST /api/iso-evidence/export`
- `GET /api/clients/:id/export`
- `POST /api/appointments`
- `PATCH /api/appointments/:id`
- `POST /api/waitlist/:id/schedule`
- `POST /api/invoices`
- `POST /api/ai/generate`
- `POST /api/ai/drafts`
- `POST /api/ai/drafts/:id/approve` optionally stores approved note drafts in a client dossier with `{ clientId, storeAsNote: true }`
- `POST /api/ai-models/:id/evaluations`
- AI draft responses include model registry metadata: `modelId`, `modelName`, `promptVersion` and `riskLevel`.
- `POST /api/billing/proposals`
- `POST /api/billing/export`
- `POST /api/accounting/export`
- `PATCH /api/invoices/:id`
- `POST /api/invoices/:id/peppol/prepare`
- `POST /api/invoices/:id/payment-request`
- `POST /api/invoices/:id/reminder`
- `POST /api/tasks/:id/complete`
- `POST /api/day-close/:id/complete`
- `POST /api/knowledge-base`
- `PATCH /api/knowledge-base/:id`
- `POST /api/knowledge-base/:id/review`
- `POST /api/import/preview`
- `POST /api/import/:id/apply`
- `POST /api/import/:id/rollback`
- `PUT /api/practice`
- `POST /api/team`
- `POST /api/intakes`
- `POST /api/messages`
- `PATCH /api/messages/:id`
- `POST /api/notes`
- `POST /api/portal/invites`
- `PATCH /api/portal/invites/:id`
- `GET /api/portal/:token`
- `POST /api/portal/:token/intake`
- `POST /api/documents`
- `PATCH /api/documents/:id`

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
