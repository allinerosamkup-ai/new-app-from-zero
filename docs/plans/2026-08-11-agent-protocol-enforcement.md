# Agent Protocol Enforcement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the shared agent protocol into an operational contract with task state, LLM handoffs, verifier gates, and Claude Code enforcement while preserving the project-specific Airia QA rules.

**Architecture:** A dependency-free Node CLI stores the current task contract in ignored `.claude/.state/agent-protocol.json`. Claude Code hooks require the contract before source edits and require verifier/meta-verifier evidence before completion. Codex/GPT uses the same repository contract and global instructions; no unsupported Codex hook is invented.

**Tech Stack:** Node.js ESM, Claude Code command hooks, Markdown, Node built-in test runner.

---

### Task 1: Task contract CLI

**Files:**
- Create: `scripts/agent-protocol.mjs`
- Test: `scripts/agent-protocol.test.mjs`

Implement `init`, `role`, `message`, `meta-approve`, `status` and guarded `reset` with atomic JSON state, argument validation, readable/JSON output and tests for valid and invalid transitions.

### Task 2: Claude Code orchestration guard

**Files:**
- Create: `.claude/hooks/orchestration-guard.mjs`
- Modify: `.claude/settings.json`

Require an initialized contract before source edits, inject the contract rules into subagents, record subagent lifecycle events, and block task/session completion until the required evidence and meta-approval exist. Preserve the existing verification guard and fail-open behavior for malformed hook input.

### Task 3: Shared protocol and project adapters

**Files:**
- Modify: `docs/DEVELOPMENT_ITERATION_PROTOCOL.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `C:\Users\allin\.codex\AGENTS.md`
- Modify: `docs/agent-memory/LEARNINGS.md`

Document the operational commands, LLM communication format, role transitions, Airia integration QA, UI/UX criteria, and platform limitations.

### Task 4: Verification

Run:

```text
node --test scripts/agent-protocol.test.mjs
node --check .claude/hooks/orchestration-guard.mjs
node --check .claude/hooks/verification-guard.mjs
JSON parse of .claude/settings.json
isolated hook cases
git diff --check
```

Do not run the product suite for this documentation/configuration-only change. Do not stage or modify the pre-existing mobile changes.
