const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");
const { seedData } = require("./seed-data");

const configuredDbPath = process.env.PRAKTIJKOS_DB_PATH ? path.resolve(process.env.PRAKTIJKOS_DB_PATH) : null;
const dataDir = configuredDbPath ? path.dirname(configuredDbPath) : path.resolve(__dirname, "..", "data");
const dbPath = configuredDbPath || path.join(dataDir, "praktijkos.sqlite");

const collections = [
  "team",
  "intakes",
  "notes",
  "messages",
  "portalInvites",
  "documents",
  "accessOverrides",
  "retentionPolicies",
  "knowledgeBase",
  "aiModels",
  "aiModelEvaluations",
  "voiceConsents",
  "peppolPreparations",
  "paymentRequests",
  "integrationReadiness",
  "isoEvidencePacks",
  "saasInvoices",
  "saasUsageLedger",
  "saasPlanChanges",
  "saasOnboardingChecklist",
  "saasFeatureEntitlements",
  "saasAdminActivity",
  "saasSupportQueue",
  "waitlist",
  "workQueue",
  "dayClose",
  "importRuns",
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

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      age INTEGER NOT NULL DEFAULT 0,
      track TEXT NOT NULL,
      status TEXT NOT NULL,
      clinician TEXT NOT NULL,
      next_appointment TEXT NOT NULL,
      admin_status TEXT NOT NULL,
      ai_suggestion TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      time TEXT NOT NULL,
      type TEXT NOT NULL,
      clinician TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL,
      signal TEXT NOT NULL,
      ai_hint TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      appointment_id TEXT,
      client_name TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      issued_at TEXT,
      due_at TEXT,
      paid_at TEXT,
      reminder_sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
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

  seedCollectionIfEmpty("waitlist");
  seedCollectionIfEmpty("dayClose");
  seedCollectionIfEmpty("retentionPolicies");
  seedCollectionIfEmpty("knowledgeBase");
  seedCollectionIfEmpty("aiModels");
  seedCollectionIfEmpty("aiModelEvaluations");
  seedCollectionIfEmpty("voiceConsents");
  seedCollectionIfEmpty("peppolPreparations");
  seedCollectionIfEmpty("paymentRequests");
  seedCollectionIfEmpty("integrationReadiness");
  seedCollectionIfEmpty("isoEvidencePacks");
  seedCollectionIfEmpty("saasInvoices");
  seedCollectionIfEmpty("saasUsageLedger");
  seedCollectionIfEmpty("saasPlanChanges");
  seedCollectionIfEmpty("saasOnboardingChecklist");
  seedCollectionIfEmpty("saasFeatureEntitlements");
  seedCollectionIfEmpty("saasAdminActivity");
  seedCollectionIfEmpty("saasSupportQueue");
  seedRelationalTables();
  seedInvoicesTable();

  ensureSeedUser("usr-admin", "admin@praktijkos.local", "Praktijkhouder", "Praktijkhouder");
  ensureSeedUser("usr-care", "zorg@praktijkos.local", "Zorgverlener", "Zorgverlener");
  ensureSeedUser("usr-admin-office", "onthaal@praktijkos.local", "Onthaal", "Administratie");
}

function seedCollectionIfEmpty(collection) {
  const instance = db;
  const count = instance.prepare("SELECT COUNT(*) AS count FROM records WHERE collection = ?").get(collection).count;
  if (count > 0) return;

  const insert = instance.prepare("INSERT INTO records(collection, id, data) VALUES(?, ?, ?)");
  (seedData[collection] || []).forEach((item) => {
    insert.run(collection, item.id, JSON.stringify(item));
  });
}

function seedInvoicesTable() {
  const instance = db;
  const invoicesCount = instance.prepare("SELECT COUNT(*) AS count FROM invoices").get().count;
  if (invoicesCount > 0) return;

  const legacyInvoices = readCollection("invoices");
  const sourceInvoices = legacyInvoices.length ? legacyInvoices : seedData.invoices;
  replaceInvoices(sourceInvoices);
}

