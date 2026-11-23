const http = require("http"),
  fs = require("fs"),
  crypto = require("crypto");
const { Pool } = require("pg");
// PostgreSQL database connection
const db = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : undefined,
    })
  : null;
// Test the PostgreSQL connection when the server starts
if (db) {
  db.query("SELECT NOW()")
    .then(() => {
      console.log("Cheese Plaza database: CONNECTED");
    })
    .catch((error) => {
      console.error("Cheese Plaza database connection failed:", error.message);
    });
}

// Private administrator configuration
const ADMIN_USERNAME = process.env.CHEESE_ADMIN_USERNAME || "";
const ADMIN_PASSWORD_HASH = process.env.CHEESE_ADMIN_PASSWORD_HASH || "";
// Private administrator sessions
const adminSessions = new Map();

function getAdminSession(token) {
  if (typeof token !== "string" || !token) {
    return null;
  }

  const session = adminSessions.get(token);
  if (!session) return null;

  // Admin sessions expire after 8 hours
  const maxAge = 8 * 60 * 60 * 1000;

  if (Date.now() - session.createdAt > maxAge) {
    adminSessions.delete(token);
    return null;
  }

  return session;
}

function verifyAdminPassword(password) {
  if (!ADMIN_PASSWORD_HASH || typeof password !== "string") {
    return false;
  }

  const [saltHex, expectedHex] = ADMIN_PASSWORD_HASH.split(":");

  if (
    !saltHex ||
    !expectedHex ||
    !/^[0-9a-f]{32}$/i.test(saltHex) ||
    !/^[0-9a-f]{128}$/i.test(expectedHex)
  ) {
    return false;
  }

  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 64);

  return crypto.timingSafeEqual(actual, Buffer.from(expectedHex, "hex"));
}

const rooms = new Map();

/* Server-side Cheese currency */
const playerCheese = new Map();

function getPlayerCheese(playerId) {
  return playerCheese.get(playerId) ?? 200;
}

function setPlayerCheese(playerId, amount) {
  const balance = Math.max(0, Math.floor(amount));
  playerCheese.set(playerId, balance);
  return balance;
}

