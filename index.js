require("node:dns/promises").setServers(["8.8.8.8", "1.1.1.1"]);
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion } = require("mongodb");

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
  } catch (error) {
    console.error("Connection error:", error);
  }
}
run();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});