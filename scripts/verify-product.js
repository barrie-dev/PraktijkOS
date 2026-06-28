const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const port = Number(process.env.PORT || 8299);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "praktijkos-verify-"));
const dbPath = path.join(tempDir, "verify.sqlite");
const root = path.resolve(__dirname, "..");

let cookie = "";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(route, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    cookie = setCookie.split(";")[0];
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await request("/api/health");
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Server did not start in time.");
}

async function stopServer(server) {
  if (server.exitCode !== null || server.killed) return;
  await new Promise((resolve) => {
    server.once("exit", resolve);
    server.kill();
    setTimeout(resolve, 1000);
  });
}

async function removeTempDir() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 7) throw error;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
}

async function verify() {
  const server = spawn(process.execPath, ["server/api-server.js", String(port)], {
    cwd: root,
    env: { ...process.env, PRAKTIJKOS_DB_PATH: dbPath },
    stdio: ["ignore", "ignore", "pipe"]
  });

  let serverError = "";
  server.stderr.on("data", (chunk) => {
    serverError += chunk.toString();
  });

  try {
    await waitForServer();

    await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@praktijkos.local", password: "praktijkos" })
    });

    const state = await request("/api/state");
    assert(state.clients.length > 0, "Seed clients should be available.");

    const client = await request("/api/clients", {
      method: "POST",
      body: JSON.stringify({
        name: "Verificatie Client",
        age: 41,
        track: "Product verificatie",
        clinician: "L. Janssens"
      })
    });

    const appointment = await request("/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        clientId: client.id,
        time: "17:15",
        type: "Verificatie consult",
        clinician: "L. Janssens",
        location: "Antwerpen"
      })
    });

    const risky = await request(`/api/appointments/${appointment.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "No-show risico" })
    });
    assert(risky.signal === "danger", "No-show status should create a danger signal.");

    await request(`/api/appointments/${appointment.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "Klaar voor facturatie" })
    });

    const billing = await request("/api/billing/proposals", {
      method: "POST",
      body: JSON.stringify({})
    });
    assert(
      billing.invoices.some((invoice) => invoice.appointmentId === appointment.id),
      "Billable appointment should create an invoice proposal."
    );

    const analytics = await request("/api/analytics");
    assert(analytics.billableAppointments >= 1, "Analytics should count billable appointments.");
    assert(analytics.adminBacklog >= 0, "Analytics should expose admin backlog.");

    const conceptMessage = await request("/api/messages", {
      method: "POST",
      body: JSON.stringify({
        clientId: client.id,
        subject: "Verificatie portal",
        body: "Dit bericht bewijst de portalflow.",
        status: "Concept",
        channel: "Client portal"
      })
    });
    assert(conceptMessage.subject === "Verificatie portal", "Message should be created.");

    const reviewDocument = await request("/api/documents", {
      method: "POST",
      body: JSON.stringify({
        clientId: client.id,
        title: "Verificatie document",
        type: "Verslag",
        status: "Review nodig"
      })
    });
    assert(reviewDocument.title === "Verificatie document", "Document should be created.");

    const invite = await request("/api/portal/invites", {
      method: "POST",
      body: JSON.stringify({ clientId: client.id })
    });
    assert(invite.token, "Portal invite should include a token.");

    const hiddenPortal = await request(`/api/portal/${invite.token}`, {
      headers: { Cookie: "" }
    });
    assert(hiddenPortal.client.name === client.name, "Portal should expose the invited client.");
    assert(!hiddenPortal.messages.some((item) => item.subject === conceptMessage.subject), "Portal should hide concept messages.");
    assert(!hiddenPortal.documents.some((item) => item.title === reviewDocument.title), "Portal should hide review documents.");

    const releasedMessage = await request(`/api/messages/${conceptMessage.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "Klaar voor verzending" })
    });
    assert(releasedMessage.status === "Klaar voor verzending", "Message should be releasable.");

    const releasedDocument = await request(`/api/documents/${reviewDocument.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "Klaar voor delen" })
    });
    assert(releasedDocument.status === "Klaar voor delen", "Document should be releasable.");

    const publicPortal = await request(`/api/portal/${invite.token}`, {
      headers: { Cookie: "" }
    });
    assert(publicPortal.messages.some((item) => item.subject === conceptMessage.subject), "Portal should expose released messages.");
    assert(publicPortal.documents.some((item) => item.title === reviewDocument.title), "Portal should expose released documents.");

    const draft = await request("/api/ai/generate", {
      method: "POST",
      body: JSON.stringify({ workflow: "note", source: "Client ervaart stress en zoekt opvolging." })
    });
    assert(draft.output.includes("Sessienota concept"), "AI workflow should generate a note draft.");

    const approved = await request(`/api/ai/drafts/${draft.id}/approve`, {
      method: "POST",
      body: JSON.stringify({})
    });
    assert(approved.status === "Goedgekeurd", "AI draft should be approvable.");

    console.log("PraktijkOS product verification passed.");
  } finally {
    await stopServer(server);
    await removeTempDir();
    if (serverError.trim()) {
      process.stderr.write(serverError);
    }
  }
}

verify().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