function ensureSeedUser(id, email, name, role) {
  const instance = db;
  const existing = instance.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return;

  const salt = crypto.randomBytes(16).toString("hex");
  instance
    .prepare("INSERT INTO users(id, email, name, role, password_hash, salt) VALUES(?, ?, ?, ?, ?, ?)")
    .run(id, email, name, role, hashPassword("praktijkos", salt), salt);
}

function seedRelationalTables() {
  const instance = db;
  const clientsCount = instance.prepare("SELECT COUNT(*) AS count FROM clients").get().count;
  if (clientsCount === 0) {
    const legacyClients = readCollection("clients");
    const sourceClients = legacyClients.length ? legacyClients : seedData.clients;
    const insertClient = instance.prepare(`
      INSERT INTO clients(id, name, age, track, status, clinician, next_appointment, admin_status, ai_suggestion)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    sourceClients.forEach((client) => {
      insertClient.run(
        client.id,
        client.name,
        Number(client.age || 0),
        client.track,
        client.status,
        client.clinician,
        client.nextAppointment,
        client.adminStatus,
        client.aiSuggestion
      );
    });
  }

  const appointmentsCount = instance.prepare("SELECT COUNT(*) AS count FROM appointments").get().count;
  if (appointmentsCount === 0) {
    const legacyAppointments = readCollection("appointments");
    const sourceAppointments = legacyAppointments.length ? legacyAppointments : seedData.appointments;
    const insertAppointment = instance.prepare(`
      INSERT INTO appointments(id, client_id, time, type, clinician, location, status, signal, ai_hint)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    sourceAppointments.forEach((appointment) => {
      insertAppointment.run(
        appointment.id,
        appointment.clientId,
        appointment.time,
        appointment.type,
        appointment.clinician,
        appointment.location,
        appointment.status,
        appointment.signal,
        appointment.aiHint
      );
    });
  }
}

function readClients() {
  return database()
    .prepare(`
      SELECT id, name, age, track, status, clinician, next_appointment, admin_status, ai_suggestion
      FROM clients
      ORDER BY created_at DESC
    `)
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      age: row.age,
      track: row.track,
      status: row.status,
      clinician: row.clinician,
      nextAppointment: row.next_appointment,
      adminStatus: row.admin_status,
      aiSuggestion: row.ai_suggestion
    }));
}

function readAppointments() {
  return database()
    .prepare(`
      SELECT appointments.id, appointments.client_id, clients.name AS client, appointments.time, appointments.type,
             appointments.clinician, appointments.location, appointments.status, appointments.signal, appointments.ai_hint
      FROM appointments
      JOIN clients ON clients.id = appointments.client_id
      ORDER BY appointments.time ASC
    `)
    .all()
    .map((row) => ({
      id: row.id,
      clientId: row.client_id,
      client: row.client,
      time: row.time,
      type: row.type,
      clinician: row.clinician,
      location: row.location,
      status: row.status,
      signal: row.signal,
      aiHint: row.ai_hint
    }));
}

function readInvoices() {
  return database()
    .prepare(`
      SELECT invoices.id, invoices.client_id, invoices.appointment_id,
             COALESCE(clients.name, invoices.client_name) AS client,
             invoices.amount, invoices.channel, invoices.status,
             invoices.issued_at, invoices.due_at, invoices.paid_at, invoices.reminder_sent_at
      FROM invoices
      LEFT JOIN clients ON clients.id = invoices.client_id
      ORDER BY invoices.created_at DESC
    `)
    .all()
    .map((row) => ({
      id: row.id,
      clientId: row.client_id,
      appointmentId: row.appointment_id,
      client: row.client,
      amount: Number(row.amount || 0),
      channel: row.channel,
      status: row.status,
      issuedAt: row.issued_at,
      dueAt: row.due_at,
      paidAt: row.paid_at,
      reminderSentAt: row.reminder_sent_at
    }));
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
  store.clients = readClients();
  store.appointments = readAppointments();
  store.invoices = readInvoices();
  store.workQueue = (store.workQueue || []).map((task) => normalizeTask(task, store.clients));

  return store;
}

