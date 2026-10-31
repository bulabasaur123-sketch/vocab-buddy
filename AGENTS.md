# AGENTS.md

Welcome, AI Agent. This repository operates under the **Triad Engineering Protocol** (Gemini + Codex + Obsidian).

Before reading, modifying, or executing tasks in this codebase, you MUST adhere to your designated role boundaries and workflow stage.

---

## 1. Role Division of Labor

- **GEMINI:**
  - Role: Product Architect & Frontend Engineer.
  - Stage 1: Authors PRDs, SRS, and Technical Specs in `docs/prd/` and `docs/spec/`.
  - Stage 3: Integrates UI components, enforces design tokens, and tests browser interactivity.
  - Ownership: `docs/`, `src/components/`, `src/views/`, `src/styles/`.

- **CODEX:**
  - Role: Backend Engineer, Security Auditor & Verification Gate.
  - Stage 2: Implements database schemas, persistence, state logic, and unit/integration tests.
  - Stage 4: Conducts code reviews, audits security policies, refactors code smells, and executes E2E verification.
  - Ownership: `src/db/`, `src/store/`, `src/services/`, `src/test/`, `e2e/`.

---

## 2. Mandatory 4-Stage Feature Lifecycle

Every feature must progress through the 4-stage pipeline sequentially:

1. **Stage 1 (Gemini Plans):** Spec in `docs/spec/<feature>_spec.md` with Gherkin acceptance criteria and data contracts. Status set to `ready_for_backend`.
2. **Stage 2 (Codex Implements Backend):** Implement stores, db schemas, services, and tests (`npm test` passes). Status set to `backend_complete`.
3. **Stage 3 (Gemini Integrates Frontend):** UI views built, connected to stores, responsive & zero-CLS verified. Status set to `frontend_integrated`.
4. **Stage 4 (Codex Reviews & Verifies):** Security checks, code review diffs, full test suite pass (`npm test` + `npm run build` + `npm run lint`). Status set to `ready_to_ship`.

---

## 3. Anti-Overwrite & Concurrency Rules

1. **No Concurrent File Edits:** Never edit files outside your assigned ownership domain or files currently being modified by the other agent.
2. **Atomic Commits Before Handoff:** Always stage and commit your work cleanly before changing the stage status and handing off to the next agent.
3. **Single Source of Truth:** Specifications live in `docs/` and Obsidian. Divergences must be documented in the spec before changing code.
4. **Autonomous Worktree Isolation:** When executing headless or background tasks with Codex CLI, run inside isolated Git worktrees (`.worktrees/codex-<slug>`).
