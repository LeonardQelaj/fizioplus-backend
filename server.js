const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;
const { auth } = require("express-oauth2-jwt-bearer");
require("dotenv").config(); // Lexon .env për MONGODB_URI

const app = express();
app.use(express.json());

// ✅ Konfiguro CORS për frontend (Netlify + localhost)
app.use(
  cors({
    origin: ["https://fizioplus.netlify.app", "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ✅ Lidhja me MongoDB Atlas
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Lidhja me MongoDB u realizua"))
  .catch((err) => console.error("❌ MongoDB gabim:", err));

// ✅ Modelet Mongoose
const ImageSchema = new mongoose.Schema({
  key: String,
  url: String,
});

const TeamSchema = new mongoose.Schema({
  name: String,
  position: String,
  image: String,
});

const Image = mongoose.model("Image", ImageSchema);
const Team = mongoose.model("Team", TeamSchema);

// ✅ Konfigurimi i Cloudinary
cloudinary.config({
  cloud_name: "dt3j5h79o",
  api_key: "328292542925552",
  api_secret: "z_UDM6vdSussXTL5L-PqDUb0WkE",
});

// ✅ Autorizimi me JWT për endpoint-e të mbrojtura
const checkJwt = auth({
  audience: "https://fizioplus-api",
  issuerBaseURL: "https://fizioplus.auth0.com/",
});

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

// ✅ Merr fotot nga MongoDB
app.get("/api/get-images", async (req, res) => {
  try {
    const images = await Image.find({});
    res.json(images);
  } catch (err) {
    res.status(500).json({ error: "Gabim gjatë marrjes së fotove." });
  }
});

// ✅ Ruaj fotot në MongoDB (me JWT)
app.post("/api/save-images", checkJwt, async (req, res) => {
  try {
    await Image.deleteMany({});
    const images = Object.entries(req.body).map(([key, url]) => ({ key, url }));
    await Image.insertMany(images);

    // Dërgo përditësime te klientët përmes SSE
    images.forEach(({ key, url }) => {
      sendEventToAll("imageUpdate", { key, url });
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gabim në ruajtjen e fotove." });
  }
});

// ✅ Merr anëtarët e ekipit
app.get("/api/team", async (req, res) => {
  try {
    const team = await Team.find({});
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: "Gabim në marrjen e ekipit." });
  }
});

// ✅ Ruaj anëtarët e ekipit (me JWT)
app.post("/api/team", checkJwt, async (req, res) => {
  try {
    await Team.deleteMany({});
    await Team.insertMany(req.body);
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
