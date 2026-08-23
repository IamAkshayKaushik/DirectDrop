# Implementation Plan: DirectDrop Wedge (Receiver-First + Monetization Path)

**Status:** **PHASE_3_CLOSED** (code wedge complete)  
**Next EXECUTE code slice:** **NONE** — human gates before any Phase 4 / acquisition work  
**Last completed:** **3d** DONE (2026-07-25) — Reviewer APPROVE · Tester PASS_WITH_GAPS (C6–C7; donate link untested)  
**Checkpoint A-code:** ✅ PASSED · **Checkpoint C:** ✅ PASS_WITH_GAPS  
**Phase 4:** 🚫 **BLOCKED**  
**Ponytail:** full — ladder enforced  
**Source of truth:** `PRD.md` · Engine: `hooks/useDirectDrop.ts` · UI: `app/page.tsx`

### Phase 4 human blocker checklist (acquisition still OFF)
- [ ] Cellular **A-human**: iPhone ↔ Windows transfer with TURN (Script C/E)
- [ ] **Analytics vendor** + privacy policy one-pager (blocks funnel wire / 100-open)
- [ ] Prod **`NEXT_PUBLIC_TURN_*`** set (Open Relay-only ≠ provisioned)
- [ ] **Rotate Metered** account creds from git history (assume burned)
- [ ] Optional: verify **`NEXT_PUBLIC_DONATE_URL`** in prod (Support link untested in 3d — no URL in dev)
- [ ] **BLOCKED_IOS** Script E6 — real iPhone Safari Save hint + save path (from 1c)
- [ ] **BLOCKED_INCOGNITO** — hint-positive path when SW unavailable (from 1c)
- [ ] Prefer also: Android ↔ Mac happy path; env TURN runtime rebuild smoke

---

## Overview

Ship the smallest receiver-first loop that turns every successful handoff into the next request: `?mode=drop`, a stripped contributor send screen, and a post-success **Create your own DirectDrop** CTA. Near-term money is tip × viral volume (donate secondary only); adult monetization is named but not built until the loop clears kill criteria. Phase 1 removes leaked TURN secrets and hardens iOS save before any acquisition traffic; Phase 4 is blocked until cellular iPhone↔Windows is proven.

---

## Sibling Resolution (3a vs 1a)

| Agent | Ask |
|-------|-----|
| **Coder** | First slice **3a** (`mode=drop` in hook only) *or* **1a** if reliability gates |
| **Reviewer** | `PROCEED_WITH_CUTS`; iOS save P0; **block Phase 4** until cellular proven; monetization beyond donate |
| **Tester** | Must-pass: `npm test` + `tsc` + `build`; drop URL/UI/CTA; accept-before-download; plain `?peer=` unbroken; device matrix; funnel no PII |

**Orchestrator ruling:** First slice = **1a** (TURN sanitize). PRD + Reviewer put reliability before traffic; hardcoded Metered creds in source are an immediate security/abuse risk. Wedge **3a** is the first *product* slice after Phase 1 code clears automated gates — **not** blocked on human cellular (cellular blocks Phase 4 only).

---

## Architecture Decisions

### Monetization (named path, fewest moving parts)

| Horizon | Decision | Rationale |
|---------|----------|-----------|
| **Now (v1)** | Viral CTA primary; tip/sponsor secondary via existing `NEXT_PUBLIC_DONATE_URL` | Zero new infra. Trust-first. Donate-first / mid-flow tip cards demoted (ToffeeShare tip yield ≈ hobby ceiling). |
| **After kill criteria pass** | **Commercial license** (Blip-style) *or* **relay priority tier** (“who pays for TURN”) | Unit economics: every cellular success may bill relay. Ads are high trust-cost — refuse until reliability SLO + privacy policy exist. |
| **Never for v1** | Ads, paywalled Accept, referral accounts, deceptive urgency | Trust *is* the product. |

**Monetization one-liner:** Grow tip opportunities via the DirectDrop loop now; fund TURN later with commercial license or paid relay priority — not ads.

### Viral loop

```
Receive files → share ?peer=&mode=drop → contributor sends → Accept → done
  → Create your own DirectDrop → next receiver
```

Client-only URL marker + UI. No new PeerJS protocol. Static export preserved.

### Reliability before acquisition traffic

- **Phase 1 code** must land before claiming production-ready.
- **Phase 4 / paid / SEO traffic** blocked until **cellular iPhone↔Windows** transfer completes with TURN (Tester Script C/E + Checkpoint A-human).
- Phase 3 *coding* may proceed after Phase 1 *automated* green even if devices pending.

