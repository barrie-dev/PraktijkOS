const fs = require("fs");
const path = require("path");
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
    practice: practiceRow ? JSON.parse(practiceRow.data) : seedData.practice
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
  readStore,
  uid,
  writeStore
};
