# Claude Iteration Protocol Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align Airia's permanent Claude Code iteration protocol, project instructions, memory pointers, and hooks with the repository's real verification commands and supported Claude Code lifecycle events.

**Architecture:** Keep the long-form operating contract in `docs/DEVELOPMENT_ITERATION_PROTOCOL.md`, keep `AGENTS.md` and `CLAUDE.md` as short mandatory adapters, and keep deterministic enforcement in `.claude/hooks/verification-guard.mjs`. The guard only proves that a relevant verification was attempted after source changes; acceptance, browser, semantic, persistence, and release judgments remain in the protocol.

**Tech Stack:** Markdown, Claude Code project settings/hooks, Node.js ESM hook, npm workspaces, React/Vite/TypeScript web, Express/TypeScript backend, Prisma/Supabase, Vitest, repository CI.

---

### Task 1: Reconcile the protocol with the inspected repository

**Files:**
- Modify: `docs/DEVELOPMENT_ITERATION_PROTOCOL.md`
- Modify: `CLAUDE.md` only if the short mandatory summary is stale
- Modify: `docs/agent-memory/VERIFICATION.md` only if the command or environment facts are stale

**Step 1: Compare documented commands with package scripts and CI**

Confirm that every command presented as executable exists in the relevant workspace and that browser/runtime guidance points to `.claude/launch.json` and the 5051 web port.

**Step 2: State the actual completion boundary**

Preserve behavior-first acceptance, semantic verification for AI, persistence/reload checks, real browser flows, explicit blockers, and memory updates. Do not duplicate the long protocol in `CLAUDE.md`.

**Step 3: Document hook limits**

Explain that the deterministic guard cannot judge product correctness, does not run the suite automatically, and treats a failed but relevant verification as evidence of an investigated blocker rather than proof of success.

### Task 2: Add safe task-completion enforcement

**Files:**
- Modify: `.claude/settings.json`
- Modify: `.claude/hooks/verification-guard.mjs`

**Step 1: Register supported lifecycle events**

Keep `PostToolUse`, `Stop`, and `SubagentStop`; add `TaskCompleted`. Remove the meaningless matcher from non-tool events such as `Stop`.

**Step 2: Reuse the session evidence state**

When source edits exist and no verification has been attempted, block task completion with the changed-file list and the repository verification pointer. Do not run expensive checks from the hook.

**Step 3: Preserve anti-loop and blocker behavior**

Respect `stop_hook_active`, allow a task after any relevant verification attempt (including a failing attempt that documents a real blocker), and fail open if hook state or input is malformed.

### Task 3: Verify the documentation and hook contract

**Files:**
- Verify: `docs/DEVELOPMENT_ITERATION_PROTOCOL.md`
- Verify: `CLAUDE.md`
- Verify: `.claude/settings.json`
- Verify: `.claude/hooks/verification-guard.mjs`

**Step 1: Validate JSON and Markdown references**

Parse `.claude/settings.json`, confirm referenced files exist, and search for stale command names.

**Step 2: Exercise the guard with isolated session state**

Verify all of these cases: source edit arms the guard; `Stop` blocks without verification; `TaskCompleted` blocks without verification; `stop_hook_active` allows continuation; a relevant verification attempt allows stopping/completion; malformed input fails open.

**Step 3: Inspect the final diff and status**

Confirm only the intended protocol, instruction, memory, hook, settings, and plan files changed. Report any application-level verification that is intentionally out of scope.