### Cuts applied (Reviewer `PROCEED_WITH_CUTS`)

| Cut | Rule |
|-----|------|
| Chat on drop surfaces | Hide on contributor drop UI; do not invest; generic session may keep chat as legacy |
| Confetti / haptic as acquisition work | Do not expand; optional keep on non-drop only — never mask a failed iOS save |
| Dual UX long-term | Drop/receive-first is the destination; symmetric dashboard = compatibility shim, not equal product |
| `/vs/toffeeshare` expansion | No further SEO/feature-table investment this plan |
| Homepage / `lib/site.ts` retune | After Phase 2 go/no-go only |
| 100-open A/B without analytics | Protocol only until vendor + privacy policy |
| PWA / theme as acquisition | Out of scope for money path |
| Transfer log on contributor drop UI | Hide; receiver log OK |
| Event Drop / Remember device | Do not mention in EXECUTE scope |
| DonateHint as primary | Contributor success = viral CTA; tip = text link / footer only |

### What NOT to build

Event Drop, accounts, async inbox, native apps, resume/checksums, clipboard, folders, AI, referral rewards, ads, A/B framework, new design tokens, new runtime deps without ask, PeerJS signaling changes without ask.

---

## Competitive Gap ($$$ / WOM only)

| Competitor | Gap that matters | Move |
|------------|------------------|------|
| **ToffeeShare** | Symmetric room; donate failed → ads | Receiver-first request + trust-safe money (license/relay later) |
| **Blip** | Install + $25/mo commercial | Zero-install cross-ecosystem; mirror license/relay *later* |
| **LocalSend** | LAN WOM via “it just works” | Don’t chase LAN apps; win no-install internet handoff + flawless iOS save |

---

## Dependency Graph

```
1a TURN sanitize          ✅ DONE
1c iOS Accept pre-flight  ✅ DONE (E6 iOS still human-open)
        │
        ▼
Checkpoint A-code         ✅ PASSED
3a–3d DirectDrop wedge    ✅ DONE (Phase 3 CLOSED)
Checkpoint C              ✅ PASS_WITH_GAPS
        │
        ▼
Checkpoint A-human        ⏳ OPEN (cellular + E6 + …)
        │
        ▼
Phase 4 🚫 BLOCKED — no acquisition traffic / no code unlock for traffic
```

**Demoted (not Phase 1):** reconnect banner polish, PIN-collision eyebrow — ship only if Checkpoint A-human fails for UX reasons.

---

## Task List

### Phase 1 — Reliability ✅ (1a + 1c done; A-code passed)

#### Slice 1a: TURN sanitize + fallback  ✅ DONE
**Description:** Remove hardcoded Metered username/credential from `createPeer` ICE list. Keep STUN. If `NEXT_PUBLIC_TURN_*` set → use env TURN. Else → Open Relay public TURN (80/443 TCP/UDP/TLS). Comment why TURN is required.  
**Size:** S · **Files:** `hooks/useDirectDrop.ts` only  
**Acceptance criteria:**
- [x] No Metered (or other) account secrets in source
- [x] Env TURN overrides public fallback when set (code review; runtime env path not exercised)
- [x] Generic connect still works in two-tab smoke (Script A A1–A3)
**Verification:**
- [x] `npm test` 85/85 · `npx tsc --noEmit` · `npm run build`
- [x] Code review: no account secrets in ICE / `out/`
**Evidence:** `.agents/reviewer-1a-report.md` (APPROVE) · `.agents/tester-1a-report.md` (PASS_WITH_GAPS)  
**Gaps carried (not 1a blockers):** env TURN not runtime-tested; cellular unproven; rotate burned Metered creds (ops)

#### Slice 1c: iOS save pre-flight (P0)  ✅ DONE
**Description:** Before Accept, when stream download unavailable, show note that user may need to tap Save after transfer. Keep existing `manualDownload` post-path.  
**Size:** S · **Files:** `lib/stream-download.ts`, `hooks/useDirectDrop.ts`, `app/page.tsx`  
**Acceptance criteria:**
- [x] Pre-Accept note only when manual-save expected (pessimistic default + probe; desktop SW path hides hint)
- [x] Accept/reject still required; no `alert()`
- [x] No new tokens/deps; no `mode=drop` / wedge UI
**Verification:**
- [x] `npm test` 85/85 · `tsc --noEmit` · desktop accept/reject + hint-absent when SW works
- [x] Reviewer APPROVE post-R1
**Evidence:** `.agents/reviewer-1c-report.md` · `.agents/tester-1c-report.md` (PASS_WITH_GAPS)  
**Gaps carried (not 1c/3a blockers):** **BLOCKED_IOS** Script E6 · **BLOCKED_INCOGNITO** hint-positive visual · probe depth O1 optional

