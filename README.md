# PraktijkOS

PraktijkOS is a Belgian-first AI practice operating system for solo and multidisciplinary care practices.

The first product direction is deliberately focused: help mental-health and paramedical practices reduce administrative work while keeping clinicians in control of every AI-generated output.

## Current MVP

- Practice dashboard with operational signals
- Agenda with no-show and administration status
- Client dossiers with care-track context
- Billing overview with Bancontact, Wero and Peppol positioning
- AI Copilot for intake summaries, session notes, referral letters and billing checks
- Human-in-the-loop approval before AI output is treated as usable
- Local-first demo state with a path toward API integration

## Run Locally

```powershell
npm run dev
```

Open [http://127.0.0.1:8124/](http://127.0.0.1:8124/).

## Product Principles

- AI assists with administration; it does not diagnose or autonomously decide.
- Every generated concept is editable, reviewable and auditable.
- Belgian workflows come first: NL/FR, GDPR, payments, Peppol and practice roles.
- Group practices are a first-class customer, not an afterthought.

## Documentation

- [Product roadmap](docs/roadmap.md)
- [AI governance notes](docs/ai-governance.md)
- [Architecture notes](docs/architecture.md)
