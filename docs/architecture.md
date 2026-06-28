# Architecture Notes

The current codebase is a dependency-free SPA so the product can be iterated quickly without build tooling.

## Frontend Structure

- `index.html`: application shell
- `src/styles.css`: product UI styling
- `src/data.js`: demo domain data
- `src/store.js`: tiny local state container
- `src/store.js`: local state container with persistence and domain actions
- `src/ai.js`: AI workflow adapter and draft generator
- `src/render.js`: view rendering functions
- `src/app.js`: routing, interactions and bootstrap
- `scripts/dev-server.js`: local static preview server
- `server/api-server.js`: dependency-free development API and static server
- `server/store.js`: SQLite-backed persistence used by the development API

## Intended Backend Boundary

The frontend currently uses local demo state, and the development API now exposes:

- `GET /dashboard`
- `GET /appointments`
- `GET /clients`
- `GET /invoices`
- `POST /ai/drafts`
- `POST /ai/drafts/:id/approve`
- `POST /appointments`
- `POST /clients`
- `POST /billing/proposals`

## Domain Objects

- Practice
- User
- Role
- Client
- Appointment
- CareTrack
- Invoice
- AIDraft
- AuditLogEntry

## Current Persistence

The development API stores data in `data/praktijkos.sqlite` using Node's built-in `node:sqlite` module.
The frontend still has an offline fallback in `localStorage`, but normal development mode uses the API and SQLite.

## Security Baseline

- Role-based access
- Per-dossier authorization
- Audit logging
- Data retention settings
- Export controls
- DPA-ready subprocessors list
