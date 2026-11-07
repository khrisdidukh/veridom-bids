# Chat — Agent Guide

Chat is the minimal chat-first agent-native app. `/` redirects to shared sign-in, then `/home`, the editable Get started page. Chat lives at `/chat`; new chats start there. Actions carry capabilities; screens exist only for durable workflows.

## Skills

Search with `rg --hidden --follow`; read the exact linked guide before deeper work. `.agents/skills/build-an-app/SKILL.md` — start here for vague requests to create a domain app. `.agents/skills/adding-a-feature/SKILL.md` — cross-area feature checklist. Data/integrations: `.agents/skills/actions/SKILL.md`, `.agents/skills/storing-data/SKILL.md`, `.agents/skills/security/SKILL.md`, `.agents/skills/secrets/SKILL.md`, `.agents/skills/sharing/SKILL.md`. UI: `.agents/skills/frontend-design/SKILL.md`, `.agents/skills/shadcn-ui/SKILL.md`, `.agents/skills/client-side-routing/SKILL.md`. Agent context/workflows: `.agents/skills/context-awareness/SKILL.md`, `.agents/skills/real-time-sync/SKILL.md`, `.agents/skills/reliable-mutations/SKILL.md`, `.agents/skills/performance/SKILL.md`, `.agents/skills/delegate-to-agent/SKILL.md`. Framework: `.agents/skills/agent-native-docs/SKILL.md`, `.agents/skills/agent-native-toolkit/SKILL.md`, `.agents/skills/customizing-agent-native/SKILL.md`.

Use local docs only (no web research): `pnpm action docs-search --query "<topic>"`, `pnpm action docs-search --slug "<slug>"`, `pnpm action docs-search --list`, `pnpm action source-search --query "<pattern>"`, `pnpm action source-search --path <path>`, or `pnpm action source-search --list`. For external-agent integrations, read `pnpm action docs-search --slug "external-agents"`.

## Core rules

- UI feedback: target 100 ms, never exceed 400 ms; acknowledge before network work.
- Normal app data must flow through actions. Keep actions deterministic and focused; use agent chat/AgentSidebar for AI work and follow-ups in the same thread. Keep structured state in SQL and large files in configured storage; persist references only.
- For external integrations, inspect the workspace/provider connection catalog first; reuse its scoped resolver. Never hardcode credentials, webhook URLs, or private/customer data.
- Never fabricate. Report failures and recover; verify writes by reading the row or screen. Navigation is in `<current-screen>`; use `view-screen` for fresh visible-record details.

For custom branding, keep `server/plugins/agent-native-email-branding.ts` aligned: `app.name` appears in transactional email and optional `app.logoUrl` must be an absolute HTTPS URL.

## Application state

- `navigation` describes the view and selected ids. Chat is `chat` at `/chat` and `/chat/<threadId>`; the Get started page is `home` at `/home`; `/` opens shared sign-in/signup.
- Use `navigate` when supported and `view-screen` for a fresh read of visible details; basic navigation is already in `<current-screen>`.

## Building a domain app

Choose the primary workflow and route before editing. Add a domain route under `app/routes/` and set `app.homePath` in `server/plugins/agent-native-email-branding.ts` with `defineAppConfig`. The default Get started page lives at `/home`, and Chat stays at `/chat`; edit `app/routes/home.tsx` when replacing that page with a domain-specific home. Add a static link in `app/components/layout/Sidebar.tsx` before `ChatThreadsSection`; `Header.tsx` uses `APP_TITLE` elsewhere. Shared sidebar and AgentInspector remain.

Use `adding-a-feature` for functional parity and `frontend-design` for a user-facing screen. Keep feature guidance here; do not rewrite `README.md` or `DESIGN.md`. After all edits, run one typecheck, one doctor check, and one browser smoke of the primary workflow, including overlap rejection, cancellation freeing the slot, and authenticated landing. Skip production build and extra test suites.

Before building common workspace or agent UI, read `agent-native-toolkit`; for supported customization, read `customizing-agent-native`.

- Guarded verification: run `pnpm agent-native:doctor`; fix findings before done.

## Veridom Bids

Compare contractor quotes for one renovation job against the owner's own scope. `/bids` lists projects; `/bids/:projectId` is the price comparison (Preisspiegel). On that page `navigation.projectId` is set.

- Scope items are the owner's positions; every quote line is mapped to one scope item or null (extras). Never invent prices or quantities: leave unknown values null and say so.
- German quote words: `bauseits`/`nicht enthalten` → coverage `excluded`; `Alternativposition`/`Eventualposition` → `optional`; `psch` → lump sum; `Stk` → pcs; amounts `exkl. USt` are net.
- Checks are deterministic and run after every write: missing/excluded required items are priced at the benchmark midpoint (or the other quotes' median), short quantities, prices outside the benchmark. `adjustedNet` = quoted net + gap cost. Settled check flags are not raised again.
- Questions go to the contractor in their quote's language and stay drafts until the owner approves them. Do not send anything.

| Action | Purpose |
|---|---|
| get-price-comparison | Full comparison incl. totals |
| read-quote-text | Raw text of one quote |
| update-quote | Header: net total, VAT, terms, warranty, dates |
| record-quote-lines | All positions of one quote in one batch |
| update-quote-line | Correct one line |
| save-scope-items | Add/update scope and benchmarks |
| raise-flag | Judgement the checks can't see |
| save-questions | Draft contractor questions |
| create-demo-project | Demo bathroom with illustrative benchmarks |
