const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(
  cors({
    origin: ["http://localhost:3000", "https://fizioplus.netlify.app"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());

cloudinary.config({
  cloud_name: "dt3j5h79o",
  api_key: "328292542925552",
  api_secret: "z_UDM6vdSussXTL5L-PqDUb0WkE",
});

// Store SSE clients
let clients = [];

// Helper to send events to all clients
function sendEventToAll(eventName, data) {
  clients.forEach((res) => {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

// SSE endpoint
app.get("/updates", (req, res) => {
  // Set headers for SSE
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  // Send a comment to keep connection alive in some proxies
  res.write(":\n\n");

  // Add this client to list
  clients.push(res);

  // Remove client when connection closes
  req.on("close", () => {
    clients = clients.filter((client) => client !== res);
  });
});

// Upload image to Cloudinary
app.post("/api/upload", async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(req.body.image, {
      upload_preset: "react_upload",
    });
    res.json({ url: result.secure_url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save image config and notify SSE clients
app.post("/api/save-images", (req, res) => {
  fs.writeFile("images.json", JSON.stringify(req.body), (err) => {
    if (err) {
      console.error("Gabim në ruajtjen e fotove:", err);
      return res.status(500).json({ success: false });
    }

    // Notify all SSE clients about each updated key and url
    Object.entries(req.body).forEach(([key, url]) => {
      sendEventToAll("imageUpdate", { key, url });
    });

    res.json({ success: true });
  });
});

// Get image config
app.get("/api/get-images", (req, res) => {
  try {
    const data = fs.readFileSync("images.json");
    res.json(JSON.parse(data));
  } catch (error) {
    res.json({});
  }
});

app.get("/", (req, res) => {
  res.send("FizioPlus API Server is running");
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});
// File path ku do ruhen anëtarët
const TEAM_FILE = path.join(__dirname, "team.json");

// Merr listën e anëtarëve
app.get("/api/team", (req, res) => {
  try {
    if (!fs.existsSync(TEAM_FILE)) {
      return res.json([]);
    }
    const data = fs.readFileSync(TEAM_FILE, "utf-8");
    res.json(JSON.parse(data));
  } catch (err) {
    console.error("Gabim në lexim të team.json:", err);
    res.status(500).json({ error: "Nuk u lexua dot lista e anëtarëve." });
  }
});

// Ruaj listën e anëtarëve
app.post("/api/team", (req, res) => {
  try {
    const team = req.body;
    fs.writeFileSync(TEAM_FILE, JSON.stringify(team, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error("Gabim në ruajtjen e team.json:", err);
    res.status(500).json({ error: "Nuk u ruajt dot lista e anëtarëve." });
  }
});

app.listen(3001, () => console.log("Serveri është duke punuar në portin 3001"));
