# DirectDrop — Gap Audit (vs ToffeeShare)

Audited: 2026-07-03 via Chrome DevTools browser testing (desktop + iPhone 14 Pro emulation, portrait + landscape).

## 🔴 Acquisition Killers

### G1 — No PWA manifest
`hasManifest: false`. No `manifest.json` means no home screen install, no splash screen, URL bar always visible on iOS. ToffeeShare is installable. **Fix: one file.**

### G2 — Mobile pre-connection page too long
Sender must scroll past their own PIN box, PIN entry form, file picker, and QR code before finding the share link. ToffeeShare shows one big QR + share button above the fold. First-time users bounce.

### G3 — "Click" / "drag and drop" language on mobile
"Click to select files" and "or drag and drop here" are desktop verbs. The `hidden sm:block` on drag text is bypassed in landscape (844px > 640px `sm:` breakpoint). Feels wrong on touch devices.

### G4 — Share link input truncates on mobile
`http://localhost:8000/?peer=879945` truncates at the domain — users can't verify what they're sharing. Should display the PIN prominently (large number) alongside/instead of the raw URL.

### G5 — QR code useless on mobile sender
You cannot scan your own screen. The 200px QR block pushes content down on mobile. QR is only useful for desktop-to-mobile. Should be `hidden sm:block` on the sender panel.

---

## 🟡 Usability Gaps

### G6 — Empty 300px chat panel dominates connected state
After connecting on mobile, 70% of the screen (landscape) is an empty white chat box with "Connection established. Say hi!" The file picker — the primary action — is above a giant idle chat panel. Chat should be collapsed/secondary until used.

### G7 — No persistent "connected" indicator
After the "Connected to peer!" toast fades, zero UI shows you're live with someone. Users think they got disconnected. ToffeeShare has a persistent green "● Connected" badge.

### G8 — Both sides look identical after connecting
Sender and receiver see the same UI. No role clarification — first-time users don't know who sends and who receives.

### G9 — Send button tap target too small (38px)
iOS HIG minimum is 44px. The Send chat button measured at 38px height — regularly missable on mobile.

### G10 — No transfer history
Completed transfers disappear. ToffeeShare shows a session log of sent/received files with sizes. Users have no confirmation a transfer actually succeeded.

---

## 🟢 Differentiation Gaps

### G11 — No onboarding for first-time users
ToffeeShare has a 3-step visual ("Open → Share PIN → Transfer"). DirectDrop drops users into a two-column layout with no explanation of the flow.

### G12 — No "queue first, connect second" UI feedback
Files can be queued before a connection exists (the code supports it), but there's no visual confirmation. Users don't know their files are ready to send.

### G13 — Landscape wastes two-column opportunity
In landscape, layout stacks vertically. Should use horizontal space: file picker left, status/chat right.

### G14 — No dark mode toggle
CSS has `prefers-color-scheme: dark` support but no manual toggle. ToffeeShare has one.

---

## Priority Fix Order

| # | Gap | Fix | Lines |
|---|-----|-----|-------|
| 1 | G1 | Add `manifest.json` | ~20 |
| 2 | G5 | Hide QR on mobile sender (`hidden sm:flex` on qrContainer) | 1 |
| 3 | G6 | Compress chat panel: `min-h-[80px] sm:min-h-[200px]` | 1 |
| 4 | G7 | Persistent "● Connected" badge (show with chatContainer) | 2 |
| 5 | G3 | "Click"→"Tap" on mobile via `navigator.maxTouchPoints > 0` | 2 |
| 6 | G4 | Show PIN large in share panel alongside URL | HTML tweak |
| 7 | G10 | Transfer history: append to `<ul id="transferLog">` on completion | ~15 |
| 8 | G9 | Chat Send button: add `py-2.5` to hit 44px | 1 |
