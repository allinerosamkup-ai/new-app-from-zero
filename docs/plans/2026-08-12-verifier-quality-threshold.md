# Verifier Quality Threshold Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make verifier quality an objective protocol gate with a minimum score of 8/10 and make reuse-before-invent an explicit acceptance criterion across project and global instructions.

**Architecture:** Extend the existing dependency-free agent protocol CLI so verifier, integration verifier and meta-verifier approvals carry a bounded score and reject scores below 8. Align the canonical protocol, adapters and shared memory with the same rule; no product code or product suite is changed.

**Tech Stack:** Node.js ESM, Node built-in test runner, Markdown, Claude Code hooks.

---

### Task 1: Define the objective quality gate

**Files:**
- Modify: `docs/DEVELOPMENT_ITERATION_PROTOCOL.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `C:\Users\allin\.codex\AGENTS.md`
- Modify: `docs/agent-memory/LEARNINGS.md`

Add a 0–10 score with a minimum of 8/10 for verifier, integration verifier and meta-verifier approval. Define evidence dimensions, critical-failure override, and the rule that “impressionante” is proven by evidence rather than asserted. Make reuse/search evidence mandatory before new code.

### Task 2: Enforce the score in the task contract

**Files:**
- Modify: `scripts/agent-protocol.mjs`
- Modify: `scripts/agent-protocol.test.mjs`

Add validated `--score` handling. Require score >= 8 for verifier/integration `pass` and for `meta-approve`; persist the score and expose it in status output. Preserve secret/control validation and atomic state writes.

### Task 3: Verify and close

Run:

```text
node --test scripts/agent-protocol.test.mjs scripts/orchestration-guard.test.mjs scripts/verification-guard.test.mjs
node --check scripts/agent-protocol.mjs
node --check .claude/hooks/orchestration-guard.mjs
node --check .claude/hooks/verification-guard.mjs
JSON parse of .claude/settings.json
git diff --check
```

Do not run the product suite. Preserve any pre-existing mobile changes and commit only the protocol, contract tests and documentation changes.

### Task 4: Canonicalize Airia product behavior

**Files:**
- Create: `docs/product/PRODUCT_CONSTITUTION.md`
- Modify: `docs/product/airia-product-contract.md`
- Modify: `apps/web/src/routes/checkin-page.tsx` and its integrated test
- Modify: project/global instruction adapters and shared memory

Make the product constitution the canonical source for Airia decisions. Require
`INFERIR → PROPOR → CONFIRMAR`, classify the screenshot flow that transfers
available decisions back to the user as `PRODUCT FAIL`, and preserve confirmation,
correction and veto without making the user operate the system.

### Search/reuse record

Consulted the existing protocol, project/global adapters, Claude hooks, the
agent-protocol CLI and its tests, Airia product contract, prompt system, memory
architecture, project context, active feature flags, repository history and
existing worktree state. The selected approach reuses the current protocol,
CLI and hook contracts and adds only the missing score/constitution gates.
No external dependency, copied code or parallel product flow was introduced;
historical planner/marketing material was rejected as a source of current
product behavior.

### Verification handoff

- Executor evidence: removed the capacity and priority choice groups from the
  active check-in screen; kept the optional contract for explicit contexts from
  other surfaces; added a visible Airia interpretation state with confirmation,
  correction and veto.
- Local verifier pass: **9/10**, with no critical failure. Focused web tests,
  typecheck, production build, protocol tests, syntax checks, settings JSON and
  diff check passed. The integrated test also guards against reintroducing the
  two screenshot prompts.
- Integration pass: **9/10**, with no critical failure. Check-in persistence
  still accepts the shared contract, the backend derives capacity from current
  signals when no explicit context exists, and the result screen keeps the
  explicit-context override path without making the main check-in ask for it.
- Independent subagent/meta approval: `BLOQUEADO` in this session because the
  available verifier subagents hit the platform usage limit. The local passes
  are evidence, not a substitute for an independent LLM approval.
