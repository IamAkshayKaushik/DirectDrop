# DirectDrop - UX Gap Analysis

Findings from end-to-end browser testing (2026-06-23).

## Critical (Fixed)
- [x] **XSS via chat innerHTML** -- remote peer could inject arbitrary JS. Fixed: switched to `textContent`.

## Usability Gaps

### High Priority (Acquisition Blockers)
1. [x] **No connection feedback** -- Fixed: PIN form shows spinner+timeout; URL-based `?peer=` connections now show spinner, 10s timeout, error handler, and URL cleanup.
2. [x] **No copy-to-clipboard for own PIN** -- Fixed: tap-to-copy PIN with toast confirmation.
3. [x] **No reconnection handling** -- Fixed: auto-reconnect with 3 retries (2s/4s/8s exponential backoff), signaling server reconnect via `peer.reconnect()`, graceful fallback to PIN entry.

### Medium Priority (Retention/Polish)
4. [x] **Share link hidden too early** -- Fixed: share link visibility managed correctly across connection states.
5. [x] **No drag-and-drop visual feedback** -- Fixed: dragover highlight with teal border and scale animation.
6. [x] **Empty right panel pre-connection** -- Fixed: "How to connect" help panel fills the space.

### Low Priority (Nice-to-have)
7. [x] **No file type icons** -- Fixed: image/archive/code/generic file icons in queue and accept prompt.
8. [x] **No "send more" affordance** -- Fixed: "Drop more files to send" hint after queue completes.
