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
    assert(state.workQueue.some((task) => task.action), "Seed tasks should include guided workflow actions.");
    assert(state.waitlist.length > 0, "Seed waitlist should be available.");
    assert(state.dayClose.length > 0, "Seed day close checklist should be available.");
    assert(state.retentionPolicies.length > 0, "Seed retention policies should be available.");
    assert(state.knowledgeBase.length > 0, "Seed knowledge base should be available.");
    assert(state.aiModels.length > 0, "Seed AI model registry should be available.");
    assert(state.aiModelEvaluations.length > 0, "Seed AI model evaluations should be available.");
    assert(state.voiceConsents.length > 0, "Seed voice consent controls should be available.");
    assert(
      state.retentionPolicies.some((policy) => policy.category === "Dossier" && policy.status === "Actief"),
      "Dossier retention policy should be active."
    );

    const completedTask = await request("/api/tasks/q-001/complete", {
      method: "POST",
      body: JSON.stringify({})
    });
    assert(completedTask.status === "Klaar", "Task should be completable.");
    assert(completedTask.completedAt, "Completed task should include completion metadata.");

    const completedDayCheck = await request("/api/day-close/dc-001/complete", {
      method: "POST",
      body: JSON.stringify({})
    });
    assert(completedDayCheck.status === "Klaar", "Day close item should be completable.");
    assert(completedDayCheck.completedAt, "Completed day close item should include completion metadata.");

    const importPreview = await request("/api/import/preview", {
      method: "POST",
      body: JSON.stringify({
        kind: "clients",
        csv: "naam;leeftijd;traject;status;zorgverlener\nImport Client;38;Migratie test;Intakefase;L. Janssens"
      })
    });
    assert(importPreview.rowCount === 1, "Import preview should parse one row.");
    assert(importPreview.mappedRows[0].values.name === "Import Client", "Import preview should map client name.");
    const appliedImport = await request(`/api/import/${importPreview.id}/apply`, {
      method: "POST",
      body: JSON.stringify({})
    });
    assert(appliedImport.created === 1, "Import apply should create one client.");
    const importedState = await request("/api/state");
    assert(importedState.clients.some((item) => item.name === "Import Client"), "Applied import should add the client.");
    const rollbackImport = await request(`/api/import/${importPreview.id}/rollback`, {
      method: "POST",
      body: JSON.stringify({})
    });
    assert(rollbackImport.removed === 1, "Import rollback should remove one created record.");
    const rollbackState = await request("/api/state");
    assert(!rollbackState.clients.some((item) => item.name === "Import Client"), "Rolled back import should remove the client.");

    const waitlistEntry = state.waitlist[0];
    const waitlistAppointment = await request(`/api/waitlist/${waitlistEntry.id}/schedule`, {
      method: "POST",
      body: JSON.stringify({
        time: "18:00",
        type: waitlistEntry.type,
        clinician: "L. Janssens",
        location: "Online"
      })
    });
    assert(waitlistAppointment.waitlistId === waitlistEntry.id, "Waitlist item should schedule an appointment.");

    const scheduledState = await request("/api/state");
    assert(
      !scheduledState.waitlist.some((item) => item.id === waitlistEntry.id),
      "Scheduled waitlist item should be removed from the waitlist."
    );
    assert(
      scheduledState.appointments.some((item) => item.id === waitlistAppointment.id),
      "Scheduled waitlist appointment should appear in the agenda."
    );

    const client = await request("/api/clients", {
      method: "POST",
      body: JSON.stringify({
        name: "Verificatie Client",
        age: 41,
        track: "Product verificatie",
        clinician: "L. Janssens"
      })
    });

    const accessOverride = await request(`/api/clients/${client.id}/access-overrides`, {
      method: "POST",
      body: JSON.stringify({
        memberId: "usr-003",
        access: "Tijdelijke review",
        reason: "Verificatie van dossieruitzonderingen"
      })
    });
    assert(accessOverride.clientId === client.id, "Access override should link to the client.");
    assert(accessOverride.status === "Actief", "Access override should be active.");
    const updatedAccessOverride = await request(`/api/access-overrides/${accessOverride.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "Ingetrokken" })
    });
    assert(updatedAccessOverride.status === "Ingetrokken", "Access override should be revocable.");

    const updatedRetentionPolicy = await request("/api/retention-policies/ret-004", {
      method: "PATCH",
      body: JSON.stringify({ status: "Review nodig" })
    });
    assert(updatedRetentionPolicy.status === "Review nodig", "Retention policy status should be editable.");
    assert(updatedRetentionPolicy.reviewedAt, "Retention policy update should include review metadata.");
    const reviewedRetentionPolicy = await request("/api/retention-policies/ret-004/review", {
      method: "POST",
      body: JSON.stringify({})
    });
    assert(reviewedRetentionPolicy.status === "Actief", "Retention review should reactivate the policy.");
    assert(reviewedRetentionPolicy.nextReviewDue, "Retention review should set the next review label.");

    const auditExport = await request("/api/audit/export?filter=retention");
    assert(auditExport.summary.exportedEvents >= 1, "Retention audit export should include retention events.");
    assert(auditExport.files.csv.includes("Retentie"), "Retention audit export should include CSV content.");

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

    const note = await request("/api/notes", {
      method: "POST",
      body: JSON.stringify({
        clientId: client.id,
        title: "Verificatie nota",
        body: "Deze nota hoort in de dossierexport.",
        status: "Afgewerkt"
      })
    });
    assert(note.title === "Verificatie nota", "Note should be created.");

    let blockedVoiceNoteStatus = 0;
    try {
      await request(`/api/clients/${client.id}/voice-notes`, {
        method: "POST",
        body: JSON.stringify({ transcript: "Transcript zonder consent", consentConfirmed: true })
      });
    } catch (error) {
      blockedVoiceNoteStatus = error.status;
    }
    assert(blockedVoiceNoteStatus === 403, "Voice note should require active consent.");
    const voiceConsent = await request(`/api/clients/${client.id}/voice-consent`, {
      method: "POST",
      body: JSON.stringify({ scope: "Sessie-audio naar conceptnota", expiresAt: "Alleen vandaag" })
    });
    assert(voiceConsent.status === "Actief", "Voice consent should be recorded.");
    const voiceNote = await request(`/api/clients/${client.id}/voice-notes`, {
      method: "POST",
      body: JSON.stringify({
        transcript: "Client benoemt stress en concrete vervolgstap.",
        transcriptSource: "Dictaat zorgverlener",
        quality: "Nagekeken door zorgverlener",
        transcriptReviewed: true,
        consentConfirmed: true
      })
    });
    assert(voiceNote.status === "Review nodig", "Voice transcript should become a review note.");
    assert(voiceNote.consentId === voiceConsent.id, "Voice note should reference consent.");
    assert(voiceNote.transcriptSource === "Dictaat zorgverlener", "Voice note should store transcript provenance.");
    assert(voiceNote.transcriptReviewed === true, "Voice note should require transcript review.");

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

    const billingExport = await request("/api/billing/export", {
      method: "POST",
      body: JSON.stringify({})
    });
    assert(billingExport.summary.invoiceCount >= 1, "Billing export should summarize invoices.");
    assert(billingExport.files.csv.includes("factuur_id"), "Billing export should include CSV headers.");
    assert(
      billingExport.lines.some((invoice) => invoice.appointmentId === appointment.id),
      "Billing export should include the generated invoice."
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
        channel: "Client portal",
        consentNote: "Inhoudelijke info via portaal."
      })
    });
    assert(conceptMessage.subject === "Verificatie portal", "Message should be created.");
    assert(conceptMessage.consentNote, "Message should keep consent context.");

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

    const portalIntake = await request(`/api/portal/${invite.token}/intake`, {
      method: "POST",
      headers: { Cookie: "" },
      body: JSON.stringify({
        hulpvraag: "Verificatie hulpvraag via portal",
        voorkeur: "Donderdagavond",
        voorgeschiedenis: "Geen eerdere begeleiding"
      })
    });
    assert(portalIntake.status === "Ingediend", "Portal intake should be submitted.");

    const hiddenPortal = await request(`/api/portal/${invite.token}`, {
      headers: { Cookie: "" }
    });
    assert(hiddenPortal.client.name === client.name, "Portal should expose the invited client.");
    assert(hiddenPortal.intakes.some((item) => item.id === portalIntake.id), "Portal should show submitted intake.");
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

    const revokedInvite = await request(`/api/portal/invites/${invite.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "Ingetrokken" })
    });
    assert(revokedInvite.status === "Ingetrokken", "Portal invite should be revocable.");

    let revokedPortalStatus = 0;
    try {
      await request(`/api/portal/${invite.token}`, {
        headers: { Cookie: "" }
      });
    } catch (error) {
      revokedPortalStatus = error.status;
    }
    assert(revokedPortalStatus === 404, "Revoked portal invite should block public access.");

    const reactivatedInvite = await request(`/api/portal/invites/${invite.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "Actief" })
    });
    assert(reactivatedInvite.status === "Actief", "Portal invite should be reactivatable.");

    const restoredPortal = await request(`/api/portal/${invite.token}`, {
      headers: { Cookie: "" }
    });
    assert(restoredPortal.client.name === client.name, "Reactivated portal invite should restore public access.");

    const knowledgeItem = await request("/api/knowledge-base", {
      method: "POST",
      body: JSON.stringify({
        category: "AI",
        title: "Verificatie kennisregel",
        content: "Gebruik korte, duidelijke taal in concepten.",
        status: "Actief"
      })
    });
    assert(knowledgeItem.title === "Verificatie kennisregel", "Knowledge base item should be created.");
    const updatedKnowledgeItem = await request(`/api/knowledge-base/${knowledgeItem.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "Gearchiveerd",
        content: "Gebruik korte, duidelijke taal in concepten. Gearchiveerd na verificatie."
      })
    });
    assert(updatedKnowledgeItem.version === 2, "Knowledge base update should increment version.");
    assert(updatedKnowledgeItem.history.length === 1, "Knowledge base update should keep version history.");

    const modelEvaluation = await request("/api/ai-models/model-care-review/evaluations", {
      method: "POST",
      body: JSON.stringify({
        score: "Goedgekeurd",
        status: "Verificatie afgerond",
        notes: "Modelmetadata en reviewlabels gecontroleerd."
      })
    });
    assert(modelEvaluation.modelId === "model-care-review", "Model evaluation should link to the model.");
    assert(modelEvaluation.score === "Goedgekeurd", "Model evaluation should store score.");

    const draft = await request("/api/ai/generate", {
      method: "POST",
      body: JSON.stringify({ workflow: "note", source: "Client ervaart stress en zoekt opvolging.", modelId: "model-care-review" })
    });
    assert(draft.output.includes("Sessienota concept"), "AI workflow should generate a note draft.");
    assert(draft.output.includes("Praktijkkennis toegepast"), "AI workflow should include practice knowledge context.");
    assert(draft.modelId === "model-care-review", "AI draft should record the selected model.");
    assert(draft.promptVersion === "care-v1", "AI draft should record prompt version.");

    const approved = await request(`/api/ai/drafts/${draft.id}/approve`, {
      method: "POST",
      body: JSON.stringify({ clientId: client.id, storeAsNote: true })
    });
    assert(approved.status === "Goedgekeurd", "AI draft should be approvable.");
    assert(approved.savedNoteId, "Approved note draft should be saved into the client dossier.");

    const dossierExport = await request(`/api/clients/${client.id}/export`);
    assert(dossierExport.client.name === client.name, "Client export should include client identity.");
    assert(dossierExport.records.appointments.some((item) => item.id === appointment.id), "Client export should include appointments.");
    assert(dossierExport.records.notes.some((item) => item.id === note.id), "Client export should include notes.");
    assert(dossierExport.records.notes.some((item) => item.sourceDraftId === draft.id), "Client export should include approved AI note.");
    assert(dossierExport.records.messages.some((item) => item.id === conceptMessage.id), "Client export should include messages.");
    assert(dossierExport.records.documents.some((item) => item.id === reviewDocument.id), "Client export should include documents.");
    assert(dossierExport.records.invoices.some((item) => item.appointmentId === appointment.id), "Client export should include invoices.");

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