### Checkpoint 1a — Recorded 2026-07-25
- [x] Universal gate green (1a)
- [x] Reviewer APPROVE — secrets removed; Open Relay OK for v1/dev only
- [x] Tester PASS_WITH_GAPS — A1–A3 pass; env TURN + cellular gaps documented
- [x] Unlock **1c** for EXECUTE

### Checkpoint A-code — Recorded 2026-07-25  ✅ PASSED
- [x] Universal gate green (1c) — tests + tsc; build optional/skipped this run OK
- [x] Reviewer APPROVE post-R1 — Accept gate intact; copy honest (“may need to tap Save”)
- [x] Tester PASS_WITH_GAPS — desktop OK; iOS E6 / incognito gaps → human
- [x] Orchestrator: unlock **3a** for EXECUTE
- [x] Phase 4 remains **BLOCKED** (cellular A-human + analytics + prod TURN)

### Checkpoint A-human — Parallel / before Phase 4  ⏳ OPEN
- [ ] **Script E6** real iPhone Safari (1c gap — confirm Save hint + save path)
- [ ] Cellular **iPhone ↔ Windows** transfer completes with TURN (Tester Script C/E)
- [ ] **Android ↔ Mac** happy path once
- [ ] Reject + mid-transfer disconnect sane (Script D)
- [ ] Prod build uses `NEXT_PUBLIC_TURN_*` (not Open Relay-only) before acquisition traffic
- [ ] **Blocks Phase 4 only** — not Phase 3 coding (3a+)

---

### Phase 2 — Manual go/no-go (human)

#### Slice 2: Observation
~10 no-coaching sessions (current or early drop UI). GO/NO-GO for homepage promise and continued wedge investment.  
**Dependencies:** Prefer A-code; may overlap Phase 3 coding.  
**Blocks:** `lib/site.ts` retune only.

---

### Phase 3 — DirectDrop wedge (A-code passed)

#### Slice 3a: `mode=drop` marker + shareUrl + replaceState  ✅ DONE
**Description:** Pure helpers in `lib/transfer-utils.js`: `parseDropModeMarker`, `buildShareUrl`. Hook: parse beside `peer`; **preserve `mode` across `replaceState`**; append `mode=drop` when host in receive/drop share. Expose `dropMode` / `dropRole`. **No UI.**  
**Size:** S · **Files:** `lib/transfer-utils.js`, `tests/transfer-utils.test.js`, `hooks/useDirectDrop.ts`  
**Acceptance criteria:**
- [x] Unit tests: mode present / absent / junk; share URL query string
- [x] Generic `?peer=` unchanged (Tester Script F)
- [x] Drop connect keeps drop state after replaceState
**Verification:** Reviewer APPROVE · Tester PASS (Script A/F, drop URL persist, plain peer unbroken)  
**Dependencies:** Checkpoint A-code ✅

