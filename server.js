const http = require("http"),
  fs = require("fs"),
  crypto = require("crypto");

/* Send transactional emails using Resend */
async function sendRatSocietyEmail(to, subject, text) {
  const apiKey = process.env.RESEND_API_KEY;

  // Restrict all outgoing emails to the approved test recipient
  const allowedEmail = process.env.RESEND_TEST_EMAIL?.trim().toLowerCase();

  if (!allowedEmail || to.trim().toLowerCase() !== allowedEmail) {
    throw new Error("Email delivery is not enabled for this recipient.");
  }

  if (!apiKey) {
    throw new Error("Resend API key is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Rat Society <onboarding@resend.dev>",
      to: [to],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend delivery failed: HTTP ${response.status}`);
  }

  return response.json();
}
/* Build a Rat Society email verification link */
function createEmailVerificationLink(token) {
  const gameUrl = "https://cheese-plaza.onrender.com";

  const url = new URL(gameUrl);
  url.searchParams.set("verifyEmail", token);

  return url.toString();
}
/* Build a secure password reset link */
function createPasswordResetLink(token) {
  const gameUrl = "https://cheese-plaza.onrender.com";

  const url = new URL(gameUrl);
  url.searchParams.set("resetToken", token);

  return url.toString();
}

/* Generate a secure password reset token */
function generatePasswordResetToken() {
  const token = crypto.randomBytes(32).toString("hex");

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  return { token, tokenHash };
}

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

async function initializeDatabase() {
  if (!db) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS player_accounts (
      id UUID PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      cheese_balance INTEGER NOT NULL DEFAULT 200
        CHECK (cheese_balance >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Add email support to existing player accounts
  await db.query(`
    ALTER TABLE player_accounts
    ADD COLUMN IF NOT EXISTS email VARCHAR(254)
  `);

  // Prevent multiple accounts from using the same email
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    player_accounts_email_unique
    ON player_accounts (email)
  `);

  // Store secure, temporary password reset tokens
  await db.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY,
      account_id UUID NOT NULL
        REFERENCES player_accounts(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Add email verification status to player accounts
  await db.query(`
  ALTER TABLE player_accounts
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE
`);

  // Store secure email verification tokens
  await db.query(`
  CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL
      REFERENCES player_accounts(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);
  // Ensure existing verification tables have the used_at column
  await db.query(`
  ALTER TABLE email_verification_tokens
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ
`);
  console.log("Cheese Plaza player accounts table: READY");
}

// Test the PostgreSQL connection when the server starts

if (db) {
  db.query("SELECT NOW()")
    .then(async () => {
      console.log("Cheese Plaza database: CONNECTED");

      // Create database tables if they don't exist
      await initializeDatabase();
    })
    .catch((error) => {
      console.error(
        "Cheese Plaza database initialization failed:",
        error.message,
      );
    });
}

// Private administrator configuration
const ADMIN_USERNAME = process.env.CHEESE_ADMIN_USERNAME || "";
const ADMIN_PASSWORD_HASH = process.env.CHEESE_ADMIN_PASSWORD_HASH || "";
// Private administrator sessions
const adminSessions = new Map();
// Authenticated player sessions
const playerSessions = new Map();

/* Limit password reset requests by IP address */
const passwordResetAttempts = new Map();
/* Track email verification resend requests by IP address */
const emailVerificationAttempts = new Map();
/* Track verification resend requests by email address */
const emailVerificationEmailAttempts = new Map();
/* Identify clients behind Render's trusted proxy */
function getRequestIp(req) {
  if (process.env.RENDER_SERVICE_ID) {
    const clientIp = req.headers["cf-connecting-ip"];
    const net = require("node:net");

    if (typeof clientIp === "string" && net.isIP(clientIp.trim()) !== 0) {
      return clientIp.trim();
    }
  }

  return req.socket.remoteAddress || "unknown";
}

function allowPasswordResetRequest(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;

  const attempts = (passwordResetAttempts.get(ip) || []).filter(
    (time) => now - time < windowMs,
  );

  if (attempts.length >= maxAttempts) {
    passwordResetAttempts.set(ip, attempts);
    return false;
  }

  attempts.push(now);
  passwordResetAttempts.set(ip, attempts);
  return true;
}
/* Limit email verification requests to 3 per IP every 15 minutes */
function allowEmailVerificationRequest(ip) {
  /* Limit verification resends to 3 requests per email every 15 minutes */

  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 3;

  const attempts = (emailVerificationAttempts.get(ip) || []).filter(
    (time) => now - time < windowMs,
  );

  if (attempts.length >= maxAttempts) {
    emailVerificationAttempts.set(ip, attempts);
    return false;
  }

  attempts.push(now);
  emailVerificationAttempts.set(ip, attempts);

  // Remove expired entries to keep memory usage bounded
  if (emailVerificationAttempts.size > 1000) {
    for (const [key, times] of emailVerificationAttempts) {
      if (times.every((time) => now - time >= windowMs)) {
        emailVerificationAttempts.delete(key);
      }
    }
  }

  return true;
}
function allowEmailVerificationEmailRequest(email) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 3;

  const attempts = (emailVerificationEmailAttempts.get(email) || []).filter(
    (time) => now - time < windowMs,
  );

  if (attempts.length >= maxAttempts) {
    emailVerificationEmailAttempts.set(email, attempts);
    return false;
  }

  attempts.push(now);
  emailVerificationEmailAttempts.set(email, attempts);

  // Clean up expired entries
  for (const [key, times] of emailVerificationEmailAttempts) {
    if (times.every((time) => now - time >= windowMs)) {
      emailVerificationEmailAttempts.delete(key);
    }
  }

  return true;
}
function getPlayerSession(token) {
  if (typeof token !== "string" || !token) {
    return null;
  }

  const session = playerSessions.get(token);
  if (!session) return null;

  // Player sessions expire after 24 hours
  const maxAge = 24 * 60 * 60 * 1000;

  if (Date.now() - session.createdAt > maxAge) {
    playerSessions.delete(token);
    return null;
  }

  return session;
}
// Currency management is reserved for the registered soower account
function canManagePlayerCurrency(token) {
  const session = getPlayerSession(token);

  return (
    session !== null &&
    session.username === "soower" &&
    session.accountId != null
  );
}

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
function verifyPlayerPassword(password, storedHash) {
  if (typeof password !== "string" || typeof storedHash !== "string") {
    return false;
  }

  const parts = storedHash.split(":");

  if (parts.length !== 2) return false;

  const [saltHex, expectedHex] = parts;

  if (
    !/^[0-9a-f]{32}$/i.test(saltHex) ||
    !/^[0-9a-f]{128}$/i.test(expectedHex)
  ) {
    return false;
  }

  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 64);

  return crypto.timingSafeEqual(actual, Buffer.from(expectedHex, "hex"));
}
function hashPlayerPassword(password) {
  const salt = crypto.randomBytes(16);

  const hash = crypto.scryptSync(password, salt, 64);

  return salt.toString("hex") + ":" + hash.toString("hex");
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
        accountId,
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
        isGuest: accountId == null,
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

    // Register a permanent player account
    if (u.pathname === "/account/register" && req.method === "POST") {
      if (!db) {
        return send(
          res,
          { error: "Account registration is unavailable." },
          503,
        );
      }

      const username = String(b.username || "").trim();

      const email = String(b.email || "")
        .trim()
        .toLowerCase();

      const password = b.password;

      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        return send(
          res,
          {
            error: "Username must be 3–20 letters, numbers, or underscores.",
          },
          400,
        );
      }

      if (
        typeof password !== "string" ||
        password.length < 12 ||
        password.length > 128
      ) {
        return send(
          res,
          {
            error: "Password must be between 12 and 128 characters.",
          },
          400,
        );
      }
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        const id = crypto.randomUUID();
        const passwordHash = hashPlayerPassword(password);

        const verificationToken = crypto.randomBytes(32).toString("hex");
        const verificationTokenHash = crypto
          .createHash("sha256")
          .update(verificationToken)
          .digest("hex");

        const verificationExpiresAt = new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        );

        await client.query(
          `INSERT INTO player_accounts (id, username, email, password_hash)
   VALUES ($1, $2, $3, $4)`,
          [id, username, email, passwordHash],
        );

        await client.query(
          `INSERT INTO email_verification_tokens
   (account_id, token_hash, expires_at)
   VALUES ($1, $2, $3)`,
          [id, verificationTokenHash, verificationExpiresAt],
        );
        await client.query("COMMIT");
        const verificationLink = createEmailVerificationLink(verificationToken);
        try {
          await sendRatSocietyEmail(
            email,
            "🐭 Verify your Rat Society email address",
            `Welcome to Rat Society! 🧀

Thanks for joining our little rat community!

Please verify your email address by visiting this link:

${verificationLink}

This link expires in 24 hours.

If you didn't create a Rat Society account, you can ignore this email.

— The Rat Society Team 🐭`,
          );
        } catch (emailError) {
          console.error("Registration verification email failed:", emailError);
        }
        return send(res, {
          success: true,
          emailVerificationRequired: true,
          message: "Account created. Please verify your email address.",
        });
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Registration rollback failed:", rollbackError);
        }
        if (error.code === "23505") {
          if (error.constraint === "player_accounts_email_unique") {
            return send(res, { error: "Email already registered." }, 409);
          }

          return send(res, { error: "Username already taken." }, 409);
        }

        console.error("Account registration failed:", error);
        return send(res, { error: "Registration failed." }, 500);
      } finally {
        client.release();
      }
    }
    /* Resend a Rat Society email verification link */
    if (
      u.pathname === "/account/resend-verification" &&
      req.method === "POST"
    ) {
      if (!db) {
        return send(res, { error: "Database unavailable." }, 503);
      }

      const email = String(b.email ?? "")
        .trim()
        .toLowerCase();

      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return send(res, { error: "Please enter a valid email address." }, 400);
      }
      // Limit repeated email verification requests
      const requestIp = getRequestIp(req);

      if (!allowEmailVerificationRequest(requestIp)) {
        return send(
          res,
          {
            error:
              "Too many verification requests. Please try again in 15 minutes.",
          },
          429,
        );
      }
      // Also limit requests targeting the same email address
      if (!allowEmailVerificationEmailRequest(email)) {
        return send(
          res,
          {
            error:
              "Too many verification requests. Please try again in 15 minutes.",
          },
          429,
        );
      }
      try {
        const accountResult = await db.query(
          `SELECT id, email_verified
   FROM player_accounts
   WHERE email = $1`,
          [email],
        );

        const account = accountResult.rows[0];
        // Use the same response for unknown and already-verified accounts
        const genericResponse = {
          success: true,
          message:
            "If this email belongs to an unverified Rat Society account, a verification link will be sent.",
        };

        if (!account || account.email_verified === true) {
          return send(res, genericResponse);
        }
        // Generate a secure replacement email verification token
        const verificationToken = crypto.randomBytes(32).toString("hex");

        const verificationTokenHash = crypto
          .createHash("sha256")
          .update(verificationToken)
          .digest("hex");

        const verificationExpiresAt = new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        );
        const client = await db.connect();

        try {
          await client.query("BEGIN");
          // Invalidate previous verification tokens for this account
          await client.query(
            `UPDATE email_verification_tokens
   SET used_at = NOW()
   WHERE account_id = $1
     AND used_at IS NULL`,
            [account.id],
          );
          // Store the replacement verification token
          await client.query(
            `INSERT INTO email_verification_tokens
   (account_id, token_hash, expires_at)
   VALUES ($1, $2, $3)`,
            [account.id, verificationTokenHash, verificationExpiresAt],
          );
          await client.query("COMMIT");
        } catch (transactionError) {
          try {
            await client.query("ROLLBACK");
          } catch (rollbackError) {
            console.error("Verification token rollback failed:", rollbackError);
          }

          throw transactionError;
        } finally {
          client.release();
        }
        // Create the replacement verification link
        const verificationLink = createEmailVerificationLink(verificationToken);

        try {
          await sendRatSocietyEmail(
            email,
            "🐭 Verify your Rat Society email address",
            `Hello, fellow rat! 🧀

You requested another email verification link for Rat Society.

Click or copy this link to verify your email address:

${verificationLink}

This link expires in 24 hours.

If you didn't request this email, you can safely ignore it.

— The Rat Society Team 🐭`,
          );
        } catch (emailError) {
          console.error("Resend verification email failed:", emailError);
        }
        return send(res, genericResponse);
      } catch (error) {
        console.error("Resend verification request failed:", error);

        return send(
          res,
          {
            error: "Unable to process verification request. Please try again.",
          },
          500,
        );
      }
    }

    /* Verify a Rat Society account email address */
    if (u.pathname === "/account/verify-email" && req.method === "POST") {
      if (!db) {
        return send(res, { error: "Database unavailable." }, 503);
      }

      const token = String(b?.token ?? "").trim();

      if (!/^[a-f0-9]{64}$/i.test(token)) {
        return send(
          res,
          {
            error: "Invalid email verification token.",
          },
          400,
        );
      }

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const client = await db.connect();

      try {
        await client.query("BEGIN");

        const result = await client.query(
          `SELECT account_id
     FROM email_verification_tokens
     WHERE token_hash = $1
       AND used_at IS NULL
       AND expires_at > NOW()
     FOR UPDATE`,
          [tokenHash],
        );
        if (result.rows.length === 0) {
          await client.query("ROLLBACK");

          return send(
            res,
            { error: "This verification link is invalid or expired." },
            400,
          );
        }
        const accountId = result.rows[0].account_id;

        await client.query(
          `UPDATE player_accounts
   SET email_verified = TRUE
   WHERE id = $1`,
          [accountId],
        );
        // Mark all outstanding verification tokens for this account as used
        await client.query(
          `UPDATE email_verification_tokens
   SET used_at = NOW()
   WHERE account_id = $1
     AND used_at IS NULL`,
          [accountId],
        );
        await client.query("COMMIT");

        return send(res, {
          success: true,
          message: "Email verified successfully! You can now log in.",
        });
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Email verification rollback failed:", rollbackError);
        }

        console.error("Email verification failed:", error);

        return send(
          res,
          { error: "Email verification failed. Please try again." },
          500,
        );
      } finally {
        client.release();
      }
    }
    /* Log out and invalidate an account session */
    if (u.pathname === "/account/logout" && req.method === "POST") {
      if (typeof b.token === "string" && b.token) {
        playerSessions.delete(b.token);
      }

      return send(res, { success: true });
    }

    /* Verify an existing Cheese Plaza account session */
    if (u.pathname === "/account/session" && req.method === "POST") {
      const accountSession = getPlayerSession(b.token);

      if (!accountSession) {
        return send(res, { authenticated: false }, 401);
      }

      return send(res, {
        authenticated: true,
        username: accountSession.username,
      });
    }
    // Temporary safety lock until currency management is fully tested
    if (process.env.ENABLE_CURRENCY_MANAGER !== "true") {
      return send(
        res,
        { error: "Currency management is not enabled yet." },
        503,
      );
    }
    // Admin currency management — registered accounts only
    if (u.pathname === "/account/manage-cheese" && req.method === "POST") {
      // Verify that the request comes from the authenticated soower account
      if (!canManagePlayerCurrency(b.token)) {
        return send(res, { error: "Not authorized." }, 403);
      }

      // Require database access
      if (!db) {
        return send(res, { error: "Database unavailable." }, 503);
      }
      // Validate the requested currency adjustment
      const amount = b.amount;
      const action = b.action;

      if (
        !Number.isSafeInteger(amount) ||
        amount < 1 ||
        amount > 1000000 ||
        !["give", "take"].includes(action)
      ) {
        return send(res, { error: "Invalid currency adjustment." }, 400);
      }

      // Find the selected player securely on the server
      let targetPlayer = null;

      for (const room of rooms.values()) {
        const player = room.players.get(b.targetPlayerId);

        if (player) {
          targetPlayer = player;
          break;
        }
      }

      // Only registered players can receive persistent balance changes
      if (!targetPlayer?.accountId) {
        return send(
          res,
          { error: "Target player is not online or is a guest." },
          400,
        );
      }
      // Calculate the balance adjustment
      const change = action === "give" ? amount : -amount;

      try {
        // Update the balance atomically to prevent negative balances
        const result = await db.query(
          `UPDATE player_accounts
   SET cheese_balance = cheese_balance + $1
   WHERE id = $2
     AND id <> $3
     AND cheese_balance + $1 BETWEEN 0 AND 2147483647
   RETURNING username, cheese_balance`,
          [change, targetPlayer.accountId, getPlayerSession(b.token).accountId],
        );

        if (result.rows.length === 0) {
          return send(
            res,
            {
              error:
                "Player not found, insufficient Cheese, or balance limit reached.",
            },
            400,
          );
        }

        return send(res, {
          success: true,
          username: result.rows[0].username,
          cheese_balance: result.rows[0].cheese_balance,
        });
      } catch (error) {
        console.error("Admin currency update failed:", error);
        return send(res, { error: "Currency update failed." }, 500);
      }
    }
    // Check whether the current account can manage player currency
    if (
      u.pathname === "/account/currency-permission" &&
      req.method === "POST"
    ) {
      const allowed = canManagePlayerCurrency(b.token);

      return send(res, {
        canManageCurrency: allowed,
      });
    }
    /* Reset a Rat Society account password */
    if (u.pathname === "/account/reset-password" && req.method === "POST") {
      // Keep password resets disabled outside testing mode
      if (process.env.PASSWORD_RESET_TESTING !== "true") {
        return send(
          res,
          {
            error: "Password recovery is temporarily unavailable.",
          },
          503,
        );
      }

      if (!db) {
        return send(res, { error: "Password reset is unavailable." }, 503);
      }

      const token = b.token;
      const newPassword = b.password;

      if (
        typeof token !== "string" ||
        !/^[a-f0-9]{64}$/i.test(token) ||
        typeof newPassword !== "string" ||
        newPassword.length < 12 ||
        newPassword.length > 128
      ) {
        return send(res, { error: "Invalid reset request." }, 400);
      }

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      const client = await db.connect();

      try {
        await client.query("BEGIN");

        // Lock the reset token to prevent simultaneous reuse
        const result = await client.query(
          `SELECT account_id
       FROM password_reset_tokens
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > NOW()
       FOR UPDATE`,
          [tokenHash],
        );

        if (result.rows.length === 0) {
          await client.query("ROLLBACK");
          return send(
            res,
            {
              error: "This reset link is invalid or expired.",
            },
            400,
          );
        }

        const accountId = result.rows[0].account_id;
        const passwordHash = hashPlayerPassword(newPassword);

        await client.query(
          `UPDATE player_accounts
       SET password_hash = $1
       WHERE id = $2`,
          [passwordHash, accountId],
        );

        // Invalidate all outstanding reset links for this account
        await client.query(
          `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE account_id = $1 AND used_at IS NULL`,
          [accountId],
        );

        await client.query("COMMIT");

        // Invalidate existing in-memory login sessions
        for (const [sessionToken, playerSession] of playerSessions) {
          if (playerSession.accountId === accountId) {
            playerSessions.delete(sessionToken);
          }
        }

        return send(res, {
          success: true,
          message: "Password updated. You can now log in.",
        });
      } catch (error) {
        await client.query("ROLLBACK");
        console.error("Password reset failed:", error);
        return send(res, { error: "Password reset failed." }, 500);
      } finally {
        client.release();
      }
    }

    /* Request a Cheese Plaza password reset */
    if (u.pathname === "/account/forgot-password" && req.method === "POST") {
      // Keep password recovery disabled until testing is enabled
      if (process.env.PASSWORD_RESET_TESTING !== "true") {
        return send(
          res,
          {
            error: "Password recovery is temporarily unavailable.",
          },
          503,
        );
      }

      // Standard response that does not reveal account existence
      const resetRequestResponse = {
        success: true,
        message:
          "If an account exists with that email, reset instructions will be sent.",
      };

      /* Identify requests without trusting user-supplied IP headers */
      const clientIp = req.socket.remoteAddress || "unknown";

      // Limit requests without revealing whether an account exists
      if (!allowPasswordResetRequest(clientIp)) {
        return send(res, resetRequestResponse);
      }

      const email = String(b.email || "")
        .trim()
        .toLowerCase();

      if (!email || email.length > 254) {
        return send(res, { error: "Please enter a valid email address." }, 400);
      }
      try {
        // Look up the account associated with this email
        if (db) {
          const result = await db.query(
            "SELECT id FROM player_accounts WHERE email = $1",
            [email],
          );

          if (result.rows.length > 0) {
            // Generate a secure token for the registered account

            // Allow one password reset request every 5 minutes
            const recentReset = await db.query(
              `SELECT 1
         FROM password_reset_tokens
         WHERE account_id = $1
           AND created_at > NOW() - INTERVAL '5 minutes'
         LIMIT 1`,
              [result.rows[0].id],
            );

            if (recentReset.rows.length > 0) {
              return send(res, resetRequestResponse);
            }

            const { token, tokenHash } = generatePasswordResetToken();

            // Store only the hash, with a 30-minute expiration
            await db.query(
              `INSERT INTO password_reset_tokens
         (id, account_id, token_hash, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '30 minutes')`,
              [crypto.randomUUID(), result.rows[0].id, tokenHash],
            );

            // Build the secure password reset link
            const resetLink = createPasswordResetLink(token);

            // Email the reset link to the registered account

            try {
              await sendRatSocietyEmail(
                email,
                "Reset your Rat Society password",
                `Someone requested a password reset for your Rat Society account.

Use this link to create a new password:

${resetLink}

This link expires in 30 minutes and can only be used once.

If you did not request this, you can ignore this email.`,
              );
            } catch (error) {
              // Remove the unused token if email delivery fails
              try {
                await db.query(
                  "DELETE FROM password_reset_tokens WHERE token_hash = $1",
                  [tokenHash],
                );
              } catch {
                console.error("Failed to clean up undelivered reset token.");
              }

              // Never log the email address, token, or reset link
              console.error("Password reset email delivery failed.");
            }
          }
        }
      } catch (error) {
        console.error("Password recovery database operation failed.");
        return send(
          res,
          {
            error: "Password recovery is temporarily unavailable.",
          },
          503,
        );
      }

      // Do not reveal whether an email address is registered
      return send(res, resetRequestResponse);
    }

    // Authenticate a returning player
    if (u.pathname === "/account/login" && req.method === "POST") {
      if (!db) {
        return send(res, { error: "Account login is unavailable." }, 503);
      }

      const username = String(b.username || "").trim();
      const password = b.password;

      if (
        typeof password !== "string" ||
        !/^[a-zA-Z0-9_]{3,20}$/.test(username)
      ) {
        return send(res, { error: "Invalid credentials." }, 401);
      }

      try {
        const result = await db.query(
          `SELECT id, username, password_hash, cheese_balance, email_verified
 FROM player_accounts
 WHERE username = $1`,
          [username],
        );

        const account = result.rows[0];

        if (
          !account ||
          !verifyPlayerPassword(password, account.password_hash)
        ) {
          return send(res, { error: "Invalid credentials." }, 401);
        }
        // Require email verification before allowing login
        if (account.email_verified !== true) {
          return send(
            res,
            {
              error: "Please verify your email address before logging in.",
              emailVerificationRequired: true,
            },
            403,
          );
        }
        // Create a secure session for this player
        const token = crypto.randomBytes(32).toString("hex");

        playerSessions.set(token, {
          accountId: account.id,
          username: account.username,
          createdAt: Date.now(),
        });

        return send(res, {
          success: true,
          token,
          account: {
            id: account.id,
            username: account.username,
            cheese_balance: account.cheese_balance,
          },
        });
      } catch (error) {
        console.error("Account login failed:", error.message);
        return send(res, { error: "Login failed." }, 500);
      }
    }

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

    /* List active Cheese Plaza rooms */
    if (u.pathname === "/rooms" && req.method === "POST") {
      const activeRooms = [...rooms.entries()]
        .filter(([code, room]) => code === "PLAZA" || room.players.size > 0)
        .map(([code, room]) => ({
          code,
          players: room.players.size,
        }));

      // Always include PLAZA, even when nobody is online
      if (!activeRooms.some((room) => room.code === "PLAZA")) {
        activeRooms.push({ code: "PLAZA", players: 0 });
      }

      // Keep PLAZA at the top of the list
      activeRooms.sort((a, b) =>
        a.code === "PLAZA"
          ? -1
          : b.code === "PLAZA"
            ? 1
            : b.players - a.players,
      );

      return send(res, { rooms: activeRooms });
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

      // Identify a player using their authenticated account session
      const accountSession = getPlayerSession(b.accountToken);
      const accountId = accountSession?.accountId ?? null;

      const id = crypto.randomUUID();
      // Temporary account identifier (not yet authenticated)

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
    console.error("Request failed:", {
      path: u.pathname,
      message: e.message,
      code: e.code,
    });

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
