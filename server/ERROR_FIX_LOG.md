# Error Fix Log (Backend Setup)

This file documents the exact errors faced during setup, why they happened, and how each was fixed step by step.

## 1) Module Import Error

### Exact Error
```txt
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'D:\FullStack\photographer-marketplace\server\models\project.js' imported from D:\FullStack\photographer-marketplace\server\index.js
```

### Why It Happened
- `server/index.js` imported `./models/project.js`.
- Actual file location was `server/src/models/project.js`.

### Step-by-Step Fix
1. Checked actual model path in project tree.
2. Updated import in `server/index.js` from `./models/project.js` to `./src/models/project.js`.
3. Searched for other stale `models` imports to prevent next crash.

---

## 2) SRV DNS Error (Hardcoded Wrong Host)

### Exact Error
```txt
Error: querySrv ECONNREFUSED _mongodb._tcp.adil1.mongodb.net
```

### Why It Happened
- `server/index.js` used a hardcoded Atlas URI with `adil1.mongodb.net`.
- `.env` used a different host, causing mismatch and wrong SRV lookup target.

### Step-by-Step Fix
1. Reviewed `server/index.js` and `.env`.
2. Removed hardcoded Mongo URI in code.
3. Switched to `process.env.MONGO_URI` in `server/index.js`.

---

## 3) Atlas Connection Failure + Host Not Found

### Exact Error
```txt
MongooseServerSelectionError: Could not connect to any servers in your MongoDB Atlas cluster...
MongoNetworkError: getaddrinfo ENOTFOUND adil1.wvsotiy.mongodb.net
```

### Why It Happened
- URI format and host usage were inconsistent during troubleshooting.
- DNS resolution for the configured host failed in that connection path.

### Step-by-Step Fix
1. Verified DNS records and connection string format.
2. Corrected URI handling in code to always read from env.
3. Aligned connection string format with Atlas requirements.

---

## 4) SRV Lookup Refused by DNS Resolver

### Exact Error
```txt
Error: querySrv ECONNREFUSED _mongodb._tcp.adil1.wvsotiy.mongodb.net
```

### Why It Happened
- `mongodb+srv://` requires SRV DNS lookups.
- Local DNS resolver/network path refused SRV queries.

### Step-by-Step Fix
1. Confirmed `MONGO_URI` was using `mongodb+srv://`.
2. Switched to direct non-SRV URI to avoid SRV dependency:
   - `mongodb://host1:27017,host2:27017,host3:27017/...`
   - Included `replicaSet`, `authSource`, `tls=true`, and retry params.
3. Kept server setup minimal as requested.

---

## 5) Dev Runtime Warning (Non-blocking)

### Exact Warning
```txt
MaxListenersExceededWarning: Possible EventEmitter memory leak detected...
```

### Why It Happened
- From dev tooling/runtime behavior (`nodemon` + very new Node version).
- Not the root cause of MongoDB connection failures.

### Step-by-Step Handling
1. Identified as warning, not fatal startup blocker.
2. Focused fixes on import path and Mongo connection issues first.

---

## 6) Tooling/Execution Issues During Fixing

### Exact Issues
```txt
apply_patch verification failed: Failed to find expected lines...
command timed out after ...
```

### Why They Happened
- Line content mismatch/encoding prevented exact patch match.
- Runtime command timeouts while waiting on network/db connectivity.

### Step-by-Step Handling
1. Re-read files to confirm current content.
2. Re-applied edits with direct file write when patch matching failed.
3. Validated syntax (`node --check`) after edits.

---

## Final Minimal Setup Implemented

### Server (`server/index.js`)
1. Load env.
2. Initialize Express.
3. Connect DB.
4. Expose one route:
```js
app.get("/", (req, res) => {
  res.send("hello");
});
```

### DB (`server/src/config/db.js`)
1. Read `MONGO_URI` from env.
2. Throw clear error if missing.
3. Connect with Mongoose.
4. Use `serverSelectionTimeoutMS` for faster failure feedback.