const valid = (v, a, d) => (a.includes(v) ? v : d);
const color = (v, d) => (/^#[0-9a-f]{6}$/i.test(v) ? v : d);
const items = [
  "🛋️",
  "🛏️",
  "🪴",
  "📺",
  "🪑",
  "🪞",
  "🧸",
  "🖼️",
  "💡",
  "📚",
  "🧀",
];
function style(b) {
  return {
    hat: valid(b.hat, ["none", "🎩", "👑", "🎀", "🧢", "🌸"], "none"),

    shirt: valid(
      b.shirt,
      [
        "none",
        "outfit1",
        "outfit2",
        "outfit3",
        "outfit4",
        "outfit5",
        "outfit6",
        "outfit7",
        "outfit8",
        "outfit9",
      ],
      "none",
    ),

    face: valid(b.face, ["face1", "face2", "face3", "face4"], "face1"),
  };
}
function home(b = {}) {
  return {
    wall: color(b.wall, "#e8c9a7"),
    floor: color(b.floor, "#b88c64"),
    items: Array.isArray(b.items)
      ? b.items
          .slice(0, 30)
          .filter(
            (i) =>
              i &&
              items.includes(i.type) &&
              Number.isFinite(i.x) &&
              Number.isFinite(i.y),
          )
          .map((i) => ({
            type: i.type,
            x: Math.max(35, Math.min(965, i.x)),
            y: Math.max(160, Math.min(560, i.y)),
          }))
      : [],
  };
}

function send(res, obj, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}
function broadcast(r) {
  const data = JSON.stringify({
    players: [...r.players.values()].map(
      ({
        id,
        name,
        color,
        x,
        y,
        emote,
        hat,
        shirt,
        face,
        home,
        area,
        bio,
      }) => ({
        id,
        name,
        color,
        x,
        y,
        emote,
        hat,
        shirt,
        face,
        home,
        area,
        bio,
      }),
    ),
    chat: r.chat,
  });
  for (const c of r.clients) c.write(`data: ${data}\n\n`);
}
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost");

  // Serve custom game artwork
  if (u.pathname.startsWith("/assets/")) {
    const path = require("path");
    const assetsDir = path.resolve(__dirname, "assets");
    const file = path.resolve(__dirname, "." + u.pathname);

    const types = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".gif": "image/gif",
    };

    const type = types[path.extname(file).toLowerCase()];

    if (
      !file.startsWith(assetsDir + path.sep) ||
      !type ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    ) {
      res.writeHead(404);
      return res.end("Asset not found");
    }

    res.writeHead(200, { "Content-Type": type });
    return fs.createReadStream(file).pipe(res);
  }

  if (u.pathname === "/css/style.css") {
    res.writeHead(200, {
      "Content-Type": "text/css; charset=utf-8",
    });
    return res.end(fs.readFileSync(__dirname + "/css/style.css"));
  }

  if (u.pathname === "/js/game.js") {
    res.writeHead(200, {
      "Content-Type": "application/javascript; charset=utf-8",
    });
    return res.end(fs.readFileSync(__dirname + "/js/game.js"));
  }

  if (u.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(fs.readFileSync(__dirname + "/index.html"));
  }
  if (u.pathname === "/events") {
    const r = rooms.get(u.searchParams.get("room")),
      p = r?.players.get(u.searchParams.get("id"));
    if (!p) return send(res, { error: "Join first" }, 404);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    r.clients.add(res);
    broadcast(r);
    const heartbeat = setInterval(() => res.write(": ping\n\n"), 15000);
    res.on("close", () => {
      clearInterval(heartbeat);
      r.clients.delete(res);
    });
    return;
  }
  if (req.method !== "POST") return send(res, { error: "Not found" }, 404);
  let raw = "";
  try {
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 16000) return send(res, { error: "Too large" }, 413);
    }
    const b = JSON.parse(raw);

    // Private administrator authentication
    if (u.pathname === "/admin/login" && req.method === "POST") {
      const validUsername =
        typeof b.username === "string" &&
        b.username === ADMIN_USERNAME &&
        ADMIN_USERNAME.length > 0;

      const validPassword = verifyAdminPassword(b.password);

      if (!validUsername || !validPassword) {
        return send(res, { error: "Invalid credentials" }, 401);
      }

      // Generate a private, unpredictable admin token
      const token = crypto.randomBytes(32).toString("hex");

      adminSessions.set(token, {
        username: ADMIN_USERNAME,
        createdAt: Date.now(),
      });

      return send(res, { token });
    }
    // Check administrator authentication
    if (u.pathname === "/admin/status" && req.method === "POST") {
      const admin = getAdminSession(b.token);

      if (!admin) {
        return send(res, { authenticated: false }, 401);
      }

      return send(res, { authenticated: true });
    }

    // Regular player login
    if (u.pathname === "/join") {
      console.log("Player joining with outfit:", b.shirt);
      console.log("Server accepted outfit:", style(b).shirt);
      const room =
        String(b.room || "PLAZA")
          .toUpperCase()
          .replace(/[^A-Z0-9-]/g, "")
          .slice(0, 20) || "PLAZA";
      let r = rooms.get(room);
      if (!r) {
        if (rooms.size >= 100) return send(res, { error: "Server full" }, 503);
        r = { players: new Map(), clients: new Set(), chat: [] };
        rooms.set(room, r);
      }
      if (r.players.size >= 40) return send(res, { error: "Room full" }, 409);
      const id = crypto.randomUUID();
      // Temporary account identifier (not yet authenticated)
      const accountId = null;
      const color = /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : "#e9ab76";
      r.players.set(id, {
        id,
        accountId,
        name:
          String(b.name || "Guest")
            .trim()
            .slice(0, 20) || "Guest",
        color,
        // Initial spawn at the bottom-center of the Shopping District
        x: 500,
        y: 520,
        last: Date.now(),
        emote: "",
        ...style(b),
        home: home(b.home),
        area: "town",
      });
      broadcast(r);
      return send(res, { id, room });
    }
    const r = rooms.get(b.room),
      p = r?.players.get(b.id);
    if (!p) return send(res, { error: "Session expired" }, 404);
    p.last = Date.now();
    if (u.pathname === "/move") {
      if (Number.isFinite(b.x) && Number.isFinite(b.y)) {
        p.x = Math.max(25, Math.min(975, b.x));
        p.y = Math.max(25, Math.min(575, b.y));
      }
    } else if (u.pathname === "/area") {
      if (b.area === "town" || r.players.has(b.area)) {
        p.area = b.area;

        if (b.area === "town") {
          // Shopping District spawn point
          p.x = 500;
          p.y = 575;
        } else {
          // Home spawn point
          p.x = 500;
          p.y = 350;
        }
      }
    } else if (u.pathname === "/style") {
      // Update the player's appearance
      Object.assign(p, style(b));
      p.color = color(b.color, p.color);
    } else if (u.pathname === "/bio") {
      // Save the player's biography on the multiplayer server
      p.bio = String(b.bio || "")
        .trim()
        .slice(0, 200);
    } else if (u.pathname === "/chat") {
      const msg = String(b.text || "")
        .trim()
        .slice(0, 200);
      if (msg && Date.now() - (p.lastChat || 0) > 700) {
        p.lastChat = Date.now();
        r.chat.push({ name: p.name, text: msg, time: Date.now() });
        r.chat = r.chat.slice(-40);
      }
    } else if (u.pathname === "/emote") {
      p.emote = ["👋", "❤️", "😂", "🎉", "🧀"].includes(b.emote) ? b.emote : "";
      p.emoteUntil = Date.now() + 3000;
    } else if (u.pathname === "/leave") {
      r.players.delete(p.id);
    } else if (u.pathname !== "/ping")
      return send(res, { error: "Not found" }, 404);
    broadcast(r);
    send(res, { ok: true });
  } catch (e) {
    send(res, { error: "Invalid request" }, 400);
  }
});
setInterval(() => {
  for (const [key, r] of rooms) {
    let changed = false;
    for (const [id, p] of r.players) {
      if (Date.now() - p.last > 45000) {
        r.players.delete(id);
        changed = true;
      } else if (p.emote && Date.now() > p.emoteUntil) {
        p.emote = "";
        changed = true;
      }
    }
    if (changed) broadcast(r);
    if (!r.players.size && !r.clients.size) rooms.delete(key);
  }
}, 2000);
server.listen(process.env.PORT || 3000, "0.0.0.0", () =>
  console.log("Cheese Plaza: http://localhost:" + (process.env.PORT || 3000)),
);
