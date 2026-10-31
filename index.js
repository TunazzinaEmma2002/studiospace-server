// Some ISPs block SRV lookups for mongodb+srv:// links, so use Google DNS on localhost
if (process.env.NODE_ENV !== "production") {
  require("node:dns/promises").setServers(["8.8.8.8", "1.1.1.1"]);
}
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = "token";
const WEEK = 7 * 24 * 60 * 60 * 1000;
const cookieOptions = { httpOnly: true, secure: isProd, sameSite: "lax", path: "/" };

if (!JWT_SECRET) console.error("JWT_SECRET is missing in .env");

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});
const db = client.db("studiospace");
const studiosCollection = db.collection("studios");
const bookingsCollection = db.collection("bookings");

client
  .connect()
  .then(() => console.log("MongoDB connected successfully!"))
  .catch((err) => console.error("Connection error:", err.message));

// ---------- helpers ----------
const toId = (id) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

// Challenge 1: every protected route reads the JWT from the HTTPOnly cookie
function verifyToken(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).send({ message: "Unauthorized: please log in first" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== "session") throw new Error("wrong token type");
    req.user = { email: payload.email, name: payload.name };
    next();
  } catch {
    res.status(401).send({ message: "Unauthorized: your session is invalid or expired" });
  }
}

function pickStudio(body = {}) {
  return {
    title: String(body.title || "").trim(),
    category: String(body.category || "").trim(),
    hourlyRate: Number(body.hourlyRate),
    securityDeposit: Number(body.securityDeposit) || 0,
    maxCapacity: Number(body.maxCapacity) || 1,
    location: String(body.location || "").trim(),
    image: String(body.image || "").trim(),
    gallery: Array.isArray(body.gallery) ? body.gallery.map((g) => String(g).trim()).filter(Boolean) : [],
    amenities: Array.isArray(body.amenities) ? body.amenities.map(String) : [],
    overview: String(body.overview || "").trim(),
  };
}

function studioError(s) {
  if (!s.title || !s.category || !s.location || !s.image || !s.overview) {
    return "Title, category, location, image and overview are required";
  }
  if (!(s.hourlyRate > 0)) return "Hourly rate must be greater than 0";
  return null;
}

// Challenge 2: look for a Confirmed booking that overlaps the requested time
function findConflict({ studioId, date, startTime, endTime, excludeId }) {
  const query = {
    studioId,
    date,
    status: "Confirmed",
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };
  if (excludeId) query._id = { $ne: excludeId };
  return bookingsCollection.findOne(query);
}

const toMinutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

// ---------- basic + auth ----------
app.get("/", (req, res) => res.send("StudioSpace server is running"));

// The client sends a short-lived proof (signed by the Next.js app after BetterAuth login).
// We verify it and set our own JWT in an HTTPOnly cookie.
app.post("/jwt", (req, res) => {
  try {
    const proof = jwt.verify(req.body?.proof, JWT_SECRET, { audience: "studiospace-server" });
    if (proof.type !== "proof" || !proof.email) throw new Error("bad proof");
    const token = jwt.sign({ type: "session", email: proof.email, name: proof.name }, JWT_SECRET, {
      expiresIn: "7d",
    });
    res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: WEEK });
    res.send({ success: true });
  } catch {
    res.status(401).send({ message: "Invalid login proof" });
  }
});

app.get("/me", verifyToken, (req, res) => res.send(req.user));

app.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.send({ success: true });
});

// ---------- studios ----------
app.get("/studios/featured", async (req, res) => {
  const result = await studiosCollection.find().sort({ createdAt: -1 }).limit(6).toArray();
  res.send(result);
});

app.get("/studios/mine", verifyToken, async (req, res) => {
  const result = await studiosCollection
    .find({ ownerEmail: req.user.email })
    .sort({ createdAt: -1 })
    .toArray();
  res.send(result);
});

app.get("/studios", async (req, res) => {
  const { category, search, sort } = req.query;
  const query = {};
  if (category) query.category = String(category);
  if (search) {
    const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.title = { $regex: safe, $options: "i" };
  }
  const sorts = {
    "price-asc": { hourlyRate: 1 },
    "price-desc": { hourlyRate: -1 },
    newest: { createdAt: -1 },
  };
  const result = await studiosCollection
    .find(query)
    .sort(sorts[sort] || sorts.newest)
    .toArray();
  res.send(result);
});

app.get("/studios/:id", async (req, res) => {
  const _id = toId(req.params.id);
  if (!_id) return res.status(400).send({ message: "Invalid studio id" });
  const studio = await studiosCollection.findOne({ _id });
  if (!studio) return res.status(404).send({ message: "Studio not found" });
  res.send(studio);
});

app.post("/studios", verifyToken, async (req, res) => {
  const data = pickStudio(req.body);
  const error = studioError(data);
  if (error) return res.status(400).send({ message: error });
  const studio = {
    ...data,
    ownerEmail: req.user.email, // taken from the JWT, never from the form
    ownerName: req.user.name,
    rating: 0,
    createdAt: new Date(),
  };
  const result = await studiosCollection.insertOne(studio);
  res.status(201).send(result);
});

