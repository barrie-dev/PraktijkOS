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
      channel: payload.channel || "Client portal"
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

  if (request.method === "POST" && url.pathname === "/api/ai/generate") {
    if (!requirePermission(response, user, "ai")) return;
    const payload = await readJson(request);
    if (!payload.workflow) {
      sendJson(response, 422, { error: "workflow is required" });
      return;
    }

    const output = generateDraft({ workflow: payload.workflow, input: payload.source || "" });
    const draft = {
      id: uid("draft"),
      workflow: payload.workflow,
      source: payload.source || "",
      output,
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
    const nextStore = appendAudit(
      {
        ...store,
        workQueue: store.workQueue.map((task) =>
          task.id === taskId ? { ...task, status: "Klaar" } : task
        )
      },
      "Taak afgewerkt",
      `${taskId} gemarkeerd als klaar.`
    );
    writeStore(nextStore);
    sendJson(response, 200, nextStore.workQueue.find((task) => task.id === taskId));
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