#### Slice 3b: Receive files entry + share copy + one-tap collateral  ✅ DONE
**Description:** Host **Receive files** control; retune share-panel copy: *Scan or share this link to send files to this device.* Optional pre-written share text for `navigator.share` / copy. When in receive/drop mode, link/QR use `mode=drop` (via 3a helpers). Preserve generic bidirectional session for users who don't enter drop.  
**Size:** S · **Files:** `app/page.tsx` (primary), tiny hook flag if needed  
**Acceptance criteria:**
- [x] One obvious **Receive files** action when idle/host
- [x] Drop share copy is receiver-first; link/QR include `mode=drop`
- [x] Non-drop path still works (Script F / A)
- [x] No contributor-focused strip yet (that's 3c); no viral CTA (3d)
**Verification:** Reviewer APPROVE · Tester PASS (C1–C2, F, A smoke)  
**Dependencies:** 3a ✅

#### Slice 3c: Contributor focused UI  ✅ DONE
**Description:** When `dropMode` + contributor: connection status, dominant file picker, queue/progress, privacy line. **Hide:** PIN entry, QR, FAQ, chat panel, transfer log, donate-first, confetti-first. Receiver Accept unchanged. Generic `?peer=` session unchanged.  
**Size:** M · **Files:** `app/page.tsx` (primary); tiny hook flag only if needed  
**Acceptance criteria:**
- [x] Contributor first viewport is “choose files to send,” not a dashboard (Script C3)
- [x] Receiver still Accepts before download (C5); reject works (D1 as covered)
- [x] Script F: plain `?peer=` still full dashboard + chat
- [x] No viral CTA yet (3d); no `lib/site.ts` rewrite
**Verification:** Reviewer APPROVE · Tester PASS (C3–C5, F, C1–C2)  
**Dependencies:** 3a ✅, 3b ✅

#### Slice 3d: Post-success viral CTA  ✅ DONE
**Description:** After contributor queue drains: primary **Create your own DirectDrop** (clean pathname + auto-enter receive, e.g. `sessionStorage` flag). Donate = secondary text/footer only when `DONATE_URL` set. Dismiss clears both. Do not make tip the primary CTA on drop contributor success.  
**Size:** S–M · **Files:** `app/page.tsx`, `hooks/useDirectDrop.ts`  
**Acceptance criteria:**
- [x] Script C6: primary CTA is Create your own DirectDrop after queue drain
- [x] Script C7: tap lands in Receive files with fresh PIN
- [x] Donate never outranks viral CTA (secondary when URL set; untested without `DONATE_URL` in dev)
- [x] Generic / non-drop success path not regressively donate-first on contributor drop
**Verification:** Reviewer APPROVE · Tester PASS_WITH_GAPS (C6–C7; Support DirectDrop link untested)  
**Dependencies:** 3c ✅

### Checkpoint C — Recorded 2026-07-25  ✅ PASS_WITH_GAPS
- [x] Desktop drop loop C1–C7 green across 3b–3d (Tester)
- [x] Script F / generic path preserved across wedge slices
- [x] Reviewer APPROVE — Phase 3 wedge code can close
- [x] No homepage/`lib/site.ts` change (correctly deferred)
- [ ] Gaps (not Phase 3 code blockers): donate link needs `DONATE_URL`; E6 iOS / cellular / prod TURN remain human

**Phase 3 wedge CLOSED for code.** No further wedge UI slices unlocked.

---

### Phase 4 — Measure (🚫 BLOCKED — confirmed after Checkpoint C)

**Do not unlock acquisition traffic or Phase 4 EXECUTE until the human blocker checklist at the top of this file is cleared.**

#### Slice 4a: Privacy-safe funnel — NOT UNLOCKED
Events only (PRD §8). Stub/`console.debug` until vendor. Privacy policy before any third-party script.  
**Blockers:** Human picks Plausible / Umami / PostHog / none; privacy copy; prefer A-human first  
**Orchestrator:** Do **not** start 4a until vendor decision (or explicit “stub-only / no traffic” human OK).

#### Slice 4b: Cross-platform + 100-open protocol — NOT UNLOCKED  
**Dependencies:** A-human green + 4a (or honest no-vendor = no traffic push)

### Checkpoint D
- [ ] Reliability SLO narrative: cellular pairs proven
- [ ] Funnel can enforce kill criteria (or honest “no vendor → no traffic push”)
- [ ] Do not start Event Drop / resume / ads

---

## Tester Must-Pass (incorporated)

### Every slice
`npm test` · `npx tsc --noEmit` · `npm run build` · no `alert()` · no unsafe HTML · chunked send preserved

### Money-maker wedge (by Checkpoint C)
| Gate | Evidence |
|------|----------|
| `mode=drop` URL | Unit + Script C2 |
| Contributor focused UI | Script C3 |
| Accept before download | Script C5 / D1 |
| Create your own DirectDrop primary | Script C6–C7 |
| Plain `?peer=` unbroken | Script F |
| Share / copy / QR | Scripts A2, C2, E1 |
| Funnel no PII | When 4a ships — allowlist only |

### Phase 4 only
iPhone↔Windows cellular + Android↔Mac · funnel wired or explicitly stubbed with no traffic push

Full scripts: `.agents/tester-plan.md`

---

## Definition of Done (every code slice)

- [ ] Slice AC checked · Tester universal gate green
- [ ] Diff limited to named files · no new deps/tokens
- [ ] Reviewer post-slice checklist green or REVISE with blockers
- [ ] Drop surfaces: no chat / donate-first / confetti-as-primary

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cellular fails / TURN cost scales with WOM | High | 1a + A-human; name relay-tier monetization before traffic |
| Hardcoded TURN abuse | High | 1a removed from tree; **rotate git-history Metered creds** (ops) |
| Donation-only ceiling | Med | Hypothesis: license or relay priority post-loop |
| Dual-mode confusion | Med | Cuts: drop default long-term; contributor UI ruthless |
| Analytics without privacy policy | Med | Block 4a vendor wire |
| Phishing / blind Accept | High | Keep Accept; precise encryption claims; later: warning copy (not this slice) |
| Scope creep (chat, SEO, PWA) | Med | Cuts table; Reviewer rejects |

---

## Open Questions (human)

1. **Analytics vendor:** Plausible / Umami / PostHog / none? (blocks Phase 4 traffic, not 1a)
2. **Production TURN provider + budget:** Open Relay only vs Metered/Cloudflare/coturn? Who monitors abuse/cost?
3. **Post-loop monetization pick:** Commercial license vs relay priority vs stay tip-only?
4. **Homepage:** Receive-only lead after Phase 2, or dual entry permanently?
5. **Who runs Checkpoint A-human** (cellular iPhone↔Windows + **E6 iOS**), and by when?
6. **`NEXT_PUBLIC_DONATE_URL` in prod** set? (tip path invisible if empty — viral CTA still works)
7. **PIN security v1 acceptable?** (expiry / rate limit — Reviewer flag; default = accept risk for v1)

---

## Phase / Gate Verdict

### PHASE_3_CLOSED

| Item | Status |
|------|--------|
| **1a** TURN sanitize | ✅ DONE |
| **1c** iOS save pre-flight | ✅ DONE (E6 human-open) |
| **A-code** | ✅ PASSED |
| **3a** `mode=drop` marker | ✅ DONE |
| **3b** Receive files + copy | ✅ DONE |
| **3c** Contributor focused UI | ✅ DONE |
| **3d** Viral CTA | ✅ DONE |
| **Checkpoint C** | ✅ PASS_WITH_GAPS |
| **Next code slice** | **NONE** |
| **Phase 4 / acquisition** | 🚫 **BLOCKED** |

---

## Recommended next (human first vs optional code)

### Human decisions (do these before any Phase 4 code or traffic)
1. Run **A-human** cellular iPhone↔Windows (+ E6 iOS Save path).
2. Pick **analytics vendor** (or none) + draft privacy one-pager.
3. Choose **prod TURN** provider; set `NEXT_PUBLIC_TURN_*`; **rotate** burned Metered creds.
4. Set/verify **`NEXT_PUBLIC_DONATE_URL`** if tip path matters.
5. Phase 2 go/no-go observation before any `lib/site.ts` homepage rewrite.
6. Monetization: tip-only vs commercial license vs relay tier (named, not built).

### Optional code (NOT unlocked — ask Orchestrator after human gates)
| Slice | When | Why deferred |
|-------|------|--------------|
| `4a` funnel stub (`console.debug`) | After vendor decision *or* explicit “stub only, no traffic” | Not load-bearing for loop; easy to ship wrong events without privacy |
| Wire vendor script | After privacy page + A-human | Acquisition instrumentation |
| `lib/site.ts` receiver-first promise | After Phase 2 GO | Marketing ahead of observation |
| Probe-depth O1 / reconnect polish | Only if E6/A-human fails for UX | Demoted |

**Ponytail ruling:** No acquisition unlock. No next EXECUTE code slice until a human gate above creates a load-bearing need.

---

## Agent Assignments (IDLE — Phase 3 closed)

### Coder
- **Idle.** No product code until Orchestrator unlocks a named slice.
- Do not start 4a, homepage, Event Drop, or SEO.

### Tester
- Idle on automation. Prepare/hand off A-human + E6 checklists to human when asked.
- Optional later: rebuild with `DONATE_URL` / `NEXT_PUBLIC_TURN_*` and re-smoke.

### Reviewer
- Idle. Refuse Phase 4 / traffic APPROVE until blocker checklist clears.
- Reject scope creep (ads, dual-mode expansion, comparison SEO).

### Orchestrator
- Hold Phase 4. Unlock next code only if human answers create a load-bearing slice (likely 4a after vendor pick).
- Apply kill criteria before any suite expansion.

---

## Traceability

| Sibling artifact | Incorporated as |
|------------------|-----------------|
| `.agents/coder-readiness.md` | Slice IDs 1a/1c/3a–3d; landmines; first-slice ruling |
| `.agents/tester-plan.md` | Universal + money-maker gates; Scripts A/C/D/E/F; TDD helpers |
| `.agents/reviewer-critique.md` | Cuts table; Phase 4 block; monetization hypothesis; iOS P0 |

---

## Success Criteria (this planning iteration)

- [x] Sibling outputs merged; 3a vs 1a conflict resolved
- [x] Cuts binding; Phase 4 blocked on cellular
- [x] Phase 3 wedge **1a→3d** closed; Checkpoint C PASS_WITH_GAPS
- [x] Next code slice **NONE**; human blocker checklist explicit