app.put("/studios/:id", verifyToken, async (req, res) => {
  const _id = toId(req.params.id);
  if (!_id) return res.status(400).send({ message: "Invalid studio id" });
  const studio = await studiosCollection.findOne({ _id });
  if (!studio) return res.status(404).send({ message: "Studio not found" });
  if (studio.ownerEmail !== req.user.email) {
    return res.status(403).send({ message: "You can only edit your own studios" });
  }
  const data = pickStudio(req.body);
  const error = studioError(data);
  if (error) return res.status(400).send({ message: error });
  const result = await studiosCollection.updateOne({ _id }, { $set: { ...data, updatedAt: new Date() } });
  res.send(result);
});

app.delete("/studios/:id", verifyToken, async (req, res) => {
  const _id = toId(req.params.id);
  if (!_id) return res.status(400).send({ message: "Invalid studio id" });
  const studio = await studiosCollection.findOne({ _id });
  if (!studio) return res.status(404).send({ message: "Studio not found" });
  if (studio.ownerEmail !== req.user.email) {
    return res.status(403).send({ message: "You can only delete your own studios" });
  }
  const result = await studiosCollection.deleteOne({ _id });
  res.send(result);
});

// ---------- bookings ----------
app.post("/bookings", verifyToken, async (req, res) => {
  const { studioId, date, startTime, endTime } = req.body || {};
  const studioObjectId = toId(studioId);
  if (!studioObjectId) return res.status(400).send({ message: "Invalid studio id" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
    return res.status(400).send({ message: "Please choose a valid date" });
  }
  if (!/^\d{2}:\d{2}$/.test(startTime || "") || !/^\d{2}:\d{2}$/.test(endTime || "")) {
    return res.status(400).send({ message: "Please choose a valid start and end time" });
  }
  const minutes = toMinutes(endTime) - toMinutes(startTime);
  if (minutes < 60) {
    return res.status(400).send({ message: "A booking must be at least 1 hour and end after it starts" });
  }

  const studio = await studiosCollection.findOne({ _id: studioObjectId });
  if (!studio) return res.status(404).send({ message: "Studio not found" });
  if (studio.ownerEmail === req.user.email) {
    return res.status(400).send({ message: "You cannot book your own studio" });
  }

  const conflict = await findConflict({ studioId: String(studio._id), date, startTime, endTime });
  if (conflict) {
    return res.status(409).send({
      message: `This studio is already booked on ${date} from ${conflict.startTime} to ${conflict.endTime}. Please pick another time.`,
    });
  }

  const hours = minutes / 60;
  const booking = {
    studioId: String(studio._id),
    studioTitle: studio.title,
    studioImage: studio.image,
    location: studio.location,
    ownerEmail: studio.ownerEmail,
    userEmail: req.user.email,
    userName: req.user.name,
    date,
    startTime,
    endTime,
    hours,
    hourlyRate: studio.hourlyRate,
    totalPrice: hours * studio.hourlyRate,
    securityDeposit: studio.securityDeposit || 0,
    status: "Pending",
    createdAt: new Date(),
  };
  const result = await bookingsCollection.insertOne(booking);
  res.status(201).send(result);
});

app.get("/bookings/mine", verifyToken, async (req, res) => {
  const result = await bookingsCollection
    .find({ userEmail: req.user.email })
    .sort({ createdAt: -1 })
    .toArray();
  res.send(result);
});

// Booking requests for studios owned by the logged-in host
app.get("/bookings/requests", verifyToken, async (req, res) => {
  const result = await bookingsCollection
    .find({ ownerEmail: req.user.email })
    .sort({ createdAt: -1 })
    .toArray();
  res.send(result);
});

// The guest cancels their own Pending booking
app.patch("/bookings/:id/cancel", verifyToken, async (req, res) => {
  const _id = toId(req.params.id);
  if (!_id) return res.status(400).send({ message: "Invalid booking id" });
  const booking = await bookingsCollection.findOne({ _id });
  if (!booking) return res.status(404).send({ message: "Booking not found" });
  if (booking.userEmail !== req.user.email) {
    return res.status(403).send({ message: "You can only cancel your own bookings" });
  }
  if (booking.status !== "Pending") {
    return res.status(400).send({ message: "Only pending bookings can be cancelled" });
  }
  const result = await bookingsCollection.updateOne({ _id }, { $set: { status: "Cancelled" } });
  res.send(result);
});

// The host changes the status (Confirmed / Completed / Cancelled)
app.patch("/bookings/:id/status", verifyToken, async (req, res) => {
  const _id = toId(req.params.id);
  const { status } = req.body || {};
  if (!_id) return res.status(400).send({ message: "Invalid booking id" });
  if (!["Confirmed", "Completed", "Cancelled"].includes(status)) {
    return res.status(400).send({ message: "Invalid status" });
  }
  const booking = await bookingsCollection.findOne({ _id });
  if (!booking) return res.status(404).send({ message: "Booking not found" });
  if (booking.ownerEmail !== req.user.email) {
    return res.status(403).send({ message: "Only the studio host can change this booking" });
  }
  if (status === "Confirmed") {
    const conflict = await findConflict({
      studioId: booking.studioId,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      excludeId: _id,
    });
    if (conflict) {
      return res.status(409).send({
        message: `Cannot confirm: another confirmed booking already uses ${conflict.startTime} to ${conflict.endTime} on ${booking.date}.`,
      });
    }
  }
  const result = await bookingsCollection.updateOne({ _id }, { $set: { status } });
  res.send(result);
});

// ---------- fallbacks ----------
app.use((req, res) => res.status(404).send({ message: "Route not found" }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send({ message: "Something went wrong on the server" });
});

if (require.main === module) {
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

module.exports = app;