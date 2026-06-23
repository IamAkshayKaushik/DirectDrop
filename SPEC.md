# Specification: DirectDrop P2P File Transfer Enhancements

This specification defines the requirements, architecture, and success criteria for enhancing the DirectDrop WebRTC file transfer application. The objective is to transition the current basic implementation into a production-grade, highly robust, and bidirectional SaaS application.

## 1. Objective
Enable a seamless, bidirectional, and highly resilient peer-to-peer file sharing experience between any two web browsers. 

### Core Goals
- **Bidirectional Sharing**: Enable both connected peers to drop and send files to each other.
- **Manual PIN Entry**: Allow users to connect simply by entering a 6-digit PIN on the screen, rather than needing to copy/paste or type a long URL.
- **Robust Error Recovery**: Eliminate silent failures. Detect PIN collisions (auto-regenerate and retry), handle offline peers, and manage network disconnections gracefully.
- **Real-Time Queue Control**: Allow users to cancel or remove files from the transfer queue dynamically.
- **Premium UX Enhancements**: Integrate a dynamic toast notification system, improve chat styling to modern conversation bubbles, and polish interactive glassmorphism states.

---

## 2. Tech Stack
- **Frontend Core**: HTML5, Vanilla JavaScript (ES6+), and CSS3.
- **Styling**: TailwindCSS via CDN (v3.4+) combined with scoped custom styles in `styles.css` for specialized animations.
- **Libraries**:
  - `peerjs` (v1.5.2) for WebRTC abstraction and signaling.
  - `qrcodejs` (v1.0.0) for QR Code generation.
- **Development Tooling**: Any static web server (e.g., Python `http.server` or Node `http-server`).

---

## 3. Commands
Full executable commands for development and validation:
- **Dev Server**: `python3 -m http.server 8000` (or `npx serve -l 8000`)
- **Lint Check (Optional)**: `npx eslint app.js`

---

## 4. Project Structure
The project maintains a ultra-clean, zero-dependency lightweight structure:
```
DirectDrop/
├── index.html   # Main application structure & layout
├── styles.css   # Custom CSS for custom animations and scrollbars
├── app.js       # Core application engine, WebRTC logic, UI handlers
└── SPEC.md      # This specification
```

---

## 5. Code Style
We follow clean, modern ES6+ standards, using event-driven architectural patterns and clear async/await structures for asynchronous actions (like file chunk streaming).

### Style Example
```javascript
/**
 * Triggers a beautiful custom toast notification.
 * @param {string} message - The text content to display.
 * @param {'success' | 'error' | 'info'} type - The notification type.
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  
  const bgColors = {
    success: 'bg-emerald-500 border-emerald-600 text-white',
    error: 'bg-rose-500 border-rose-600 text-white',
    info: 'bg-slate-800 border-slate-700 text-white'
  };

  toast.className = `flex items-center p-4 rounded-xl border shadow-lg transform transition-all duration-300 translate-y-2 opacity-0 ${bgColors[type]}`;
  toast.innerText = message;
  
  container.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  // Auto-dismiss after 4 seconds
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-[-10px]');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
```

---

## 6. Testing Strategy
Since this is an ephemeral, client-to-client WebRTC app, automated testing is performed using a multi-tab browser automation environment.
- **Connection Handshake Test**: Open two instances of the application, connect via PIN, and verify chat.
- **Bidirectional Transfer Test**: Drag files onto Tab A (Sender) to Tab B (Receiver), then drag files from Tab B to Tab A. Verify receipt on both.
- **PIN Collision Resilience**: Force a duplicate PeerJS ID error and confirm the app automatically regenerates the PIN.
- **Queue Cancellation Test**: Add 3 large files to the queue, start sending, cancel the 2nd file, and verify the engine skips to the 3rd file correctly.

---

## 7. Boundaries
- **Always do**: Preserve the file-slicing streaming buffer logic (`Blob.slice`) to ensure memory safety. Keep CSS glassmorphism styling consistent with the existing Teal/Slate design palette.
- **Ask first**: Adding new external Javascript dependencies. Changing the signaling server configuration.
- **Never do**: Load entire files into memory at once for transfer. Rely on browser `alert()` popups for error messaging.

---

## 8. Success Criteria
- [x] Connected peers can **both** send and receive files (bidirectional). Files queued during receive auto-send after receive completes.
- [x] Users can enter a 6-digit PIN in a dedicated form to connect to another peer instantly.
- [x] Peer ID collisions are caught and resolved automatically without user intervention (auto-retry).
- [x] A dynamic Toast Notification system handles all major connection, transfer, and chat events visually.
- [x] Users can cancel pending files in the queue, or cancel active transfers mid-way safely.
- [x] Chat UI uses structured chat bubbles (right-aligned for self, left-aligned for peer).
- [x] Interface layout uses 100% of available viewport space elegantly on desktop and scales flawlessly on mobile screens.

---

## 9. Open Questions / Assumptions

> [!IMPORTANT]
> **Assumptions:**
> 1. We assume the use of public PeerJS signaling servers (`0.peerjs.com` or default cloud endpoints) is sufficient for routing.
> 2. We assume the current file chunk size of 16KB is optimal for WebRTC data channels to prevent buffer overflow.
> 3. We assume users want to download incoming files immediately (automatic browser file download trigger) upon receipt completion.
