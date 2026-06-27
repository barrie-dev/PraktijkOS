const fs = require("fs");
const path = require("path");
const { seedData } = require("./seed-data");

const dataDir = path.resolve(__dirname, "..", "data");
const dbPath = path.join(dataDir, "dev-db.json");

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(seedData, null, 2));
  }
}

function readStore() {
  ensureDataFile();
  return { ...seedData, ...JSON.parse(fs.readFileSync(dbPath, "utf8")) };
}

function writeStore(nextStore) {
  ensureDataFile();
  fs.writeFileSync(dbPath, JSON.stringify(nextStore, null, 2));
  return nextStore;
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

function appendAudit(store, event, detail, actor = "PraktijkOS API") {
  return {
    ...store,
    auditLog: [
      {
        id: uid("audit"),
        at: nowLabel(),
        actor,
        event,
        detail
      },
      ...store.auditLog
    ].slice(0, 100)
  };
}

module.exports = {
  appendAudit,
  readStore,
  uid,
  writeStore
};
