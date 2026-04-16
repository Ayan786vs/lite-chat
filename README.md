# LiteChat ⚡

Ultra-lightweight real-time chat app.
**Stack:** Node.js · Express · Socket.IO · MongoDB · Vanilla JS

---

## Quick Start

### Prerequisites
- Node.js v18+
- MongoDB running locally (`mongod`)

### Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open in browser
#    http://localhost:3000
```

For development with auto-reload:
```bash
npm run dev
```

### Custom MongoDB URI
```bash
MONGO_URI=mongodb://your-host:27017/litechat npm start
```

---

## Features

| Feature | Detail |
|---|---|
| Login | Type any username, no password |
| 1-to-1 chat | Real-time via Socket.IO |
| Message history | Stored in MongoDB, last 100 msgs |
| Offline queue | IndexedDB stores msgs when offline |
| Auto-send | Queued msgs flush on reconnect |
| Status | ✓ sent / ⏳ pending / ✗ error |
| Low data | Minimal payloads, no polling |

---

## File Structure

```
chat-app/
├── server.js        ← Express + Socket.IO + Mongoose
├── package.json
├── public/
│   └── index.html   ← Full frontend (single file)
└── README.md
```

---

## How Offline Works

1. User sends message while offline
2. Message is saved to **IndexedDB** (browser storage)
3. UI shows ⏳ pending status
4. When internet returns, `flushQueue()` sends all pending messages
5. Server confirms → status updates to ✓ sent

---

## Data Optimization

- Messages capped at 2000 chars
- History limited to 100 messages per pair
- `.lean()` on DB queries (no Mongoose overhead)
- No polling — pure WebSocket events
- Socket payload contains only necessary fields
