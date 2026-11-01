# StudioSpace Server

Express and MongoDB API for the StudioSpace booking platform.

**Live API:** https://studiospace-server-black.vercel.app
**Client repo:** https://github.com/TunazzinaEmma2002/studiospace-client
**Live site:** https://studiospace-client-lake.vercel.app

## Features

- JWT authentication stored in an HTTPOnly cookie, with a `verifyToken` middleware that returns 401
- Studio CRUD where only the owner can update or delete (403 otherwise)
- Bookings with double-booking prevention against Confirmed bookings
- Host booking requests: confirm, decline and complete
- Reviews with an automatically updated average rating
- Search, category filter and price sorting

## Setup

```bash
npm install
```

Create a `.env` file:

```
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=a_long_random_string
CLIENT_URL=http://localhost:3000
```

Run `node seed.js` once to add sample studios, then start the server:

```bash
node index.js
```