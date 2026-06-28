const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");
const { seedData } = require("./seed-data");

const dataDir = path.resolve(__dirname, "..", "data");
const dbPath = path.join(dataDir, "praktijkos.sqlite");

const collections = [
  "team",
  "intakes",
  "messages",
  "documents",
  "appointments",
  "clients",
  "invoices",
  "workQueue",
  "aiDrafts",
  "auditLog"
];

let db;

function database() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!db) {
    db = new DatabaseSync(dbPath);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    migrate();
    seedIfEmpty();
  }

  return db;
}

function migrate() {
  const instance = db;
  instance.exec(`
    CREATE TABLE IF NOT EXISTS practice (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS records (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (collection, id)
    );

    CREATE INDEX IF NOT EXISTS idx_records_collection ON records(collection);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  `);
}

function seedIfEmpty() {
  const instance = db;
  const row = instance.prepare("SELECT COUNT(*) AS count FROM records").get();
  const practice = instance.prepare("SELECT data FROM practice WHERE id = ?").get("main");

  if (!practice) {
    instance.prepare("INSERT INTO practice(id, data) VALUES(?, ?)").run("main", JSON.stringify(seedData.practice));
  }

  if (row.count === 0) {
    const insert = instance.prepare("INSERT INTO records(collection, id, data) VALUES(?, ?, ?)");

    instance.exec("BEGIN");
    try {
      collections.forEach((collection) => {
        (seedData[collection] || []).forEach((item) => {
          insert.run(collection, item.id, JSON.stringify(item));
        });
      });
      instance.exec("COMMIT");
    } catch (error) {
      instance.exec("ROLLBACK");
      throw error;
    }
  }

  const users = instance.prepare("SELECT COUNT(*) AS count FROM users").get();
  if (users.count === 0) {
    const salt = crypto.randomBytes(16).toString("hex");
    instance
      .prepare("INSERT INTO users(id, email, name, role, password_hash, salt) VALUES(?, ?, ?, ?, ?, ?)")
      .run(
        "usr-admin",
        "admin@praktijkos.local",
        "Praktijkhouder",
        "Praktijkhouder",
        hashPassword("praktijkos", salt),
        salt
      );
  }
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  };
}

function verifyUser(email, password) {
  const user = database().prepare("SELECT * FROM users WHERE email = ?").get(String(email || "").toLowerCase());
  if (!user || !password) return null;

  const candidate = Buffer.from(hashPassword(password, user.salt), "hex");
  const expected = Buffer.from(user.password_hash, "hex");
  if (candidate.length !== expected.length || !crypto.timingSafeEqual(candidate, expected)) {
    return null;
  }

  return publicUser(user);
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + 1000 * 60 * 60 * 12;
  database()
    .prepare("INSERT INTO sessions(token, user_id, expires_at) VALUES(?, ?, ?)")
    .run(token, userId, expiresAt);
  return { token, expiresAt };
}

function getSession(token) {
  if (!token) return null;
  const row = database()
    .prepare(`
      SELECT users.id, users.email, users.name, users.role, sessions.expires_at
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token = ?
    `)
    .get(token);

  if (!row) return null;
  if (row.expires_at < Date.now()) {
    deleteSession(token);
    return null;
  }

  return publicUser(row);
}

function deleteSession(token) {
  if (!token) return;
  database().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

function readCollection(collection) {
  return database()
    .prepare("SELECT data FROM records WHERE collection = ? ORDER BY created_at DESC")
    .all(collection)
    .map((row) => JSON.parse(row.data));
}

function readStore() {
  const instance = database();
  const practiceRow = instance.prepare("SELECT data FROM practice WHERE id = ?").get("main");
  const store = {
    ...seedData,
    practice: practiceRow ? { ...seedData.practice, ...JSON.parse(practiceRow.data) } : seedData.practice
  };

  collections.forEach((collection) => {
    store[collection] = readCollection(collection);
  });

  return store;
}

function replaceCollection(collection, rows) {
  const instance = database();
  const deleteCollection = instance.prepare("DELETE FROM records WHERE collection = ?");
  const insertRecord = instance.prepare(`
    INSERT INTO records(collection, id, data, updated_at)
    VALUES(?, ?, ?, CURRENT_TIMESTAMP)
  `);

  deleteCollection.run(collection);
  rows.forEach((row) => {
    insertRecord.run(collection, row.id, JSON.stringify(row));
  });
}

function writeStore(nextStore) {
  const instance = database();
  instance.exec("BEGIN");
  try {
    instance
      .prepare(`
        INSERT INTO practice(id, data, updated_at)
        VALUES(?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
      `)
      .run("main", JSON.stringify(nextStore.practice || seedData.practice));

    collections.forEach((collection) => {
      replaceCollection(collection, nextStore[collection] || []);
    });

    instance.exec("COMMIT");
  } catch (error) {
    instance.exec("ROLLBACK");
    throw error;
  }

  return readStore();
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function nowLabel() {
  return new Intl.DateTimeFormat("nl-BE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

function appendAudit(store, event, detail, actor = "PraktijkOS") {
  return {
    ...store,
    auditLog: [
      {
        id: uid("audit"),
        at: nowLabel(),
        actor: actor.includes("API") ? "PraktijkOS" : actor,
        event,
        detail
      },
      ...store.auditLog
    ].slice(0, 100)
  };
}

module.exports = {
  appendAudit,
  dbPath,
  createSession,
  deleteSession,
  getSession,
  readStore,
  uid,
  verifyUser,
  writeStore
};
