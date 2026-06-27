const http = require("http");
const fs = require("fs");
const path = require("path");
const { appendAudit, readStore, uid, writeStore } = require("./store");

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
  const store = readStore();

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true, service: "PraktijkOS API" });
    return;
  }

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
      aiPolicy: payload.aiPolicy || store.practice.aiPolicy
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
      `${client.name} toegevoegd via API.`
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
      `${appointment.client} om ${appointment.time} via API.`
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
