# Airia PWA Integrated Repair Design

## Problem

The production VPS is on the expected release, but the delivered behavior is incomplete. The current check-in still defaults to an express path without influence factors, voice transcription only deduplicates by Web Speech result index, existing active objectives without actions are not decomposed, and installed PWAs have no visible release identity or deterministic one-time refresh.

## Approved product behavior

Airia remains one integrated command center. The repair must preserve the same data contract across Check-in, Aura, Journal, Planner, Goals, Home and Insights.

### Check-in

There is one contextual flow, not an express flow plus a hidden detailed flow. The screen presents emotion, mood, energy and influence factors before registration. Sleep, cycle, medication, focus, physical/social signals and note stay available on the same scrolling screen. The user must either select at least one influence factor or explicitly state that no factor was identified; this choice is not stored as an invented factor.

### Voice

All microphone surfaces use the same transcript accumulator. It merges exact duplicates, cumulative phrases and suffix/prefix overlaps even when Chrome Android emits them under different result indexes. A recognition restart starts a clean session, while a late event from an older recognizer is ignored.

### Objectives

New objectives continue to be decomposed into ordered micro-actions. Active legacy objectives with no actions are recovered automatically and persisted once. The first pending action is highlighted, only it can advance, completion moves focus to the next action, and the final completion keeps the existing reward animation. Archived objectives are never reactivated.

### PWA release integrity

Every web image exposes an immutable build identifier derived from the Git commit. The service worker includes that identifier and performs at most one navigation per build when it takes control of an older installed client. The app also exposes the identifier for support and release checks. Deployment fails if GitHub, VPS checkout, container asset and public release identity do not agree.

## Validation

Automated regression tests cover cumulative Android transcripts, contextual check-in submission gating, legacy objective recovery and one-time PWA refresh decisions. Before publication, backend and web tests, typechecks and builds must pass. After publication, a clean browser and an authenticated PWA session for `allinerosakup@gmail.com` must load the same release. Real check-ins, factors and objectives in the account are read-only during validation; no synthetic history is inserted.
