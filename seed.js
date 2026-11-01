// Run once:  node seed.js   (adds sample studios so the site is not empty)
if (process.env.NODE_ENV !== "production") {
  require("node:dns/promises").setServers(["8.8.8.8", "1.1.1.1"]);
}
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

const img = (seed) => `https://picsum.photos/seed/${seed}/900/600`;

const studios = [
  { title: "Neon Loft Photo Studio", category: "Photo Studio", hourlyRate: 45, securityDeposit: 120, maxCapacity: 10, location: "Banani, Dhaka", seed: "neonloft", amenities: ["WiFi", "Air Conditioning", "Softboxes & Lighting Kit", "Backdrops", "Changing Room"], overview: "A bright cyc-wall photo studio with a full softbox kit, six paper backdrops and a neon accent wall. Perfect for fashion shoots, portraits and product photography." },
  { title: "Aurora Sound Stage", category: "Sound Stage", hourlyRate: 90, securityDeposit: 300, maxCapacity: 25, location: "Gulshan 2, Dhaka", seed: "aurorastage", amenities: ["WiFi", "Air Conditioning", "Green Screen", "Soundproofing", "Parking", "Props & Furniture"], overview: "A 1,200 sq ft soundproofed stage with a green screen wall, grid lighting and a quiet air system. Built for short films, music videos and commercials." },
  { title: "Echo Podcast Lounge", category: "Podcast Room", hourlyRate: 30, securityDeposit: 60, maxCapacity: 5, location: "Dhanmondi, Dhaka", seed: "echopod", amenities: ["WiFi", "Air Conditioning", "Soundproofing", "Studio Microphones", "Coffee Bar"], overview: "A cozy acoustically treated room with four broadcast microphones, headphones for every guest and a mixer that is ready to record the moment you walk in." },
  { title: "Pulse Music Suite", category: "Music Suite", hourlyRate: 55, securityDeposit: 150, maxCapacity: 8, location: "Uttara, Dhaka", seed: "pulsemusic", amenities: ["WiFi", "Air Conditioning", "Soundproofing", "Mixing Console", "Studio Microphones", "Parking"], overview: "A full music suite with a vocal booth, a 16 channel mixing console and studio monitors. Great for rehearsals, demos and mixing sessions." },
  { title: "Sakura Art Workshop", category: "Art Workshop", hourlyRate: 25, securityDeposit: 40, maxCapacity: 12, location: "Mirpur, Dhaka", seed: "sakuraart", amenities: ["WiFi", "Air Conditioning", "Props & Furniture", "Coffee Bar", "Changing Room"], overview: "A sunny workshop with large tables, easels and a wash sink. Messy-friendly, so paint, clay and print to your heart's content." },
  { title: "Midnight Cyc Photo Wall", category: "Photo Studio", hourlyRate: 38, securityDeposit: 90, maxCapacity: 6, location: "Mohammadpur, Dhaka", seed: "midnightcyc", amenities: ["WiFi", "Softboxes & Lighting Kit", "Backdrops", "Changing Room"], overview: "A compact white cyc wall studio with continuous lights and a dark moody corner. A quick, affordable choice for portraits and small product shoots." },
  { title: "Skyline Podcast Room", category: "Podcast Room", hourlyRate: 35, securityDeposit: 70, maxCapacity: 4, location: "Bashundhara, Dhaka", seed: "skylinepod", amenities: ["WiFi", "Air Conditioning", "Soundproofing", "Studio Microphones"], overview: "A modern two-person podcast room with a city view, foam-treated walls and a simple one-button recording setup." },
  { title: "Vortex Rehearsal Suite", category: "Music Suite", hourlyRate: 28, securityDeposit: 80, maxCapacity: 7, location: "Mohakhali, Dhaka", seed: "vortexrehearsal", amenities: ["WiFi", "Air Conditioning", "Soundproofing", "Parking"], overview: "A loud-friendly rehearsal room with a drum kit, two guitar amps and a PA system. Bring your band and your sticks." },
];

async function run() {
  await client.connect();
  const col = client.db("studiospace").collection("studios");
  let added = 0;
  for (let i = 0; i < studios.length; i++) {
    const { seed, ...s } = studios[i];
    if (await col.findOne({ title: s.title })) continue;
    await col.insertOne({
      ...s,
      image: img(seed),
      gallery: [img(seed + "2"), img(seed + "3")],
      ownerEmail: "host@studiospace.demo",
      ownerName: "StudioSpace Demo Host",
      rating: 0,
      createdAt: new Date(Date.now() - i * 3600 * 1000),
    });
    added++;
  }
  console.log(`Seed done. Added ${added} studio(s).`);
}

run()
  .catch((err) => console.error("Seed failed:", err.message))
  .finally(() => client.close());