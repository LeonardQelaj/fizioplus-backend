const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { auth } = require("express-oauth2-jwt-bearer");

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
const checkJwt = auth({
  audience: "https://fizioplus-api",
  issuerBaseURL: "https://fizioplus.auth0.com/",
});

// Konfigurimi për Cloudinary
cloudinary.config({
  cloud_name: "dt3j5h79o",
  api_key: "328292542925552",
  api_secret: "z_UDM6vdSussXTL5L-PqDUb0WkE",
});

// Sigurohu që ekziston folderi 'data'
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Rrugët absolute për skedarët
const IMAGES_FILE = path.join(dataDir, "images.json");
const TEAM_FILE = path.join(dataDir, "team.json");

// SSE klientët
let clients = [];

// Funksion për të dërguar ngjarje te të gjithë klientët
function sendEventToAll(eventName, data) {
  clients.forEach((res) => {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

// SSE endpoint
app.get("/updates", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  res.write(":\n\n"); // Keep-alive për proxies

  clients.push(res);

  req.on("close", () => {
    clients = clients.filter((client) => client !== res);
  });
});

// Upload image në Cloudinary
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

// Ruaj konfigurimin e fotove dhe njofto klientët
app.post("/api/save-images", checkJwt, (req, res) => {
  fs.writeFile(IMAGES_FILE, JSON.stringify(req.body, null, 2), (err) => {
    if (err) {
      console.error("Gabim në ruajtjen e fotove:", err);
      return res.status(500).json({ success: false });
    }

    Object.entries(req.body).forEach(([key, url]) => {
      sendEventToAll("imageUpdate", { key, url });
    });

    res.json({ success: true });
  });
});

// Merr konfigurimin e fotove
app.get("/api/get-images", (req, res) => {
  try {
    if (!fs.existsSync(IMAGES_FILE)) {
      return res.json({});
    }
    const data = fs.readFileSync(IMAGES_FILE);
    res.json(JSON.parse(data));
  } catch (error) {
    res.json({});
  }
});

// Endpoint për të marrë anëtarët e ekipit
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

// Endpoint për të ruajtur anëtarët e ekipit
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

// Faqja kryesore
app.get("/", (req, res) => {
  res.send("FizioPlus API Server is running");
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// Nis serverin
app.listen(3001, () => console.log("Serveri është duke punuar në portin 3001"));
