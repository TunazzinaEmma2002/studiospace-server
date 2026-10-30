require("node:dns/promises").setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB connected successfully!");

    const db = client.db("studiospace");
    const studiosCollection = db.collection("studios");
    const bookingsCollection = db.collection("bookings");

    app.get("/", (req, res) => {
      res.send("StudioSpace server is running");
    });

    // Add new studio
    app.post("/studios", async (req, res) => {
      const studio = { ...req.body, createdAt: new Date() };
      const result = await studiosCollection.insertOne(studio);
      res.send(result);
    });

    // Home page: latest 6 studios
    app.get("/studios/featured", async (req, res) => {
      const result = await studiosCollection
        .find()
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // All studios (with optional category, search, owner)
    app.get("/studios", async (req, res) => {
      const { category, search, ownerEmail } = req.query;
      const query = {};
      if (category) query.category = category;
      if (ownerEmail) query.ownerEmail = ownerEmail;
      if (search) query.title = { $regex: search, $options: "i" };
      const result = await studiosCollection.find(query).toArray();
      res.send(result);
    });

    // Single studio
    app.get("/studios/:id", async (req, res) => {
      const result = await studiosCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    // Update studio
    app.put("/studios/:id", async (req, res) => {
      const { _id, ...updatedData } = req.body;
      const result = await studiosCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: updatedData }
      );
      res.send(result);
    });

    // Delete studio
    app.delete("/studios/:id", async (req, res) => {
      const result = await studiosCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });
  } catch (error) {
    console.error("Connection error:", error);
  }
}
run();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});