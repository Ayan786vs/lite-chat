// ─────────────────────────────────────────────
//  server.js  —  LiteChat backend
//  Stack: Express + Socket.IO + Mongoose
// ─────────────────────────────────────────────
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // Keep socket payloads small
  maxHttpBufferSize: 1e5, // 100 KB max
  pingTimeout: 20000,
  pingInterval: 25000,
});

// ── Config ───────────────────────────────────
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/litechat";

// ── MongoDB Connection ───────────────────────
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✓ MongoDB connected"))
  .catch((err) => console.error("✗ MongoDB error:", err.message));

// ── Message Schema ───────────────────────────
// Stores each message with sender, receiver, content, and status
const msgSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, required: true },
  text: { type: String, required: true, maxlength: 2000 },
  ts: { type: Date, default: Date.now },   // timestamp
  read: { type: Boolean, default: false },
});

// Index so fetching a conversation is fast
msgSchema.index({ from: 1, to: 1, ts: 1 });

const Message = mongoose.model("Message", msgSchema);

// ── Static files ─────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── Root Route ───────────────────────────────
// Explicitly serve index.html to avoid "Cannot GET /" errors
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Health Check ─────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

// ── REST: Get conversation history ───────────
// Called once when a chat window opens
app.get("/history/:user1/:user2", async (req, res) => {
  const { user1, user2 } = req.params;
  try {
    const msgs = await Message.find({
      $or: [
        { from: user1, to: user2 },
        { from: user2, to: user1 },
      ],
    })
      .sort({ ts: 1 })       // oldest first
      .limit(100)            // cap at 100 to keep response light
      .lean()                // plain JS objects = faster
      .select("-__v");       // drop internal mongo field

    res.json(msgs);
  } catch (e) {
    res.status(500).json({ error: "DB error" });
  }
});

// ── REST: Get user list (basic discovery) ────
app.get("/users", async (req, res) => {
  try {
    // Collect distinct names from messages
    const users = await Message.distinct("from");
    res.json([...new Set(users)]);
  } catch {
    res.json([]);
  }
});

// ── Socket.IO ────────────────────────────────
// Map: username → socket.id  (who is online)
const onlineUsers = new Map();

io.on("connection", (socket) => {

  // ── 1. User joins ─────────────────────────
  socket.on("login", (username) => {
    if (!username || typeof username !== "string") return;
    username = username.trim().toLowerCase().slice(0, 24); // sanitize

    socket.username = username;
    onlineUsers.set(username, socket.id);

    // Tell everyone who is online (small payload: just names)
    io.emit("online_users", [...onlineUsers.keys()]);
    console.log(`+ ${username} joined`);
  });

  // ── 2. Send message ───────────────────────
  socket.on("send_msg", async (data) => {
    // data = { to, text }
    const { to, text } = data || {};
    const from = socket.username;

    // Basic validation
    if (!from || !to || !text || text.length > 2000) return;

    // Save to DB
    try {
      const msg = await Message.create({ from, to, text: text.trim() });

      // Lightweight payload sent over the wire
      const payload = {
        _id: msg._id,
        from,
        to,
        text: msg.text,
        ts: msg.ts,
      };

      // Deliver to recipient if online
      const recipientSocketId = onlineUsers.get(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("recv_msg", payload);
      }

      // Confirm delivery back to sender (so UI shows "sent" ✓)
      socket.emit("msg_ack", { _id: msg._id, status: "sent" });
    } catch (e) {
      socket.emit("msg_ack", { status: "error" });
    }
  });

  // ── 3. Disconnect ─────────────────────────
  socket.on("disconnect", () => {
    if (socket.username) {
      onlineUsers.delete(socket.username);
      io.emit("online_users", [...onlineUsers.keys()]);
      console.log(`- ${socket.username} left`);
    }
  });
});

// ── Start ─────────────────────────────────────
server.listen(PORT, () => {
  console.log(`✓ LiteChat running → http://localhost:${PORT}`);
});
