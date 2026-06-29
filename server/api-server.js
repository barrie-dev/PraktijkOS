const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  appendAudit,
  createSession,
  deleteSession,
  getSession,
  readStore,
  uid,
  verifyUser,
  writeStore
} = require("./store");
const { generateDraft } = require("./ai-engine");

const root = path.resolve(__dirname, "..");
const port = Number(process.argv[2] || process.env.PORT || 8128);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body, null, 2));
}

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function sessionCookie(token, maxAgeSeconds) {
  return `praktijkos_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

function clearSessionCookie() {
  return "praktijkos_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

const permissionsByRole = {
  Praktijkhouder: ["practice", "team", "care", "scheduling", "billing", "ai", "tasks"],
  Zorgverlener: ["care", "scheduling", "ai", "tasks"],
  Administratie: ["scheduling", "billing", "tasks"]
};

function hasPermission(user, permission) {
  return Boolean(permissionsByRole[user.role]?.includes(permission));
}

function requirePermission(response, user, permission) {
  if (hasPermission(user, permission)) return true;
  sendJson(response, 403, { error: "Je hebt geen toegang tot deze actie." });
  return false;
}

function timestampLabel() {
  return new Intl.DateTimeFormat("nl-BE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

function nextRetentionReviewLabel(reviewCadence = "") {
  const cadence = reviewCadence.toLowerCase();
  if (cadence.includes("maand")) return "Volgende maand";
  if (cadence.includes("jaar")) return "Volgend jaar";
  if (cadence.includes("traject")) return "Bij trajectafsluiting";
  return "Volgende reviewronde";
}

function appointmentSignal(status) {
  if (["No-show risico", "Geannuleerd"].includes(status)) return "danger";
  if (["Intake ontbreekt", "Opvolging nodig"].includes(status)) return "warning";
  return "success";
}

function isBillableAppointment(appointment) {
  return ["Aanwezig", "Klaar voor facturatie"].includes(appointment.status);
}

function buildAnalytics(store) {
  const activeAppointments = store.appointments.filter((appointment) => appointment.status !== "Geannuleerd");
  const riskyAppointments = store.appointments.filter((appointment) => appointment.signal === "danger");
  const paidRevenue = store.invoices
    .filter((invoice) => invoice.status === "Betaald")
    .reduce((total, invoice) => total + Number(invoice.amount || 0), 0);
  const openRevenue = store.invoices
    .filter((invoice) => invoice.status !== "Betaald")
    .reduce((total, invoice) => total + Number(invoice.amount || 0), 0);
  const pendingIntakes = store.intakes.filter((intake) => intake.status !== "Ingediend").length;
  const openTasks = store.workQueue.filter((task) => (task.status || "Open") !== "Klaar").length;
  const reminderCount = store.invoices.filter((invoice) => invoice.status === "Herinnering").length;
  const capacitySlots = Math.max(8, store.appointments.length);

  return {
    occupancyRate: Math.round((activeAppointments.length / capacitySlots) * 100),
    noShowRisk: riskyAppointments.length,
    paidRevenue,
    openRevenue,
    adminBacklog: pendingIntakes + openTasks + reminderCount,
    activePortalAccesses: (store.portalInvites || []).filter((invite) => invite.status === "Actief" && Number(invite.expiresAt || 0) > Date.now()).length,
    billableAppointments: store.appointments.filter(isBillableAppointment).length
  };
}

function buildClientExport(store, clientId, user) {
  const client = store.clients.find((item) => item.id === clientId);
  if (!client) return null;

  return {
    exportedAt: new Date().toISOString(),
    exportedBy: {
      id: user.id,
      name: user.name,
      role: user.role
    },
    practice: {
      name: store.practice.name,
      language: store.practice.language,
      aiPolicy: store.practice.aiPolicy
    },
    client,
    records: {
      appointments: store.appointments.filter((item) => item.clientId === client.id),
      intakes: store.intakes.filter((item) => item.clientId === client.id),
      notes: (store.notes || []).filter((item) => item.clientId === client.id),
      messages: store.messages.filter((item) => item.clientId === client.id),
      documents: store.documents.filter((item) => item.clientId === client.id),
      invoices: store.invoices.filter((item) => item.clientId === client.id || item.client === client.name),
      portalInvites: (store.portalInvites || [])
        .filter((item) => item.clientId === client.id)
        .map(({ token, ...invite }) => invite)
    },
    audit: store.auditLog.filter((item) => `${item.detail || ""} ${item.event || ""}`.includes(client.name))
  };
}

function csvValue(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function auditMatchesFilter(entry, filter = "all") {
  if (!filter || filter === "all") return true;
  const text = `${entry.event || ""} ${entry.detail || ""}`.toLowerCase();
  const filters = {
    exports: ["export"],
    access: ["toegang", "dossiertoegang", "access"],
    ai: ["ai ", "ai-", "concept", "assistent"],
    retention: ["retentie", "retentiereview"],
    import: ["import", "migratie"],
    portal: ["portal", "portaal"],
    billing: ["factuur", "betaling", "boekhouder"]
  };
  return (filters[filter] || []).some((keyword) => text.includes(keyword));
}

function buildAuditExport(store, user, filter = "all") {
  const rows = (store.auditLog || []).filter((entry) => auditMatchesFilter(entry, filter));
  const csv = [
    ["tijdstip", "actor", "event", "detail"].map(csvValue).join(";"),
    ...rows.map((entry) => [
      entry.at,
      entry.actor,
      entry.event,
      entry.detail
    ].map(csvValue).join(";"))
  ].join("\n");

  return {
    exportedAt: new Date().toISOString(),
    exportedBy: {
      id: user.id,
      name: user.name,
      role: user.role
    },
    filter,
    summary: {
      totalEvents: store.auditLog.length,
      exportedEvents: rows.length
    },
    files: {
      csvFilename: `praktijkos-audit-${filter}.csv`,
      csv
    },
    rows
  };
}

function activeKnowledge(store) {
  return (store.knowledgeBase || []).filter((item) => item.status === "Actief");
}

function modelForWorkflow(store, workflow, modelId) {
  const activeModels = (store.aiModels || []).filter((model) => model.status === "Actief");
  return activeModels.find((model) => model.id === modelId)
    || activeModels.find((model) => (model.defaultFor || []).includes(workflow))
    || activeModels[0]
    || (store.aiModels || [])[0]
    || null;
}

function activeVoiceConsent(store, clientId) {
  return (store.voiceConsents || []).find((consent) => consent.clientId === clientId && consent.status === "Actief");
}

function buildBillingExport(store, user, options = {}) {
  const exportedAt = new Date().toISOString();
  const lines = store.invoices.map((invoice) => {
    const appointment = store.appointments.find((item) => item.id === invoice.appointmentId);
    return {
      invoiceId: invoice.id,
      clientId: invoice.clientId || "",
      client: invoice.client,
      amount: Number(invoice.amount || 0),
      channel: invoice.channel,
      status: invoice.status,
      issuedAt: invoice.issuedAt || "",
      dueAt: invoice.dueAt || "",
      paidAt: invoice.paidAt || "",
      appointmentId: invoice.appointmentId || "",
      appointmentType: appointment?.type || "",
      clinician: appointment?.clinician || ""
    };
  });

  const openLines = lines.filter((line) => line.status !== "Betaald");
  const paidLines = lines.filter((line) => line.status === "Betaald");
  const peppolLines = lines.filter((line) => line.channel === "Peppol");
  const headers = [
    "factuur_id",
    "client_id",
    "client",
    "bedrag",
    "kanaal",
    "status",
    "uitgegeven",
    "vervaldag",
    "betaald_op",
    "afspraak_id",
    "prestatie",
    "zorgverlener"
  ];
  const csvRows = [
    headers.map(csvValue).join(";"),
    ...lines.map((line) => [
      line.invoiceId,
      line.clientId,
      line.client,
      line.amount.toFixed(2).replace(".", ","),
      line.channel,
      line.status,
      line.issuedAt,
      line.dueAt,
      line.paidAt,
      line.appointmentId,
      line.appointmentType,
      line.clinician
    ].map(csvValue).join(";"))
  ];

  return {
    id: uid("billing-export"),
    exportedAt,
    period: options.period || "Huidige praktijkstand",
    exportedBy: {
      id: user.id,
      name: user.name,
      role: user.role
    },
    practice: {
      name: store.practice.name,
      language: store.practice.language
    },
    summary: {
      invoiceCount: lines.length,
      openCount: openLines.length,
      paidCount: paidLines.length,
      peppolCount: peppolLines.length,
      openAmount: openLines.reduce((total, line) => total + line.amount, 0),
      paidAmount: paidLines.reduce((total, line) => total + line.amount, 0)
    },
    accountantMessage: `${store.practice.name}: ${lines.length} facturen in export, ${openLines.length} openstaand en ${peppolLines.length} via Peppol.`,
    files: {
      csvFilename: "praktijkos-boekhouding.csv",
      jsonFilename: "praktijkos-boekhouding.json",
      csv: csvRows.join("\n")
    },
    lines
  };
}

function splitDelimitedLine(line, delimiter) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function parseDelimitedText(text = "") {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [], delimiter: ";" };

  const delimiter = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ";" : ",";
  const headers = splitDelimitedLine(lines[0], delimiter).map((header) => header.trim());
  const rows = lines.slice(1).map((line) => {
    const values = splitDelimitedLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
  return { headers, rows, delimiter };
}

function normalizeImportHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const importSchemas = {
  clients: {
    label: "Clienten",
    fields: {
      name: ["naam", "name", "client"],
      age: ["leeftijd", "age"],
      track: ["traject", "track", "zorgvraag"],
      status: ["status"],
      clinician: ["zorgverlener", "behandelaar", "clinician"],
      nextAppointment: ["volgendeafspraak", "nextappointment"]
    },
    required: ["name"]
  },
  appointments: {
    label: "Afspraken",
    fields: {
      client: ["client", "naam", "patient"],
      time: ["tijd", "time", "uur"],
      type: ["type", "afspraaktype", "prestatie"],
      clinician: ["zorgverlener", "behandelaar", "clinician"],
      location: ["locatie", "location", "plaats"],
      status: ["status"]
    },
    required: ["client", "time"]
  },
  invoices: {
    label: "Facturen",
    fields: {
      client: ["client", "naam", "patient"],
      amount: ["bedrag", "amount", "prijs"],
      channel: ["kanaal", "betaalmethode", "channel"],
      status: ["status"],
      dueAt: ["vervaldag", "dueat"]
    },
    required: ["client", "amount"]
  }
};

function headerMap(headers, schema) {
  const normalized = Object.fromEntries(headers.map((header) => [normalizeImportHeader(header), header]));
  return Object.fromEntries(Object.entries(schema.fields).map(([field, aliases]) => [
    field,
    aliases.map(normalizeImportHeader).map((alias) => normalized[alias]).find(Boolean) || ""
  ]));
}

function buildImportPreview(store, user, payload = {}) {
  const kind = importSchemas[payload.kind] ? payload.kind : "clients";
  const schema = importSchemas[kind];
  const parsed = parseDelimitedText(payload.csv);
  const map = headerMap(parsed.headers, schema);
  const missingHeaders = schema.required.filter((field) => !map[field]);
  const mappedRows = parsed.rows.slice(0, 100).map((row, index) => {
    const values = Object.fromEntries(Object.entries(map).map(([field, header]) => [field, header ? row[header] || "" : ""]));
    const issues = schema.required
      .filter((field) => !String(values[field] || "").trim())
      .map((field) => `${field} ontbreekt`);
    return { row: index + 1, values, issues };
  });
  const warnings = [
    ...(parsed.rows.length > 100 ? [`Alleen de eerste 100 van ${parsed.rows.length} rijen zijn geanalyseerd.`] : []),
    ...(missingHeaders.length ? [`Ontbrekende verplichte kolommen: ${missingHeaders.join(", ")}.`] : []),
    ...mappedRows.filter((row) => row.issues.length).slice(0, 5).map((row) => `Rij ${row.row}: ${row.issues.join(", ")}.`)
  ];

  return {
    id: uid("import"),
    kind,
    label: schema.label,
    createdAt: timestampLabel(),
    createdBy: user.name,
    delimiter: parsed.delimiter,
    rowCount: parsed.rows.length,
    headers: parsed.headers,
    mappedFields: map,
    requiredHeaders: schema.required,
    missingHeaders,
    warnings,
    mappedRows,
    suggestedAction: missingHeaders.length || warnings.length
      ? "Corrigeer kolommen of lege verplichte waarden voor je importeert."
      : "Preview is klaar voor gecontroleerde import in een volgende stap."
  };
}

function applyImportPreview(store, user, previewId) {
  const preview = (store.importRuns || []).find((run) => run.id === previewId);
  if (!preview) return null;

  const now = timestampLabel();
  const summary = {
    id: uid("import-apply"),
    previewId,
    kind: preview.kind,
    appliedAt: now,
    appliedBy: user.name,
    created: 0,
    skipped: 0,
    errors: [],
    records: []
  };

  let nextStore = { ...store };

  if (preview.kind === "clients") {
    const existingNames = new Set(store.clients.map((client) => client.name.toLowerCase()));
    const createdClients = [];
    preview.mappedRows.forEach((row) => {
      const name = String(row.values.name || "").trim();
      if (!name) {
        summary.skipped += 1;
        summary.errors.push(`Rij ${row.row}: naam ontbreekt.`);
        return;
      }
      if (existingNames.has(name.toLowerCase())) {
        summary.skipped += 1;
        summary.errors.push(`Rij ${row.row}: ${name} bestaat al.`);
        return;
      }
      existingNames.add(name.toLowerCase());
      const client = {
        id: uid("cl"),
        name,
        age: Number(row.values.age || 0),
        track: row.values.track || "Geimporteerd traject",
        status: row.values.status || "Intakefase",
        clinician: row.values.clinician || "Nog toe te wijzen",
        nextAppointment: row.values.nextAppointment || "Nog te plannen",
        adminStatus: "Geimporteerd uit preview",
        aiSuggestion: "Controleer migratiegegevens en vul ontbrekende dossierinformatie aan."
      };
      createdClients.push(client);
      summary.records.push({ collection: "clients", id: client.id, label: client.name });
    });
    summary.created = createdClients.length;
    nextStore = { ...nextStore, clients: [...createdClients, ...store.clients] };
  } else if (preview.kind === "appointments") {
    const createdAppointments = [];
    preview.mappedRows.forEach((row) => {
      const client = store.clients.find((item) => item.name.toLowerCase() === String(row.values.client || "").trim().toLowerCase());
      if (!client || !row.values.time) {
        summary.skipped += 1;
        summary.errors.push(`Rij ${row.row}: client of tijd ontbreekt.`);
        return;
      }
      const appointment = {
        id: uid("apt"),
        time: row.values.time,
        clientId: client.id,
        client: client.name,
        type: row.values.type || "Migratie afspraak",
        clinician: row.values.clinician || client.clinician,
        location: row.values.location || "Praktijk",
        status: row.values.status || "Nieuw",
        signal: appointmentSignal(row.values.status || "Nieuw"),
        aiHint: "Geimporteerde afspraak. Controleer status en facturatie."
      };
      createdAppointments.push(appointment);
      summary.records.push({ collection: "appointments", id: appointment.id, label: `${appointment.time} ${appointment.client}` });
    });
    summary.created = createdAppointments.length;
    nextStore = { ...nextStore, appointments: [...store.appointments, ...createdAppointments].sort((a, b) => a.time.localeCompare(b.time)) };
  } else if (preview.kind === "invoices") {
    const createdInvoices = [];
    preview.mappedRows.forEach((row) => {
      const amount = Number(String(row.values.amount || "0").replace(",", "."));
      if (!row.values.client || amount <= 0) {
        summary.skipped += 1;
        summary.errors.push(`Rij ${row.row}: client of bedrag ontbreekt.`);
        return;
      }
      const client = store.clients.find((item) => item.name.toLowerCase() === String(row.values.client || "").trim().toLowerCase());
      const invoice = {
        id: uid("inv"),
        clientId: client?.id || null,
        appointmentId: null,
        client: row.values.client,
        amount,
        channel: row.values.channel || "Overschrijving",
        status: row.values.status || "Voorstel",
        issuedAt: now,
        dueAt: row.values.dueAt || "",
        paidAt: null,
        reminderSentAt: null
      };
      createdInvoices.push(invoice);
      summary.records.push({ collection: "invoices", id: invoice.id, label: `${invoice.client} ${invoice.amount}` });
    });
    summary.created = createdInvoices.length;
    nextStore = { ...nextStore, invoices: [...createdInvoices, ...store.invoices] };
  }

  return {
    summary,
    store: {
      ...nextStore,
      importRuns: (store.importRuns || []).map((run) =>
        run.id === previewId ? { ...run, appliedAt: now, appliedBy: user.name, applySummary: summary } : run
      )
    }
  };
}

function rollbackImportPreview(store, user, previewId) {
  const preview = (store.importRuns || []).find((run) => run.id === previewId);
  const records = preview?.applySummary?.records || [];
  if (!preview || !preview.applySummary || preview.rolledBackAt) return null;

  const idsByCollection = records.reduce((groups, record) => {
    groups[record.collection] = groups[record.collection] || new Set();
    groups[record.collection].add(record.id);
    return groups;
  }, {});
  const removed = records.length;
  const now = timestampLabel();

  return {
    summary: {
      previewId,
      rolledBackAt: now,
      rolledBackBy: user.name,
      removed
    },
    store: {
      ...store,
      clients: store.clients.filter((client) => !idsByCollection.clients?.has(client.id)),
      appointments: store.appointments.filter((appointment) => !idsByCollection.appointments?.has(appointment.id)),
      invoices: store.invoices.filter((invoice) => !idsByCollection.invoices?.has(invoice.id)),
      importRuns: (store.importRuns || []).map((run) =>
        run.id === previewId ? { ...run, rolledBackAt: now, rolledBackBy: user.name, rollbackSummary: { previewId, rolledBackAt: now, rolledBackBy: user.name, removed } } : run
      )
    }
  };
}

function activePortalInvite(store, token) {
  return store.portalInvites.find((item) => item.token === token && item.status === "Actief" && Number(item.expiresAt || 0) >= Date.now());
}

function portalPayload(store, invite) {
  return {
    practice: {
      name: store.practice.name,
      language: store.practice.language
    },
    client: {
      id: invite.clientId,
      name: invite.client
    },
    messages: store.messages.filter((item) => item.clientId === invite.clientId && item.status !== "Concept"),
    documents: store.documents.filter((item) => item.clientId === invite.clientId && item.status !== "Review nodig"),
    intakes: store.intakes.filter((item) => item.clientId === invite.clientId)
  };
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  const relative = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
  const filePath = path.resolve(root, relative);

  if (!filePath.startsWith(root + path.sep) && filePath !== root) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(content);
  });
}

async function handleApi(request, response) {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true, service: "PraktijkOS" });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const payload = await readJson(request);
    const user = verifyUser(payload.email, payload.password);
    if (!user) {
      sendJson(response, 401, { error: "Ongeldige login." });
      return;
    }

    const session = createSession(user.id);
    response.setHeader("Set-Cookie", sessionCookie(session.token, 60 * 60 * 12));
    sendJson(response, 200, { user });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    const cookies = parseCookies(request);
    deleteSession(cookies.praktijkos_session);
    response.setHeader("Set-Cookie", clearSessionCookie());
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/auth/session") {
    const user = getSession(parseCookies(request).praktijkos_session);
    if (!user) {
      sendJson(response, 401, { error: "Niet aangemeld." });
      return;
    }
    sendJson(response, 200, { user });
    return;
  }

  if (request.method === "GET" && url.pathname.match(/^\/api\/portal\/[^/]+$/)) {
    const token = url.pathname.split("/")[3];
    const portalStore = readStore();
    const invite = activePortalInvite(portalStore, token);
    if (!invite) {
      sendJson(response, 404, { error: "Portaaltoegang is niet actief." });
      return;
    }

    sendJson(response, 200, portalPayload(portalStore, invite));
    return;
  }

  if (request.method === "POST" && url.pathname.match(/^\/api\/portal\/[^/]+\/intake$/)) {
    const token = url.pathname.split("/")[3];
    const portalStore = readStore();
    const invite = activePortalInvite(portalStore, token);
    if (!invite) {
      sendJson(response, 404, { error: "Portaaltoegang is niet actief." });
      return;
    }

    const payload = await readJson(request);
    if (!payload.hulpvraag) {
      sendJson(response, 422, { error: "Hulpvraag is verplicht." });
      return;
    }

    const intake = {
      id: uid("int"),
      clientId: invite.clientId,
      client: invite.client,
      status: "Ingediend",
      submittedAt: timestampLabel(),
      answers: {
        hulpvraag: payload.hulpvraag,
        voorkeur: payload.voorkeur || "",
        voorgeschiedenis: payload.voorgeschiedenis || ""
      }
    };

    const nextStore = appendAudit(
      { ...portalStore, intakes: [intake, ...portalStore.intakes] },
      "Portalintake ontvangen",
      `${invite.client} diende intakegegevens in via de portal.`,
      "Client portal"
    );
    writeStore(nextStore);
    sendJson(response, 201, intake);
    return;
  }

  const user = getSession(parseCookies(request).praktijkos_session);
  if (!user) {
    sendJson(response, 401, { error: "Niet aangemeld." });
    return;
  }

  const store = readStore();

  if (request.method === "GET" && url.pathname === "/api/dashboard") {
    const analytics = buildAnalytics(store);
    sendJson(response, 200, {
      appointmentsToday: store.appointments.length,
      openInvoices: store.invoices.length,
      aiDrafts: store.aiDrafts.length,
      auditEvents: store.auditLog.length,
      analytics
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/analytics") {
    sendJson(response, 200, buildAnalytics(store));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/state") {
    sendJson(response, 200, { ...store, analytics: buildAnalytics(store) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/audit/export") {
    if (!requirePermission(response, user, "practice")) return;
    const filter = url.searchParams.get("filter") || "all";
    const auditExport = buildAuditExport(store, user, filter);
    const nextStore = appendAudit(
      store,
      "Auditexport gemaakt",
      `${auditExport.summary.exportedEvents} events geexporteerd met filter ${filter}.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 200, auditExport);
    return;
  }

  if (request.method === "GET" && url.pathname.match(/^\/api\/clients\/[^/]+\/export$/)) {
    if (!requirePermission(response, user, "care")) return;
    const clientId = url.pathname.split("/")[3];
    const dossierExport = buildClientExport(store, clientId, user);
    if (!dossierExport) {
      sendJson(response, 404, { error: "Client not found" });
      return;
    }

    const nextStore = appendAudit(
      store,
      "Clientdossier geexporteerd",
      `${dossierExport.client.name} dossier export aangemaakt.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 200, dossierExport);
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/practice") {
    if (!requirePermission(response, user, "practice")) return;
    const payload = await readJson(request);
    const practice = {
      ...store.practice,
      name: payload.name || store.practice.name,
      language: payload.language || store.practice.language,
      locations: Array.isArray(payload.locations) ? payload.locations : store.practice.locations,
      paymentMethods: Array.isArray(payload.paymentMethods) ? payload.paymentMethods : store.practice.paymentMethods,
      aiPolicy: payload.aiPolicy || store.practice.aiPolicy,
      onboardingComplete: typeof payload.onboardingComplete === "boolean"
        ? payload.onboardingComplete
        : store.practice.onboardingComplete
    };

    const nextStore = appendAudit(
      { ...store, practice },
      "Praktijkinstellingen bijgewerkt",
      `${practice.name} configuratie opgeslagen.`
    );
    writeStore(nextStore);
    sendJson(response, 200, practice);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/team") {
    if (!requirePermission(response, user, "team")) return;
    const payload = await readJson(request);
    if (!payload.name || !payload.role) {
      sendJson(response, 422, { error: "name and role are required" });
      return;
    }

    const member = {
      id: uid("usr"),
      name: payload.name,
      role: payload.role,
      access: payload.access || "Eigen dossiers"
    };

    const nextStore = appendAudit(
      { ...store, team: [member, ...store.team] },
      "Teamlid toegevoegd",
      `${member.name} toegevoegd als ${member.role}.`
    );
    writeStore(nextStore);
    sendJson(response, 201, member);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/intakes") {
    if (!requirePermission(response, user, "care")) return;
    const payload = await readJson(request);
    const client = store.clients.find((item) => item.id === payload.clientId);
    if (!client || !payload.hulpvraag) {
      sendJson(response, 422, { error: "clientId and hulpvraag are required" });
      return;
    }

    const intake = {
      id: uid("int"),
      clientId: client.id,
      client: client.name,
      status: payload.status || "Ingediend",
      submittedAt: timestampLabel(),
      answers: {
        hulpvraag: payload.hulpvraag,
        voorkeur: payload.voorkeur || "",
        voorgeschiedenis: payload.voorgeschiedenis || ""
      }
    };

    const nextStore = appendAudit(
      { ...store, intakes: [intake, ...store.intakes] },
      "Intake ontvangen",
      `${intake.client} intake klaar voor AI-samenvatting.`
    );
    writeStore(nextStore);
    sendJson(response, 201, intake);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/messages") {
    if (!requirePermission(response, user, "care")) return;
    const payload = await readJson(request);
    const client = store.clients.find((item) => item.id === payload.clientId);
    if (!client || !payload.subject || !payload.body) {
      sendJson(response, 422, { error: "clientId, subject and body are required" });
      return;
    }

    const message = {
      id: uid("msg"),
      clientId: client.id,
      client: client.name,
      subject: payload.subject,
      body: payload.body,
      status: payload.status || "Concept",
      channel: payload.channel || "Client portal",
      consentNote: payload.consentNote || "Inhoudelijke info via portaal; e-mail of sms enkel praktisch."
    };

    const nextStore = appendAudit(
      { ...store, messages: [message, ...store.messages] },
      "Bericht aangemaakt",
      `${message.subject} voor ${message.client}.`
    );
    writeStore(nextStore);
    sendJson(response, 201, message);
    return;
  }

  if (request.method === "PATCH" && url.pathname.match(/^\/api\/messages\/[^/]+$/)) {
    if (!requirePermission(response, user, "care")) return;
    const messageId = url.pathname.split("/")[3];
    const payload = await readJson(request);
    const message = store.messages.find((item) => item.id === messageId);

    if (!message) {
      sendJson(response, 404, { error: "Message not found" });
      return;
    }

    const updatedMessage = {
      ...message,
      status: payload.status || message.status,
      channel: payload.channel || message.channel
    };

    const nextStore = appendAudit(
      {
        ...store,
        messages: store.messages.map((item) => item.id === messageId ? updatedMessage : item)
      },
      "Berichtstatus bijgewerkt",
      `${updatedMessage.subject}: ${updatedMessage.status}.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 200, updatedMessage);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/portal/invites") {
    if (!requirePermission(response, user, "care")) return;
    const payload = await readJson(request);
    const client = store.clients.find((item) => item.id === payload.clientId);
    if (!client) {
      sendJson(response, 422, { error: "clientId is required" });
      return;
    }

    const token = crypto.randomBytes(24).toString("base64url");
    const invite = {
      id: uid("portal"),
      token,
      clientId: client.id,
      client: client.name,
      status: "Actief",
      createdAt: timestampLabel(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 14,
      createdBy: user.name,
      portalUrl: `/portal.html?token=${token}`
    };

    const nextStore = appendAudit(
      { ...store, portalInvites: [invite, ...store.portalInvites] },
      "Portaaltoegang aangemaakt",
      `${client.name} heeft een nieuwe portaaltoegang.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 201, invite);
    return;
  }

  if (request.method === "PATCH" && url.pathname.match(/^\/api\/portal\/invites\/[^/]+$/)) {
    if (!requirePermission(response, user, "care")) return;
    const inviteId = url.pathname.split("/")[4];
    const payload = await readJson(request);
    const invite = store.portalInvites.find((item) => item.id === inviteId);
    const allowedStatuses = ["Actief", "Ingetrokken"];
    const status = payload.status || invite?.status;

    if (!invite) {
      sendJson(response, 404, { error: "Portal invite not found" });
      return;
    }

    if (!allowedStatuses.includes(status)) {
      sendJson(response, 422, { error: "status is invalid" });
      return;
    }

    const updatedInvite = {
      ...invite,
      status,
      revokedAt: status === "Ingetrokken" ? timestampLabel() : invite.revokedAt,
      reactivatedAt: status === "Actief" && invite.status !== "Actief" ? timestampLabel() : invite.reactivatedAt
    };

    const nextStore = appendAudit(
      {
        ...store,
        portalInvites: store.portalInvites.map((item) => item.id === inviteId ? updatedInvite : item)
      },
      "Portaaltoegang bijgewerkt",
      `${updatedInvite.client}: ${updatedInvite.status}.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 200, updatedInvite);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/notes") {
    if (!requirePermission(response, user, "care")) return;
    const payload = await readJson(request);
    const client = store.clients.find((item) => item.id === payload.clientId);
    if (!client || !payload.title || !payload.body) {
      sendJson(response, 422, { error: "clientId, title and body are required" });
      return;
    }

    const note = {
      id: uid("note"),
      clientId: client.id,
      client: client.name,
      title: payload.title,
      body: payload.body,
      author: user.name,
      status: payload.status || "Concept",
      createdAt: timestampLabel()
    };

    const nextStore = appendAudit(
      { ...store, notes: [note, ...store.notes] },
      "Sessienota aangemaakt",
      `${note.title} voor ${note.client}.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 201, note);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/documents") {
    if (!requirePermission(response, user, "care")) return;
    const payload = await readJson(request);
    const client = store.clients.find((item) => item.id === payload.clientId);
    if (!client || !payload.title || !payload.type) {
      sendJson(response, 422, { error: "clientId, title and type are required" });
      return;
    }

    const document = {
      id: uid("doc"),
      clientId: client.id,
      client: client.name,
      title: payload.title,
      type: payload.type,
      status: payload.status || "Review nodig"
    };

    const nextStore = appendAudit(
      { ...store, documents: [document, ...store.documents] },
      "Document aangemaakt",
      `${document.title} voor ${document.client}.`
    );
    writeStore(nextStore);
    sendJson(response, 201, document);
    return;
  }

  if (request.method === "PATCH" && url.pathname.match(/^\/api\/documents\/[^/]+$/)) {
    if (!requirePermission(response, user, "care")) return;
    const documentId = url.pathname.split("/")[3];
    const payload = await readJson(request);
    const document = store.documents.find((item) => item.id === documentId);

    if (!document) {
      sendJson(response, 404, { error: "Document not found" });
      return;
    }

    const updatedDocument = {
      ...document,
      status: payload.status || document.status,
      type: payload.type || document.type
    };

    const nextStore = appendAudit(
      {
        ...store,
        documents: store.documents.map((item) => item.id === documentId ? updatedDocument : item)
      },
      "Documentstatus bijgewerkt",
      `${updatedDocument.title}: ${updatedDocument.status}.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 200, updatedDocument);
    return;
  }

  if (request.method === "POST" && url.pathname.match(/^\/api\/clients\/[^/]+\/access-overrides$/)) {
    if (!requirePermission(response, user, "practice")) return;
    const clientId = url.pathname.split("/")[3];
    const client = store.clients.find((item) => item.id === clientId);
    const payload = await readJson(request);
    const member = store.team.find((item) => item.id === payload.memberId || item.name === payload.memberName);

    if (!client || !member || !payload.access || !payload.reason) {
      sendJson(response, 422, { error: "client, team member, access and reason are required" });
      return;
    }

    const override = {
      id: uid("access"),
      clientId: client.id,
      client: client.name,
      memberId: member.id,
      member: member.name,
      role: member.role,
      access: payload.access,
      reason: payload.reason,
      status: "Actief",
      createdAt: timestampLabel(),
      reviewDue: payload.reviewDue || "Binnen 7 dagen",
      createdBy: user.name
    };

    const nextStore = appendAudit(
      { ...store, accessOverrides: [override, ...(store.accessOverrides || [])] },
      "Dossiertoegang aangepast",
      `${member.name}: ${override.access} voor ${client.name}. Reden: ${override.reason}`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 201, override);
    return;
  }

  if (request.method === "PATCH" && url.pathname.match(/^\/api\/access-overrides\/[^/]+$/)) {
    if (!requirePermission(response, user, "practice")) return;
    const overrideId = url.pathname.split("/")[3];
    const payload = await readJson(request);
    const override = (store.accessOverrides || []).find((item) => item.id === overrideId);
    if (!override) {
      sendJson(response, 404, { error: "Access override not found" });
      return;
    }

    const updatedOverride = {
      ...override,
      status: payload.status || override.status,
      reviewedAt: timestampLabel(),
      reviewedBy: user.name
    };
    const nextStore = appendAudit(
      {
        ...store,
        accessOverrides: (store.accessOverrides || []).map((item) => item.id === overrideId ? updatedOverride : item)
      },
      "Dossiertoegang herzien",
      `${updatedOverride.member}: ${updatedOverride.status} voor ${updatedOverride.client}.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 200, updatedOverride);
    return;
  }

  if (request.method === "PATCH" && url.pathname.match(/^\/api\/retention-policies\/[^/]+$/)) {
    if (!requirePermission(response, user, "practice")) return;
    const policyId = url.pathname.split("/")[3];
    const payload = await readJson(request);
    const policy = (store.retentionPolicies || []).find((item) => item.id === policyId);
    if (!policy) {
      sendJson(response, 404, { error: "Retention policy not found" });
      return;
    }

    const updatedPolicy = {
      ...policy,
      status: payload.status || policy.status,
      reviewCadence: payload.reviewCadence || policy.reviewCadence,
      reviewedAt: timestampLabel(),
      reviewedBy: user.name
    };
    const nextStore = appendAudit(
      {
        ...store,
        retentionPolicies: (store.retentionPolicies || []).map((item) => item.id === policyId ? updatedPolicy : item)
      },
      "Retentiebeleid bijgewerkt",
      `${updatedPolicy.label}: ${updatedPolicy.status}, review ${updatedPolicy.reviewCadence}.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 200, updatedPolicy);
    return;
  }

  if (request.method === "POST" && url.pathname.match(/^\/api\/retention-policies\/[^/]+\/review$/)) {
    if (!requirePermission(response, user, "practice")) return;
    const policyId = url.pathname.split("/")[3];
    const policy = (store.retentionPolicies || []).find((item) => item.id === policyId);
    if (!policy) {
      sendJson(response, 404, { error: "Retention policy not found" });
      return;
    }

    const updatedPolicy = {
      ...policy,
      status: "Actief",
      reviewedAt: timestampLabel(),
      reviewedBy: user.name,
      nextReviewDue: nextRetentionReviewLabel(policy.reviewCadence)
    };
    const nextStore = appendAudit(
      {
        ...store,
        retentionPolicies: (store.retentionPolicies || []).map((item) => item.id === policyId ? updatedPolicy : item)
      },
      "Retentiereview afgerond",
      `${updatedPolicy.label}: volgende review ${updatedPolicy.nextReviewDue}.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 200, updatedPolicy);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/clients") {
    if (!requirePermission(response, user, "care")) return;
    const payload = await readJson(request);
    if (!payload.name || !payload.track || !payload.clinician) {
      sendJson(response, 422, { error: "name, track and clinician are required" });
      return;
    }

    const client = {
      id: uid("cl"),
      name: payload.name,
      age: Number(payload.age || 0),
      track: payload.track,
      status: payload.status || "Intakefase",
      clinician: payload.clinician,
      nextAppointment: "Nog niet gepland",
      adminStatus: "Nieuwe client - intake klaar te zetten",
      aiSuggestion: "Maak een intakevoorstel en plan eerste afspraak."
    };

    const nextStore = appendAudit(
      { ...store, clients: [client, ...store.clients] },
      "Client aangemaakt",
      `${client.name} toegevoegd aan het cliëntenbestand.`
    );
    writeStore(nextStore);
    sendJson(response, 201, client);
    return;
  }

  if (request.method === "POST" && url.pathname.match(/^\/api\/clients\/[^/]+\/voice-consent$/)) {
    if (!requirePermission(response, user, "care")) return;
    const clientId = url.pathname.split("/")[3];
    const client = store.clients.find((item) => item.id === clientId);
    const payload = await readJson(request);
    if (!client || !payload.scope) {
      sendJson(response, 422, { error: "client and scope are required" });
      return;
    }

    const consent = {
      id: uid("voice"),
      clientId: client.id,
      client: client.name,
      scope: payload.scope,
      status: payload.status || "Actief",
      recordedAt: timestampLabel(),
      recordedBy: user.name,
      expiresAt: payload.expiresAt || "Einde traject"
    };
    const nextStore = appendAudit(
      {
        ...store,
        voiceConsents: [
          consent,
          ...(store.voiceConsents || []).filter((item) => item.clientId !== client.id)
        ]
      },
      "Voice consent vastgelegd",
      `${client.name}: ${consent.scope}, geldig tot ${consent.expiresAt}.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 201, consent);
    return;
  }

  if (request.method === "POST" && url.pathname.match(/^\/api\/clients\/[^/]+\/voice-notes$/)) {
    if (!requirePermission(response, user, "ai")) return;
    const clientId = url.pathname.split("/")[3];
    const client = store.clients.find((item) => item.id === clientId);
    const payload = await readJson(request);
    const consent = activeVoiceConsent(store, clientId);
    if (!client || !payload.transcript) {
      sendJson(response, 422, { error: "client and transcript are required" });
      return;
    }
    if (!consent || !payload.consentConfirmed) {
      sendJson(response, 403, { error: "Active voice consent is required" });
      return;
    }

    const note = {
      id: uid("note"),
      clientId: client.id,
      client: client.name,
      title: payload.title || "Voice-to-note concept",
      body: `Transcript verwerkt als conceptnota:\n\n${payload.transcript}`,
      author: user.name,
      status: "Review nodig",
      createdAt: timestampLabel(),
      source: "voice-to-note",
      consentId: consent.id
    };
    const nextStore = appendAudit(
      { ...store, notes: [note, ...(store.notes || [])] },
      "Voice-to-note concept gemaakt",
      `${client.name}: transcript verwerkt met consent ${consent.id}.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 201, note);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/appointments") {
    if (!requirePermission(response, user, "scheduling")) return;
    const payload = await readJson(request);
    const client = store.clients.find((item) => item.id === payload.clientId);
    if (!client || !payload.time || !payload.type || !payload.clinician) {
      sendJson(response, 422, { error: "clientId, time, type and clinician are required" });
      return;
    }

    const appointment = {
      id: uid("apt"),
      time: payload.time,
      clientId: client.id,
      client: client.name,
      type: payload.type,
      clinician: payload.clinician,
      location: payload.location || "Praktijk",
      status: "Nieuw",
      signal: "success",
      aiHint: "Controleer intake, betaalvoorkeur en reminderregels."
    };

    const nextStore = appendAudit(
      { ...store, appointments: [...store.appointments, appointment].sort((a, b) => a.time.localeCompare(b.time)) },
      "Afspraak gepland",
      `${appointment.client} om ${appointment.time} ingepland.`
    );
    writeStore(nextStore);
    sendJson(response, 201, appointment);
    return;
  }

  if (request.method === "POST" && url.pathname.match(/^\/api\/waitlist\/[^/]+\/schedule$/)) {
    if (!requirePermission(response, user, "scheduling")) return;
    const waitlistId = url.pathname.split("/")[3];
    const payload = await readJson(request);
    const entry = (store.waitlist || []).find((item) => item.id === waitlistId);
    const client = entry ? store.clients.find((item) => item.id === entry.clientId) : null;

    if (!entry || !client || !payload.time || !payload.clinician) {
      sendJson(response, 422, { error: "waitlist entry, time and clinician are required" });
      return;
    }

    const appointment = {
      id: uid("apt"),
      time: payload.time,
      clientId: client.id,
      client: client.name,
      type: payload.type || entry.type || "Opvolggesprek",
      clinician: payload.clinician,
      location: payload.location || "Praktijk",
      status: "Nieuw",
      signal: "success",
      aiHint: "Afspraak vanuit wachtlijst ingepland. Controleer intake, reminder en betaalvoorkeur.",
      waitlistId: entry.id
    };

    const nextStore = appendAudit(
      {
        ...store,
        appointments: [...store.appointments, appointment].sort((a, b) => a.time.localeCompare(b.time)),
        waitlist: (store.waitlist || []).filter((item) => item.id !== waitlistId),
        clients: store.clients.map((item) =>
          item.id === client.id
            ? { ...item, nextAppointment: `${appointment.time} / ${appointment.type}`, adminStatus: "Afspraak ingepland vanuit wachtlijst" }
            : item
        )
      },
      "Wachtlijst ingepland",
      `${client.name} om ${appointment.time} ingepland vanuit wachtlijst.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 201, appointment);
    return;
  }

  if (request.method === "PATCH" && url.pathname.match(/^\/api\/appointments\/[^/]+$/)) {
    if (!requirePermission(response, user, "scheduling")) return;
    const appointmentId = url.pathname.split("/")[3];
    const payload = await readJson(request);
    const appointment = store.appointments.find((item) => item.id === appointmentId);

    if (!appointment) {
      sendJson(response, 404, { error: "Appointment not found" });
      return;
    }

    const status = payload.status || appointment.status;
    const updatedAppointment = {
      ...appointment,
      status,
      signal: payload.signal || appointmentSignal(status),
      aiHint: payload.aiHint || appointment.aiHint
    };

    const nextStore = appendAudit(
      {
        ...store,
        appointments: store.appointments.map((item) => item.id === appointmentId ? updatedAppointment : item),
        clients: store.clients.map((client) =>
          client.id === appointment.clientId
            ? { ...client, adminStatus: `Afspraakstatus: ${status}`, nextAppointment: `${appointment.time} / ${appointment.type}` }
            : client
        )
      },
      "Afspraakstatus bijgewerkt",
      `${appointment.client}: ${status}.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 200, updatedAppointment);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/drafts") {
    if (!requirePermission(response, user, "ai")) return;
    const payload = await readJson(request);
    if (!payload.workflow || !payload.output) {
      sendJson(response, 422, { error: "workflow and output are required" });
      return;
    }

    const draft = {
      id: uid("draft"),
      workflow: payload.workflow,
      source: payload.source || "",
      output: payload.output,
      modelId: payload.modelId || "",
      modelName: payload.modelName || "Handmatig concept",
      promptVersion: payload.promptVersion || "manual",
      riskLevel: payload.riskLevel || "Laag",
      status: "Concept",
      createdAt: timestampLabel(),
      approvedAt: null
    };

    const nextStore = appendAudit(
      { ...store, aiDrafts: [draft, ...store.aiDrafts].slice(0, 100) },
      "AI concept gegenereerd",
      `${draft.workflow} concept staat klaar voor review.`,
      "AI Copilot"
    );
    writeStore(nextStore);
    sendJson(response, 201, draft);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/knowledge-base") {
    if (!requirePermission(response, user, "practice")) return;
    const payload = await readJson(request);
    if (!payload.title || !payload.content) {
      sendJson(response, 422, { error: "title and content are required" });
      return;
    }

    const item = {
      id: uid("kb"),
      category: payload.category || "Praktijk",
      title: payload.title,
      content: payload.content,
      status: payload.status || "Actief",
      owner: payload.owner || user.role,
      version: 1,
      reviewDue: payload.reviewDue || "Volgend kwartaal",
      history: [],
      createdAt: timestampLabel(),
      createdBy: user.name
    };
    const nextStore = appendAudit(
      { ...store, knowledgeBase: [item, ...(store.knowledgeBase || [])] },
      "Kennisbankitem toegevoegd",
      `${item.category}: ${item.title}.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 201, item);
    return;
  }

  if (request.method === "PATCH" && url.pathname.match(/^\/api\/knowledge-base\/[^/]+$/)) {
    if (!requirePermission(response, user, "practice")) return;
    const itemId = url.pathname.split("/")[3];
    const payload = await readJson(request);
    const item = (store.knowledgeBase || []).find((entry) => entry.id === itemId);
    if (!item) {
      sendJson(response, 404, { error: "Knowledge base item not found" });
      return;
    }

    const changedContent = Boolean(payload.content && payload.content !== item.content);
    const changedStatus = Boolean(payload.status && payload.status !== item.status);
    const nextVersion = changedContent || changedStatus ? Number(item.version || 1) + 1 : Number(item.version || 1);
    const updatedItem = {
      ...item,
      category: payload.category || item.category,
      title: payload.title || item.title,
      content: payload.content || item.content,
      status: payload.status || item.status,
      owner: payload.owner || item.owner,
      reviewDue: payload.reviewDue || item.reviewDue || "Volgend kwartaal",
      version: nextVersion,
      reviewedAt: timestampLabel(),
      reviewedBy: user.name,
      history: changedContent || changedStatus
        ? [
          {
            version: item.version || 1,
            status: item.status,
            content: item.content,
            changedAt: timestampLabel(),
            changedBy: user.name
          },
          ...(item.history || [])
        ].slice(0, 10)
        : item.history || []
    };
    const nextStore = appendAudit(
      {
        ...store,
        knowledgeBase: (store.knowledgeBase || []).map((entry) => entry.id === itemId ? updatedItem : entry)
      },
      "Kennisbankitem herzien",
      `${updatedItem.title}: versie ${updatedItem.version}, status ${updatedItem.status}.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 200, updatedItem);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/generate") {
    if (!requirePermission(response, user, "ai")) return;
    const payload = await readJson(request);
    if (!payload.workflow) {
      sendJson(response, 422, { error: "workflow is required" });
      return;
    }

    const knowledge = activeKnowledge(store);
    const model = modelForWorkflow(store, payload.workflow, payload.modelId);
    const output = generateDraft({ workflow: payload.workflow, input: payload.source || "", knowledge });
    const draft = {
      id: uid("draft"),
      workflow: payload.workflow,
      source: payload.source || "",
      output,
      knowledgeIds: knowledge.map((item) => item.id),
      modelId: model?.id || "",
      modelName: model?.name || "PraktijkOS model",
      promptVersion: model?.promptVersion || "server-v1",
      riskLevel: model?.riskLevel || "Laag",
      status: "Concept",
      createdAt: timestampLabel(),
      approvedAt: null
    };

    const nextStore = appendAudit(
      { ...store, aiDrafts: [draft, ...store.aiDrafts].slice(0, 100) },
      "AI concept gegenereerd",
      `${draft.workflow} concept met ${draft.modelName} (${draft.promptVersion}) staat klaar voor review.`,
      "AI Copilot"
    );
    writeStore(nextStore);
    sendJson(response, 201, draft);
    return;
  }

  if (request.method === "POST" && url.pathname.match(/^\/api\/ai\/drafts\/[^/]+\/approve$/)) {
    if (!requirePermission(response, user, "ai")) return;
    const draftId = url.pathname.split("/")[4];
    const payload = await readJson(request);
    const approvedAt = timestampLabel();
    const draft = store.aiDrafts.find((item) => item.id === draftId);

    if (!draft) {
      sendJson(response, 404, { error: "Draft not found" });
      return;
    }

    const client = payload.clientId ? store.clients.find((item) => item.id === payload.clientId) : null;
    const savedNote = payload.storeAsNote && draft.workflow === "note" && client ? {
      id: uid("note"),
      clientId: client.id,
      client: client.name,
      title: "AI sessienota",
      body: draft.output,
      status: "Afgewerkt",
      author: user.name,
      createdAt: approvedAt,
      sourceDraftId: draft.id
    } : null;

    const nextStore = appendAudit(
      {
        ...store,
        aiDrafts: store.aiDrafts.map((draft) =>
          draft.id === draftId ? { ...draft, status: "Goedgekeurd", approvedAt, savedNoteId: savedNote?.id || draft.savedNoteId } : draft
        ),
        notes: savedNote ? [savedNote, ...store.notes] : store.notes
      },
      "AI concept goedgekeurd",
      savedNote ? `${client.name}: AI nota opgeslagen in dossier.` : "Professionele review bevestigd en audit-event vastgelegd."
    );
    writeStore(nextStore);
    sendJson(response, 200, nextStore.aiDrafts.find((draft) => draft.id === draftId));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/invoices") {
    if (!requirePermission(response, user, "billing")) return;
    const payload = await readJson(request);
    const client = store.clients.find((item) => item.id === payload.clientId);
    const amount = Number(payload.amount || 0);

    if (!client || amount <= 0) {
      sendJson(response, 422, { error: "clientId and positive amount are required" });
      return;
    }

    const invoice = {
      id: uid("inv"),
      clientId: client.id,
      appointmentId: payload.appointmentId || null,
      client: client.name,
      amount,
      channel: payload.channel || "Bancontact",
      status: payload.status || "Voorstel",
      issuedAt: payload.issuedAt || timestampLabel(),
      dueAt: payload.dueAt || "",
      paidAt: null,
      reminderSentAt: null
    };

    const nextStore = appendAudit(
      { ...store, invoices: [invoice, ...store.invoices] },
      "Factuur aangemaakt",
      `${invoice.client}: ${invoice.amount} euro via ${invoice.channel}.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 201, invoice);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/billing/proposals") {
    if (!requirePermission(response, user, "billing")) return;
    const proposalInvoices = store.appointments
      .filter(isBillableAppointment)
      .filter((appointment) => !store.invoices.some((invoice) => invoice.appointmentId === appointment.id))
      .map((appointment) => ({
        id: uid("inv"),
        clientId: appointment.clientId,
        appointmentId: appointment.id,
        client: appointment.client,
        amount: appointment.type.toLowerCase().includes("intake") ? 90 : 75,
        channel: "Bancontact",
        status: "Voorstel",
        issuedAt: timestampLabel(),
        dueAt: "",
        paidAt: null,
        reminderSentAt: null
      }));

    const nextStore = appendAudit(
      { ...store, invoices: [...proposalInvoices, ...store.invoices] },
      "Factuurvoorstellen gemaakt",
      `${proposalInvoices.length} voorstellen gegenereerd.`
    );
    writeStore(nextStore);
    sendJson(response, 201, { created: proposalInvoices.length, invoices: proposalInvoices });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/billing/export") {
    if (!requirePermission(response, user, "billing")) return;
    const payload = await readJson(request);
    const billingExport = buildBillingExport(store, user, payload);
    const nextStore = appendAudit(
      store,
      "Boekhouderexport aangemaakt",
      `${billingExport.summary.invoiceCount} facturen geexporteerd, ${billingExport.summary.openCount} openstaand.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 201, billingExport);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/import/preview") {
    if (!requirePermission(response, user, "practice")) return;
    const payload = await readJson(request);
    if (!payload.csv || String(payload.csv).trim().split(/\r?\n/).length < 2) {
      sendJson(response, 422, { error: "CSV met header en minstens een datarij is verplicht" });
      return;
    }

    const preview = buildImportPreview(store, user, payload);
    const nextStore = appendAudit(
      {
        ...store,
        importRuns: [preview, ...(store.importRuns || [])].slice(0, 20)
      },
      "Importpreview aangemaakt",
      `${preview.label}: ${preview.rowCount} rijen geanalyseerd.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 201, preview);
    return;
  }

  if (request.method === "POST" && url.pathname.match(/^\/api\/import\/[^/]+\/apply$/)) {
    if (!requirePermission(response, user, "practice")) return;
    const previewId = url.pathname.split("/")[3];
    const applied = applyImportPreview(store, user, previewId);
    if (!applied) {
      sendJson(response, 404, { error: "Import preview not found" });
      return;
    }

    const nextStore = appendAudit(
      applied.store,
      "Import uitgevoerd",
      `${applied.summary.kind}: ${applied.summary.created} aangemaakt, ${applied.summary.skipped} overgeslagen.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 201, applied.summary);
    return;
  }

  if (request.method === "POST" && url.pathname.match(/^\/api\/import\/[^/]+\/rollback$/)) {
    if (!requirePermission(response, user, "practice")) return;
    const previewId = url.pathname.split("/")[3];
    const rollback = rollbackImportPreview(store, user, previewId);
    if (!rollback) {
      sendJson(response, 422, { error: "Import kan niet worden teruggedraaid" });
      return;
    }

    const nextStore = appendAudit(
      rollback.store,
      "Import teruggedraaid",
      `${rollback.summary.removed} records verwijderd uit import ${previewId}.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 200, rollback.summary);
    return;
  }

  if (request.method === "PATCH" && url.pathname.match(/^\/api\/invoices\/[^/]+$/)) {
    if (!requirePermission(response, user, "billing")) return;
    const invoiceId = url.pathname.split("/")[3];
    const payload = await readJson(request);
    const invoice = store.invoices.find((item) => item.id === invoiceId);

    if (!invoice) {
      sendJson(response, 404, { error: "Invoice not found" });
      return;
    }

    const updatedInvoice = {
      ...invoice,
      status: payload.status || invoice.status,
      channel: payload.channel || invoice.channel,
      reminderSentAt: payload.reminderSentAt || invoice.reminderSentAt,
      paidAt: payload.status === "Betaald"
        ? timestampLabel()
        : invoice.paidAt
    };

    const nextStore = appendAudit(
      {
        ...store,
        invoices: store.invoices.map((item) => item.id === invoiceId ? updatedInvoice : item)
      },
      "Factuur bijgewerkt",
      `${updatedInvoice.client} status: ${updatedInvoice.status}.`
    );
    writeStore(nextStore);
    sendJson(response, 200, updatedInvoice);
    return;
  }

  if (request.method === "POST" && url.pathname.match(/^\/api\/invoices\/[^/]+\/reminder$/)) {
    if (!requirePermission(response, user, "billing")) return;
    const invoiceId = url.pathname.split("/")[3];
    const invoice = store.invoices.find((item) => item.id === invoiceId);

    if (!invoice) {
      sendJson(response, 404, { error: "Invoice not found" });
      return;
    }

    const reminderSentAt = timestampLabel();
    const updatedInvoice = { ...invoice, status: "Herinnering", reminderSentAt };
    const nextStore = appendAudit(
      {
        ...store,
        invoices: store.invoices.map((item) => item.id === invoiceId ? updatedInvoice : item)
      },
      "Betalingsherinnering klaargezet",
      `${invoice.client} krijgt een betaalherinnering via ${invoice.channel}.`
    );
    writeStore(nextStore);
    sendJson(response, 200, updatedInvoice);
    return;
  }

  if (request.method === "POST" && url.pathname.match(/^\/api\/tasks\/[^/]+\/complete$/)) {
    if (!requirePermission(response, user, "tasks")) return;
    const taskId = url.pathname.split("/")[3];
    const task = store.workQueue.find((item) => item.id === taskId);
    if (!task) {
      sendJson(response, 404, { error: "Task not found" });
      return;
    }

    const nextStore = appendAudit(
      {
        ...store,
        workQueue: store.workQueue.map((task) =>
          task.id === taskId ? { ...task, status: "Klaar", completedAt: timestampLabel(), completedBy: user.name } : task
        )
      },
      "Taak afgewerkt",
      `${task.label} gemarkeerd als klaar.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 200, nextStore.workQueue.find((task) => task.id === taskId));
    return;
  }

  if (request.method === "POST" && url.pathname.match(/^\/api\/day-close\/[^/]+\/complete$/)) {
    if (!requirePermission(response, user, "tasks")) return;
    const itemId = url.pathname.split("/")[3];
    const item = (store.dayClose || []).find((check) => check.id === itemId);
    if (!item) {
      sendJson(response, 404, { error: "Day close item not found" });
      return;
    }

    const nextStore = appendAudit(
      {
        ...store,
        dayClose: (store.dayClose || []).map((check) =>
          check.id === itemId ? { ...check, status: "Klaar", completedAt: timestampLabel(), completedBy: user.name } : check
        )
      },
      "Dagafsluiting bijgewerkt",
      `${item.label} gemarkeerd als klaar.`,
      user.name
    );
    writeStore(nextStore);
    sendJson(response, 200, nextStore.dayClose.find((check) => check.id === itemId));
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

const server = http.createServer((request, response) => {
  if (request.url.startsWith("/api/")) {
    handleApi(request, response).catch((error) => {
      sendJson(response, 500, { error: error.message });
    });
    return;
  }

  serveStatic(request, response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`PraktijkOS API running at http://127.0.0.1:${port}/`);
});