function normalizeTask(task, clients = []) {
  if (task.action && task.category && task.dueAt) return task;

  const label = `${task.label || ""}`.toLowerCase();
  const clientExists = (id) => clients.some((client) => client.id === id);
  let fallback = {
    category: "Praktijk",
    dueAt: task.priority === "Hoog" ? "Vandaag" : "Deze week",
    action: "review"
  };

  if (label.includes("factuur")) {
    fallback = { category: "Facturatie", dueAt: "Vandaag", action: "billing" };
  } else if (label.includes("sessienota")) {
    fallback = { category: "Dossier", dueAt: "Vandaag", action: "ai-note", clientId: clientExists("cl-002") ? "cl-002" : task.clientId };
  } else if (label.includes("doorverwijs")) {
    fallback = { category: "Dossier", dueAt: "Morgen", action: "letter", clientId: clientExists("cl-001") ? "cl-001" : task.clientId };
  } else if (label.includes("no-show")) {
    fallback = { category: "Opvolging", dueAt: "Vandaag", action: "message", clientId: clientExists("cl-004") ? "cl-004" : task.clientId };
  }

  return {
    ...fallback,
    description: task.description || task.label || "Taak opvolgen.",
    ...task
  };
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

    replaceClients(nextStore.clients || []);
    replaceAppointments(nextStore.appointments || []);
    replaceInvoices(nextStore.invoices || []);

    instance.exec("COMMIT");
  } catch (error) {
    instance.exec("ROLLBACK");
    throw error;
  }

  return readStore();
}

function clientIdForInvoice(invoice) {
  if (invoice.clientId) return invoice.clientId;
  const row = database().prepare("SELECT id FROM clients WHERE name = ?").get(invoice.client);
  return row?.id || null;
}

function replaceInvoices(rows) {
  const instance = database();
  instance.prepare("DELETE FROM invoices").run();
  const insertInvoice = instance.prepare(`
    INSERT INTO invoices(id, client_id, appointment_id, client_name, amount, channel, status, issued_at, due_at, paid_at, reminder_sent_at, updated_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  rows.forEach((invoice) => {
    insertInvoice.run(
      invoice.id,
      clientIdForInvoice(invoice),
      invoice.appointmentId || null,
      invoice.client || "Onbekende client",
      Number(invoice.amount || 0),
      invoice.channel || "Bancontact",
      invoice.status || "Voorstel",
      invoice.issuedAt || null,
      invoice.dueAt || null,
      invoice.paidAt || null,
      invoice.reminderSentAt || null
    );
  });
}

function replaceClients(rows) {
  const instance = database();
  instance.prepare("DELETE FROM appointments").run();
  instance.prepare("DELETE FROM clients").run();
  const insertClient = instance.prepare(`
    INSERT INTO clients(id, name, age, track, status, clinician, next_appointment, admin_status, ai_suggestion, updated_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  rows.forEach((client) => {
    insertClient.run(
      client.id,
      client.name,
      Number(client.age || 0),
      client.track,
      client.status,
      client.clinician,
      client.nextAppointment,
      client.adminStatus,
      client.aiSuggestion
    );
  });
}

function replaceAppointments(rows) {
  const instance = database();
  const insertAppointment = instance.prepare(`
    INSERT INTO appointments(id, client_id, time, type, clinician, location, status, signal, ai_hint, updated_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  rows.forEach((appointment) => {
    insertAppointment.run(
      appointment.id,
      appointment.clientId,
      appointment.time,
      appointment.type,
      appointment.clinician,
      appointment.location,
      appointment.status,
      appointment.signal,
      appointment.aiHint
    );
  });
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
