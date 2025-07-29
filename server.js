// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const { auth } = require("express-oauth2-jwt-bearer");

const app = express();
app.use(express.json());

// ✅ Konfiguro CORS për Netlify + localhost
app.use(
  cors({
    origin: ["https://fizioplus.netlify.app", "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ✅ Siguria me JWT për endpoint-e të mbrojtura
const checkJwt = auth({
  audience: "https://fizioplus-api",
  issuerBaseURL: "https://fizioplus.auth0.com/",
});

// ✅ Cloudinary konfigurimi
cloudinary.config({
  cloud_name: "dt3j5h79o",
  api_key: "328292542925552",
  api_secret: "z_UDM6vdSussXTL5L-PqDUb0WkE",
});

// ✅ Rruga për të ruajtur të dhënat
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const IMAGES_FILE = path.join(dataDir, "images.json");
const TEAM_FILE = path.join(dataDir, "team.json");

// ✅ SSE (Server Sent Events) për sinkronizim në kohë reale
let clients = [];
function sendEventToAll(eventName, data) {
  clients.forEach((res) => {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}
app.get("/updates", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  res.write(":\n\n");
  clients.push(res);
  req.on("close", () => {
    clients = clients.filter((client) => client !== res);
  });
});

// ✅ Upload foto në Cloudinary
app.post("/api/upload", async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(req.body.image, {
      upload_preset: "react_upload",
      folder: "fizioplus_images",
    });
    res.json({ url: result.secure_url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ API për marrjen e fotove
app.get("/api/get-images", (req, res) => {
  try {
    if (!fs.existsSync(IMAGES_FILE)) return res.json({});
    const data = fs.readFileSync(IMAGES_FILE, "utf-8");
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: "Gabim gjatë leximit të fotove." });
  }
});

// ✅ API për ruajtjen e fotove (me siguri)
app.post("/api/save-images", checkJwt, (req, res) => {
  try {
    fs.writeFileSync(IMAGES_FILE, JSON.stringify(req.body, null, 2));
    Object.entries(req.body).forEach(([key, url]) => {
      sendEventToAll("imageUpdate", { key, url });
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gabim në ruajtjen e fotove." });
  }
});

// ✅ API për marrjen e ekipit
app.get("/api/team", (req, res) => {
  try {
    if (!fs.existsSync(TEAM_FILE)) return res.json([]);
    const data = fs.readFileSync(TEAM_FILE, "utf-8");
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: "Gabim në marrjen e ekipit." });
  }
});

// ✅ API për ruajtjen e ekipit
app.post("/api/team", (req, res) => {
  try {
    fs.writeFileSync(TEAM_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gabim në ruajtjen e ekipit." });
  }
});

// ✅ Faqja bazë
app.get("/", (req, res) => {
  res.send("FizioPlus API Server is running.");
});

// ✅ Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Diçka shkoi keq.");
});

// ✅ Nis serverin
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Serveri po punon në portin ${PORT}`));
