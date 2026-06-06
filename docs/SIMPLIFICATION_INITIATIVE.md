# BankStack Simplification Initiative

## Why This Exists

Current usage pattern is clear:

- Frequent: `/accounts`
- Frequent: `/dashboard` (calendar workflow)
- Rare: `/payoff-calculator`
- Rare: `/debt-plan`
- Low value (today): deeper Plaid-dependent surfaces for non-paid Plaid usage

Goal: reduce navigation clutter and decision fatigue while preserving useful setup groundwork.

## Product Principle

Keep the app optimized for a single weekly loop:

1. Update account/payment facts in Accounts.
2. Review due dates and required payments in Dashboard Calendar.
3. Ignore advanced strategy tools unless explicitly needed.

If a screen does not support that loop, it should be secondary, hidden, or merged.

## Decisions Framework

Each page/feature should be one of:

- Keep Primary: visible in top-level nav.
- Keep Secondary: accessible but out of top-level nav.
- Merge: fold into an existing primary surface.
- Retire: remove route/UI and keep code in history.

Decision criteria:

- Weekly usage frequency
- Contribution to required payment execution
- Data reliability without paid Plaid
- Cognitive cost in navigation and onboarding

## Recommended IA (Information Architecture)

Primary nav:

- Dashboard
- Accounts
- Transactions

Secondary tools (hidden from main nav, optional access):

- Payoff Calculator
- Debt Plan

Optional access pattern:

- Add a "More Tools" section within Dashboard Overview, not the left nav.

## Scope Plan

### Phase 1: Navigation Declutter (low risk)

- Remove `Payoff Calculator` and `Debt Plan` from sidebar nav.
- Keep routes functional for direct links/bookmarks.
- Add a small "Advanced Tools" card in Dashboard Overview with links.

Success criteria:

- Fewer top-level choices in sidebar.
- No breakage for existing route URLs.

### Phase 2: Workflow Consolidation (medium risk)

- Move any must-keep insights from payoff/debt-plan into Dashboard support panels.
- Add one quick action from Accounts to open Dashboard Calendar context.

Success criteria:

- Users can complete weekly loop without visiting secondary routes.

### Phase 3: Route Retirement Candidate Review (optional)

- If secondary routes remain unused for 2-4 weeks, retire route links and components.
- Keep backend strategy endpoints if still useful for internal calculations.

Success criteria:

- Smaller frontend surface area with no loss in core loop utility.

## Non-Goals

- Removing Plaid integration setup.
- Re-architecting backend modules.
- Rewriting debt logic.

## Risks And Mitigations

Risk: Hiding tools may block occasional advanced usage.
Mitigation: Keep route access and place links in Dashboard "Advanced Tools" section.

Risk: Confusion during transition.
Mitigation: Add one release note in README and APP_ARCHITECTURE.

Risk: Premature deletion.
Mitigation: Hide first, retire later after observation period.

## Execution Checklist

- [ ] Phase 1 PR: nav declutter + advanced tools entry point
- [ ] Phase 1 QA: verify routes still reachable directly
- [ ] Phase 2 PR: merge required insights into Dashboard
- [ ] Phase 3 decision: retire or keep secondary routes

## Owner Notes

Keep implementation bias toward subtraction, not new controls.
Prefer changing labels and placement over building new components.
