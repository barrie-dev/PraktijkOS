const http = require("http");
const fs = require("fs");
const path = require("path");
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

  const user = getSession(parseCookies(request).praktijkos_session);
  if (!user) {
    sendJson(response, 401, { error: "Niet aangemeld." });
    return;
  }

  const store = readStore();

  if (request.method === "GET" && url.pathname === "/api/dashboard") {
    sendJson(response, 200, {
      appointmentsToday: store.appointments.length,
      openInvoices: store.invoices.length,
      aiDrafts: store.aiDrafts.length,
      auditEvents: store.auditLog.length
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/state") {
    sendJson(response, 200, store);
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/practice") {
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
      submittedAt: new Intl.DateTimeFormat("nl-BE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date()),
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

  if (request.method === "POST" && url.pathname === "/api/documents") {
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

  if (request.method === "POST" && url.pathname === "/api/clients") {
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

  if (request.method === "POST" && url.pathname === "/api/ai/drafts") {
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
      createdAt: new Intl.DateTimeFormat("nl-BE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date()),
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
    const draftId = url.pathname.split("/")[4];
    const approvedAt = new Intl.DateTimeFormat("nl-BE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date());
    const draftExists = store.aiDrafts.some((draft) => draft.id === draftId);

    if (!draftExists) {
      sendJson(response, 404, { error: "Draft not found" });
      return;
    }

    const nextStore = appendAudit(
      {
        ...store,
        aiDrafts: store.aiDrafts.map((draft) =>
          draft.id === draftId ? { ...draft, status: "Goedgekeurd", approvedAt } : draft
        )
      },
      "AI concept goedgekeurd",
      "Professionele review bevestigd en audit-event vastgelegd."
    );
    writeStore(nextStore);
    sendJson(response, 200, nextStore.aiDrafts.find((draft) => draft.id === draftId));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/billing/proposals") {
    const proposalInvoices = store.appointments
      .filter((appointment) => !store.invoices.some((invoice) => invoice.client === appointment.client && invoice.status === "Voorstel"))
      .map((appointment) => ({
        id: uid("inv"),
        client: appointment.client,
        amount: appointment.type.toLowerCase().includes("intake") ? 90 : 75,
        channel: "Bancontact",
        status: "Voorstel"
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
        ? new Intl.DateTimeFormat("nl-BE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date())
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
    const invoiceId = url.pathname.split("/")[3];
    const invoice = store.invoices.find((item) => item.id === invoiceId);

    if (!invoice) {
      sendJson(response, 404, { error: "Invoice not found" });
      return;
    }

    const reminderSentAt = new Intl.DateTimeFormat("nl-BE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date());
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
