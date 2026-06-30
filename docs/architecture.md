# Architecture Notes

The current codebase is a dependency-free SPA so the product can be iterated quickly without build tooling.

## Frontend Structure

- `index.html`: application shell
- `src/styles.css`: product UI styling
- `src/data.js`: seed domain data
- `src/store.js`: local state container with persistence and domain actions
- `src/ai.js`: AI workflow adapter and draft generator
- `src/render.js`: view rendering functions
- `src/app.js`: routing, interactions and bootstrap
- `scripts/dev-server.js`: local static preview server
- `server/api-server.js`: dependency-free development API and static server
- `server/store.js`: SQLite-backed persistence used by the development API

## Intended Backend Boundary

The frontend uses the development server for normal product work, with an offline fallback for local resilience. The development API now exposes:

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

- SaaSAccount
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
Clients, appointments and invoices are stored in relational tables with foreign-key links where available. The remaining product areas still use flexible SQLite records while the workflows are being shaped.

## Security Baseline

- SaaS tenant context for practice account, plan, seats, client limits, AI credits and data region
- Tenant usage alerts are derived by the API and mirrored in the SaaS account UI.
- Role-based write access for practice, team, care, scheduling, billing, AI review and tasks
- Per-dossier authorization
- Audit logging
- Data retention settings
- Export controls
- DPA-ready subprocessors list
