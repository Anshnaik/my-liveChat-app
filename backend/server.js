const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const multer = require("multer");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Upload endpoint
app.post("/upload", upload.single("file"), (req, res) => {
  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({
    url: fileUrl,
    name: req.file.originalname,
  });
});

// ✅ Serve frontend build (dist folder)
app.use(express.static(path.join(__dirname, "dist")));

app.get("/.*/", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// HTTP + WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const activeRooms = new Set();

wss.on("connection", (ws) => {
  ws.room = null; // default = global

  ws.on("message", (message) => {
    const parsed = JSON.parse(message);
    console.log("Server received WS message:", parsed);

    if (parsed.type === "create-room") {
      const roomId = parsed.room;
      activeRooms.add(roomId);
      ws.room = roomId;
      ws.send(JSON.stringify({ system: true, msg: `Room ${roomId} created` }));
      console.log(`Room ${roomId} created by ${parsed.user}`);
      return;
    }

    if (parsed.type === "join-room") {
      const roomId = parsed.room;
      if (activeRooms.has(roomId)) {
        ws.room = roomId;
        ws.send(JSON.stringify({ system: true, msg: `Joined room ${roomId}` }));
      } else {
        ws.send(JSON.stringify({ system: true, msg: `Room ${roomId} does not exist` }));
      }
      return;
    }

    // Broadcast messages to clients in same room or global
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        if ((parsed.room && client.room === parsed.room) || (!parsed.room && !client.room)) {
          client.send(JSON.stringify(parsed));
        }
      }
    });
  });

  ws.on("close", () => console.log("Client disconnected"));
});

// ✅ Use Render's dynamic PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
