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
