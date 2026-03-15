# Three Daily Check-ins Design

**Date:** 2026-03-13
**Status:** Approved

## Decision

The product will support three real daily check-ins per user instead of a single daily record.

Each check-in is stored as its own event. The chart layer may aggregate them when needed, but the source of truth remains the individual check-ins.

## Why This Design

- It matches the product intent of following mood and energy across the day.
- It preserves richer context for AI flows without forcing premature summarization.
- It avoids throwing away signal by overwriting the only check-in of the day.
- It keeps future options open for showing both intraday and daily views.

## Data Contract Changes

- `daily_checkins` must allow multiple rows per user per `local_date`.
- Each row must include a precise event timestamp such as `recorded_at`.
- Each row should include a slot label for product behavior and UX consistency:
  - `morning`
  - `midday`
  - `evening`
- The uniqueness rule becomes one row per user per day-slot, not one row per user per day.

## Chart Behavior

- The database stores three independent check-ins.
- The main daily chart uses an aggregation layer.
- For a daily aggregate point:
  - `moodScore` is the average of the day
  - `energyScore` is the average of the day
  - `stateLabel` and `stateLabelType` come from the most recent check-in of the day

This keeps the chart simple while preserving richer source data.

## API Implications

- Endpoints that return chart data can still return one item per day.
- Endpoints that return raw check-ins should be able to return all intraday records.
- The journal context should use the latest check-in of the current day by default.

## Non-Goals

- No separate daily aggregate table yet.
- No advanced weighted aggregation yet.
- No more than the three defined day slots in MVP.
