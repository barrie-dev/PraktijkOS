# AI Governance

PraktijkOS treats AI as an administrative assistant. In the current product scope, AI output is always a draft.

## Non-Negotiables

- No autonomous diagnosis.
- No autonomous treatment decision.
- No patient-facing medical advice bot in the initial product.
- No automatic sending or filing of generated text without clinician approval.
- Every generated output must be traceable to a workflow, timestamp and approving user.

## Safe Initial Workflows

- Intake summarization
- Session-note structuring
- Referral-letter drafting
- Billing completeness checks
- Reminder and follow-up message drafts

## Review Flow

1. User selects an administrative workflow.
2. User provides source context.
3. AI generates a draft.
4. User edits and validates the draft.
5. User explicitly confirms professional review.
6. System logs approval metadata.

## Future Backend Requirements

- Store AI prompts and outputs separately from clinical source data.
- Redact or minimize personal data before external model calls where possible.
- Support EU processing and signed data processing agreements.
- Keep model version, prompt version and approval metadata.
- Provide exportable audit logs for practice owners.
