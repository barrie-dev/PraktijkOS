import { getWorkflowLabel } from "./ai.js";

const viewTitles = {
  dashboard: "Dashboard",
  agenda: "Agenda",
  clients: "Clienten",
  intake: "Intake",
  portal: "Portal",
  billing: "Facturatie",
  ai: "AI Copilot",
  settings: "Instellingen"
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatEuro(amount) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(amount);
}

function badge(label, signal = "success") {
  return `<span class="badge ${signal}">${escapeHtml(label)}</span>`;
}

function shell(state) {
  if (state.authStatus !== "authenticated") {
    return loginView(state);
  }

  if (!state.practice?.onboardingComplete) {
    return onboardingView(state);
  }

  const nav = [
    ["dashboard", "D", "Dashboard"],
    ["agenda", "A", "Agenda"],
    ["clients", "C", "Clienten"],
    ["intake", "I", "Intake"],
    ["portal", "P", "Portal"],
    ["billing", "E", "Facturatie"],
    ["ai", "AI", "AI Copilot"],
    ["settings", "S", "Instellingen"]
  ];

  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">P</div>
          <div><strong>PraktijkOS</strong><span>Praktijkbeheer</span></div>
        </div>
        <nav class="nav-list" aria-label="Hoofdnavigatie">
          ${nav.map(([view, icon, label]) => `
            <button class="nav-item ${state.view === view ? "active" : ""}" data-action="navigate" data-view="${view}" type="button">
              <span>${icon}</span>${label}
            </button>
          `).join("")}
        </nav>
        <div class="security-note">
          <span class="status-dot"></span>
          <div><strong>Review vereist</strong><p>AI-concepten worden pas gebruikt na goedkeuring.</p></div>
        </div>
      </aside>
      <main class="workspace">
        <header class="topbar">
          <div>
            <p class="eyebrow">${escapeHtml(state.practice?.name || "Groepspraktijk")} / ${state.locale}</p>
            <h1>${viewTitles[state.view]}</h1>
          </div>
          <div class="topbar-actions">
            <span class="connection-pill">${state.apiStatus === "connected" ? "Live opslag" : "Offline opslag"}</span>
            <span class="user-pill">${escapeHtml(state.currentUser?.name || "Gebruiker")}</span>
            <button class="icon-button" data-action="toggle-locale" type="button">${state.locale}</button>
            <button class="ghost-action" data-action="logout" type="button">Afmelden</button>
            <button class="primary-action" data-action="new-appointment" type="button">Nieuwe afspraak</button>
          </div>
        </header>
        ${renderView(state)}
      </main>
    </div>
    ${state.isLoading ? `<div class="loading-bar">Gegevens synchroniseren...</div>` : ""}
    ${modal(state)}
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
  `;
}

function onboardingView(state) {
  return `
    <main class="login-screen">
      <section class="setup-panel">
        <div class="brand login-brand">
          <div class="brand-mark">P</div>
          <div><strong>PraktijkOS</strong><span>Praktijkbeheer</span></div>
        </div>
        <div>
          <p class="eyebrow">Eerste inrichting</p>
          <h1>Richt je praktijk in</h1>
          <p class="login-copy">Leg de basis vast voor planning, facturatie, teamwerking en AI-review.</p>
        </div>
        <form data-form="onboarding" class="setup-form">
          <label class="field"><span>Praktijknaam</span><input name="name" value="${escapeHtml(state.practice.name)}" required></label>
          <div class="form-grid">
            <label class="field"><span>Taal</span><select name="language"><option ${state.practice.language === "NL" ? "selected" : ""}>NL</option><option ${state.practice.language === "FR" ? "selected" : ""}>FR</option></select></label>
            <label class="field"><span>Locaties</span><input name="locations" value="${escapeHtml(state.practice.locations.join(", "))}"></label>
          </div>
          <label class="field"><span>Betaalmethodes</span><input name="paymentMethods" value="${escapeHtml(state.practice.paymentMethods.join(", "))}"></label>
          <label class="field"><span>AI reviewbeleid</span><textarea name="aiPolicy" rows="4">${escapeHtml(state.practice.aiPolicy)}</textarea></label>
          <button class="primary-action" type="submit">Praktijk starten</button>
        </form>
      </section>
    </main>
  `;
}

function loginView(state) {
  return `
    <main class="login-screen">
      <section class="login-panel">
        <div class="brand login-brand">
          <div class="brand-mark">P</div>
          <div><strong>PraktijkOS</strong><span>Praktijkbeheer</span></div>
        </div>
        <div>
          <p class="eyebrow">Aanmelden</p>
          <h1>Welkom terug</h1>
          <p class="login-copy">Meld je aan om agenda, dossiers, facturatie en AI-concepten te beheren.</p>
        </div>
        <form data-form="login" class="login-form">
          <label class="field"><span>E-mail</span><input name="email" type="email" placeholder="naam@praktijk.be" autocomplete="username" required></label>
          <label class="field"><span>Wachtwoord</span><input name="password" type="password" placeholder="Je wachtwoord" autocomplete="current-password" required></label>
          ${state.loginError ? `<p class="form-error">${escapeHtml(state.loginError)}</p>` : ""}
          <button class="primary-action" type="submit">Aanmelden</button>
        </form>
      </section>
    </main>
  `;
}

function renderView(state) {
  if (state.view === "agenda") return agendaView(state);
  if (state.view === "clients") return clientsView(state);
  if (state.view === "intake") return intakeView(state);
  if (state.view === "portal") return portalView(state);
  if (state.view === "billing") return billingView(state);
  if (state.view === "ai") return aiView(state);
  if (state.view === "settings") return settingsView(state);
  return dashboardView(state);
}

function dashboardView(state) {
  const openAmount = state.invoices.reduce((total, invoice) => total + invoice.amount, 0);
  const noShowCount = state.appointments.filter((appointment) => appointment.signal === "danger").length;
  const pendingIntakes = state.intakes.filter((intake) => intake.status !== "Ingediend").length;
  const openTasks = state.workQueue.filter((task) => (task.status || "Open") !== "Klaar");

  return `
    <section class="metric-grid">
      <article class="metric"><span>Vandaag</span><strong>${state.appointments.length}</strong><small>afspraken gepland</small></article>
      <article class="metric"><span>AI concepten</span><strong>${state.aiDrafts.length}</strong><small>${state.aiDrafts.filter((draft) => draft.status === "Goedgekeurd").length} goedgekeurd</small></article>
      <article class="metric"><span>Openstaand</span><strong>${formatEuro(openAmount)}</strong><small>${state.invoices.length} facturen</small></article>
      <article class="metric"><span>Risico</span><strong>${noShowCount + pendingIntakes}</strong><small>opvolging nodig</small></article>
    </section>
    <section class="quick-actions">
      <button class="quick-action" data-action="new-client" type="button"><span>Nieuwe client</span><strong>Dossier starten</strong></button>
      <button class="quick-action" data-action="navigate" data-view="intake" type="button"><span>Intake</span><strong>Formulier verwerken</strong></button>
      <button class="quick-action" data-action="navigate" data-view="billing" type="button"><span>Facturatie</span><strong>Betalingen opvolgen</strong></button>
      <button class="quick-action" data-action="navigate" data-view="portal" type="button"><span>Portal</span><strong>Bericht of document</strong></button>
    </section>
    <section class="dashboard-grid">
      <div class="panel work-surface">
        <div class="panel-header">
          <div><span class="section-kicker">Dagplanning</span><h2>Vandaag</h2></div>
          <button class="ghost-action" data-action="new-appointment" type="button">Afspraak plannen</button>
        </div>
        <div class="day-table">
          ${state.appointments.map((appointment) => `
            <article class="day-row">
              <span class="time">${escapeHtml(appointment.time)}</span>
              <div>
                <strong>${escapeHtml(appointment.client)}</strong>
                <span>${escapeHtml(appointment.type)}</span>
              </div>
              <span>${escapeHtml(appointment.clinician)}</span>
              <span>${escapeHtml(appointment.location)}</span>
              ${badge(appointment.status, appointment.signal)}
            </article>
          `).join("")}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><div><span class="section-kicker">Prioriteiten</span><h2>Werkvoorraad</h2></div></div>
        <div class="task-list">
          ${openTasks.slice(0, 5).map((task) => `
            <article class="task-item">
              <strong>${escapeHtml(task.label)}</strong>
              <span>${escapeHtml(task.owner)} / ${escapeHtml(task.priority)} / ${escapeHtml(task.status || "Open")}</span>
              <div class="inline-actions">
                <button class="ghost-action" data-action="navigate" data-view="ai" type="button">Open workflow</button>
                <button class="ghost-action" data-action="complete-task" data-task-id="${escapeHtml(task.id)}" type="button">Klaar</button>
              </div>
            </article>
          `).join("")}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><div><span class="section-kicker">Signalen</span><h2>Opvolging</h2></div></div>
        <div class="risk-list">
          ${state.appointments.filter((appointment) => appointment.signal !== "success").map((appointment) => `
            <article class="risk-item">
              <div><strong>${escapeHtml(appointment.client)}</strong><span>${escapeHtml(appointment.aiHint)}</span></div>
              ${badge(appointment.status, appointment.signal)}
            </article>
          `).join("") || `<p class="empty-state">Geen kritieke signalen.</p>`}
          ${pendingIntakes ? `<article class="risk-item"><div><strong>${pendingIntakes} intake open</strong><span>Clientinput ontbreekt voor volledige dossierstart.</span></div>${badge("Intake", "warning")}</article>` : ""}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><div><span class="section-kicker">Historiek</span><h2>Audit</h2></div></div>
        ${auditList(state, 5)}
      </div>
    </section>
  `;
}

function agendaView(state) {
  const filter = state.appointmentFilter.toLowerCase();
  const appointments = state.appointments.filter((appointment) =>
    [appointment.client, appointment.type, appointment.clinician, appointment.location, appointment.status].join(" ").toLowerCase().includes(filter)
  );

  return `
    <section class="toolbar">
      <div class="segmented"><button class="selected" type="button">Dag</button><button type="button">Week</button><button type="button">Wachtlijst</button></div>
      <label class="search-field"><span>Zoek</span><input data-action="filter-appointments" type="search" value="${escapeHtml(state.appointmentFilter)}" placeholder="Client, zorgverlener of type"></label>
    </section>
    <section class="schedule-board">
      ${appointments.map((appointment) => `
        <article class="schedule-card">
          <header><div><span class="time">${escapeHtml(appointment.time)}</span><strong>${escapeHtml(appointment.client)}</strong></div>${badge(appointment.status, appointment.signal)}</header>
          <p>${escapeHtml(appointment.type)}</p>
          <span>${escapeHtml(appointment.clinician)} / ${escapeHtml(appointment.location)}</span>
          <p>${escapeHtml(appointment.aiHint)}</p>
          <button class="ghost-action" data-action="prepare-ai" data-source="${escapeHtml(`${appointment.client}: ${appointment.aiHint}`)}" type="button">AI actie</button>
        </article>
      `).join("")}
    </section>
  `;
}

function clientsView(state) {
  const filter = state.clientFilter.toLowerCase();
  const clients = state.clients.filter((client) =>
    [client.name, client.track, client.status, client.clinician].join(" ").toLowerCase().includes(filter)
  );
  const selected = state.clients.find((client) => client.id === state.selectedClientId) || state.clients[0];
  if (!selected) {
    return `
      <section class="toolbar">
        <label class="search-field"><span>Zoek</span><input data-action="filter-clients" type="search" value="${escapeHtml(state.clientFilter)}" placeholder="Naam, traject of status"></label>
        <button class="primary-action" data-action="new-client" type="button">Nieuwe client</button>
      </section>
      <section class="panel"><p class="empty-state">Nog geen clienten.</p></section>
    `;
  }

  const activity = clientActivity(state, selected);
  const clientAppointments = state.appointments.filter((item) => item.clientId === selected.id);
  const clientIntakes = state.intakes.filter((item) => item.clientId === selected.id);
  const clientNotes = (state.notes || []).filter((item) => item.clientId === selected.id);
  const clientMessages = state.messages.filter((item) => item.clientId === selected.id);
  const clientDocuments = state.documents.filter((item) => item.clientId === selected.id);
  const clientInvoices = state.invoices.filter((item) => item.clientId === selected.id || item.client === selected.name);
  const nextAppointment = clientAppointments[0];
  const openInvoiceTotal = clientInvoices
    .filter((item) => item.status !== "Betaald")
    .reduce((total, item) => total + Number(item.amount || 0), 0);
  const dossierReadiness = [
    { label: "Intake", done: clientIntakes.length > 0 },
    { label: "Nota's", done: clientNotes.length > 0 },
    { label: "Planning", done: clientAppointments.length > 0 },
    { label: "Documenten", done: clientDocuments.length > 0 },
    { label: "Communicatie", done: clientMessages.length > 0 },
    { label: "Facturatie", done: clientInvoices.length > 0 }
  ];

  return `
    <section class="toolbar">
      <label class="search-field"><span>Zoek</span><input data-action="filter-clients" type="search" value="${escapeHtml(state.clientFilter)}" placeholder="Naam, traject of status"></label>
      <button class="primary-action" data-action="new-client" type="button">Nieuwe client</button>
    </section>
    <section class="client-layout">
      <div class="client-list">
        ${clients.map((client) => `
          <button class="client-card ${client.id === selected.id ? "active" : ""}" data-action="select-client" data-client-id="${escapeHtml(client.id)}" type="button">
            <strong>${escapeHtml(client.name)}</strong><span>${escapeHtml(client.track)}</span>${badge(client.status)}
          </button>
        `).join("")}
      </div>
      <article class="panel client-detail">
        <div class="dossier-header">
          <div>
            <span class="section-kicker">Clientdossier</span>
            <h2>${escapeHtml(selected.name)}</h2>
            <p>${escapeHtml(selected.track)}</p>
          </div>
          ${badge(selected.status)}
        </div>

        <div class="action-strip">
          <button class="primary-action" data-action="prepare-ai" data-source="${escapeHtml(`${selected.name}: ${selected.aiSuggestion}`)}" type="button">AI workflow</button>
          <button class="ghost-action" data-action="new-appointment" type="button">Afspraak</button>
          <button class="ghost-action" data-action="navigate" data-view="portal" type="button">Bericht</button>
        </div>

        <div class="care-strip dossier-metrics">
          <div><span>Leeftijd</span><strong>${escapeHtml(selected.age)}</strong></div>
          <div><span>Zorgverlener</span><strong>${escapeHtml(selected.clinician)}</strong></div>
          <div><span>Volgende afspraak</span><strong>${escapeHtml(nextAppointment ? `${nextAppointment.time} / ${nextAppointment.type}` : selected.nextAppointment)}</strong></div>
          <div><span>Openstaand</span><strong>${formatEuro(openInvoiceTotal)}</strong></div>
        </div>

        <div class="dossier-grid">
          <section class="dossier-section">
            <h3>Dossierstatus</h3>
            <dl>
              <dt>Administratie</dt><dd>${escapeHtml(selected.adminStatus)}</dd>
              <dt>AI voorstel</dt><dd>${escapeHtml(selected.aiSuggestion)}</dd>
            </dl>
          </section>

          <section class="dossier-section">
            <h3>Compleetheid</h3>
            <div class="readiness-list">
              ${dossierReadiness.map((item) => `
                <span class="${item.done ? "ready" : ""}">${item.done ? "✓" : "·"} ${escapeHtml(item.label)}</span>
              `).join("")}
            </div>
          </section>

          <section class="dossier-section">
            <h3>Open acties</h3>
            <div class="dossier-actions">
              ${!clientIntakes.length ? `<button class="ghost-action" data-action="navigate" data-view="intake" type="button">Intake vastleggen</button>` : ""}
              ${!clientAppointments.length ? `<button class="ghost-action" data-action="new-appointment" type="button">Eerste afspraak plannen</button>` : ""}
              ${!clientMessages.length ? `<button class="ghost-action" data-action="navigate" data-view="portal" type="button">Bericht voorbereiden</button>` : ""}
              ${clientInvoices.some((item) => item.status === "Open" || item.status === "Herinnering") ? `<button class="ghost-action" data-action="navigate" data-view="billing" type="button">Betaling opvolgen</button>` : ""}
              <button class="ghost-action" data-action="prepare-ai" data-source="${escapeHtml(`${selected.name}: ${selected.aiSuggestion}`)}" type="button">AI concept maken</button>
            </div>
          </section>

          <section class="dossier-section">
            <h3>Financieel</h3>
            <div class="mini-list">
              ${clientInvoices.map((invoice) => `
                <article><strong>${formatEuro(invoice.amount)}</strong><span>${escapeHtml(invoice.channel)} / ${escapeHtml(invoice.status)}</span></article>
              `).join("") || `<p class="empty-state">Nog geen facturatie.</p>`}
            </div>
          </section>

          <form class="dossier-section" data-form="note">
            <h3>Sessienota</h3>
            <input type="hidden" name="clientId" value="${escapeHtml(selected.id)}">
            <label class="field"><span>Titel</span><input name="title" value="Nieuwe sessienota" required></label>
            <label class="field"><span>Nota</span><textarea name="body" rows="5" placeholder="Bespreking, observaties, afspraken en opvolging" required></textarea></label>
            <label class="field"><span>Status</span><select name="status"><option>Concept</option><option>Review nodig</option><option>Afgewerkt</option></select></label>
            <button class="primary-action" type="submit">Nota opslaan</button>
          </form>

          <section class="dossier-section">
            <h3>Nota's</h3>
            <div class="mini-list">
              ${clientNotes.map((note) => `
                <article><div><strong>${escapeHtml(note.title)}</strong><span>${escapeHtml(note.author)} / ${escapeHtml(note.status)} / ${escapeHtml(note.createdAt)}</span></div></article>
              `).join("") || `<p class="empty-state">Nog geen sessienota's.</p>`}
            </div>
          </section>

          <section class="dossier-section wide">
            <h3>Activiteit</h3>
            <div class="activity-list">
              ${activity.map((item) => `
                <article class="activity-item">
                  <span>${escapeHtml(item.type)}</span>
                  <div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></div>
                </article>
              `).join("") || `<p class="empty-state">Nog geen activiteit.</p>`}
            </div>
          </section>
        </div>
      </article>
    </section>
  `;
}

function clientActivity(state, client) {
  if (!client) return [];
  const items = [];
  state.appointments.filter((item) => item.clientId === client.id).forEach((item) => {
    items.push({ type: "Afspraak", title: `${item.time} / ${item.type}`, detail: `${item.clinician} / ${item.status}` });
  });
  state.intakes.filter((item) => item.clientId === client.id).forEach((item) => {
    items.push({ type: "Intake", title: item.status, detail: item.answers.hulpvraag });
  });
  state.documents.filter((item) => item.clientId === client.id).forEach((item) => {
    items.push({ type: "Document", title: item.title, detail: `${item.type} / ${item.status}` });
  });
  (state.notes || []).filter((item) => item.clientId === client.id).forEach((item) => {
    items.push({ type: "Nota", title: item.title, detail: `${item.author} / ${item.status}` });
  });
  state.messages.filter((item) => item.clientId === client.id).forEach((item) => {
    items.push({ type: "Bericht", title: item.subject, detail: `${item.channel} / ${item.status}` });
  });
  return items.slice(0, 8);
}

function intakeView(state) {
  return `
    <section class="content-grid">
      <form class="panel" data-form="intake">
        <div class="panel-header"><div><h2>Nieuwe intake</h2><p>Leg clientinput vast voor dossier en AI-samenvatting.</p></div></div>
        <label class="field"><span>Client</span><select name="clientId" required>${state.clients.map((client) => `<option value="${escapeHtml(client.id)}">${escapeHtml(client.name)}</option>`).join("")}</select></label>
        <label class="field"><span>Hulpvraag</span><textarea name="hulpvraag" rows="4" required></textarea></label>
        <label class="field"><span>Voorkeuren</span><input name="voorkeur" placeholder="Bijv. dinsdagavond, online mogelijk"></label>
        <label class="field"><span>Voorgeschiedenis</span><textarea name="voorgeschiedenis" rows="4"></textarea></label>
        <button class="primary-action" type="submit">Intake opslaan</button>
      </form>
      <div class="panel wide">
        <div class="panel-header"><div><h2>Intakes</h2><p>Status en AI-acties per ontvangen formulier.</p></div></div>
        <div class="intake-list">
          ${state.intakes.map((intake) => `
            <article class="intake-item">
              <div>
                <strong>${escapeHtml(intake.client)}</strong>
                <span>${escapeHtml(intake.status)}${intake.submittedAt ? ` / ${escapeHtml(intake.submittedAt)}` : ""}</span>
                <p>${escapeHtml(intake.answers.hulpvraag)}</p>
              </div>
              <button class="ghost-action" data-action="prepare-ai" data-source="${escapeHtml(`Intake ${intake.client}: hulpvraag ${intake.answers.hulpvraag}; voorkeur ${intake.answers.voorkeur}; voorgeschiedenis ${intake.answers.voorgeschiedenis}`)}" type="button">Vat samen met AI</button>
            </article>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function portalView(state) {
  const invites = state.portalInvites || [];

  return `
    <section class="settings-grid">
      <form class="panel" data-form="portal-invite">
        <div class="panel-header"><div><h2>Portaaltoegang</h2><p>Maak een tijdelijke toegang voor berichten, documenten en intake-status.</p></div></div>
        <label class="field"><span>Client</span><select name="clientId" required>${state.clients.map((client) => `<option value="${escapeHtml(client.id)}">${escapeHtml(client.name)}</option>`).join("")}</select></label>
        <button class="primary-action" type="submit">Toegang maken</button>
      </form>

      <form class="panel" data-form="message">
        <div class="panel-header"><div><h2>Nieuw bericht</h2><p>Bereid veilige clientcommunicatie voor.</p></div></div>
        <label class="field"><span>Client</span><select name="clientId" required>${state.clients.map((client) => `<option value="${escapeHtml(client.id)}">${escapeHtml(client.name)}</option>`).join("")}</select></label>
        <label class="field"><span>Onderwerp</span><input name="subject" value="Opvolging afspraak" required></label>
        <label class="field"><span>Bericht</span><textarea name="body" rows="5" required></textarea></label>
        <div class="form-grid">
          <label class="field"><span>Kanaal</span><select name="channel"><option>Client portal</option><option>Email concept</option><option>SMS reminder</option></select></label>
          <label class="field"><span>Status</span><select name="status"><option>Concept</option><option>Klaar voor verzending</option></select></label>
        </div>
        <button class="primary-action" type="submit">Bericht opslaan</button>
      </form>

      <form class="panel" data-form="document">
        <div class="panel-header"><div><h2>Document</h2><p>Registreer verslag, attest of nota voor review.</p></div></div>
        <label class="field"><span>Client</span><select name="clientId" required>${state.clients.map((client) => `<option value="${escapeHtml(client.id)}">${escapeHtml(client.name)}</option>`).join("")}</select></label>
        <label class="field"><span>Titel</span><input name="title" value="Verslag concept" required></label>
        <div class="form-grid">
          <label class="field"><span>Type</span><select name="type"><option>Verslag</option><option>Attest</option><option>Nota</option><option>Doorverwijsbrief</option></select></label>
          <label class="field"><span>Status</span><select name="status"><option>Review nodig</option><option>Klaar voor delen</option></select></label>
        </div>
        <button class="primary-action" type="submit">Document registreren</button>
      </form>

      <div class="panel wide">
        <div class="panel-header"><div><h2>Toegangen</h2><p>Actieve cliëntlinks voor de portal.</p></div></div>
        <div class="portal-list">
          ${invites.map((invite) => `
            <article class="portal-item">
              <div><strong>${escapeHtml(invite.client)}</strong><span>${escapeHtml(invite.status)} / aangemaakt door ${escapeHtml(invite.createdBy || "PraktijkOS")}</span><p><a href="${escapeHtml(invite.portalUrl)}" target="_blank" rel="noreferrer">${escapeHtml(invite.portalUrl)}</a></p></div>
              ${badge(invite.status, invite.status === "Actief" ? "success" : "warning")}
            </article>
          `).join("") || `<p class="empty-state">Nog geen portaaltoegangen.</p>`}
        </div>
      </div>

      <div class="panel wide">
        <div class="panel-header"><div><h2>Berichten</h2><p>Concepten en portalcommunicatie.</p></div></div>
        <div class="portal-list">
          ${state.messages.map((message) => `
            <article class="portal-item">
              <div><strong>${escapeHtml(message.subject)}</strong><span>${escapeHtml(message.client)} / ${escapeHtml(message.channel)} / ${escapeHtml(message.status)}</span><p>${escapeHtml(message.body)}</p></div>
              ${badge(message.status, message.status === "Concept" ? "warning" : "success")}
            </article>
          `).join("")}
        </div>
      </div>

      <div class="panel wide">
        <div class="panel-header"><div><h2>Documenten</h2><p>Dossierdocumenten en deelstatus.</p></div></div>
        <div class="portal-list">
          ${state.documents.map((document) => `
            <article class="portal-item">
              <div><strong>${escapeHtml(document.title)}</strong><span>${escapeHtml(document.client)} / ${escapeHtml(document.type)}</span></div>
              ${badge(document.status, document.status === "Review nodig" ? "warning" : "success")}
            </article>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function billingView(state) {
  const paid = state.invoices.filter((invoice) => invoice.status === "Betaald").reduce((total, invoice) => total + invoice.amount, 0);
  const open = state.invoices.filter((invoice) => invoice.status !== "Betaald").reduce((total, invoice) => total + invoice.amount, 0);
  const invoiceAppointments = state.appointments.filter((appointment) =>
    !state.invoices.some((invoice) => invoice.appointmentId === appointment.id)
  );

  return `
    <section class="content-grid">
      <div class="panel wide">
        <div class="panel-header"><div><h2>Facturen</h2><p>Belgische betaalopvolging met Peppol-ready status.</p></div><button class="primary-action" data-action="generate-invoices" type="button">Maak voorstellen</button></div>
        <div class="invoice-table">
          ${state.invoices.map((invoice) => `
            <article class="invoice-row rich-row">
              <div><strong>${escapeHtml(invoice.client)}</strong><span>${invoice.paidAt ? `Betaald ${escapeHtml(invoice.paidAt)}` : invoice.reminderSentAt ? `Herinnerd ${escapeHtml(invoice.reminderSentAt)}` : invoice.dueAt ? `Vervalt ${escapeHtml(invoice.dueAt)}` : "Nog op te volgen"}</span></div>
              <span>${formatEuro(invoice.amount)}</span>
              <label class="compact-select"><span>Methode</span><select data-action="invoice-channel" data-invoice-id="${escapeHtml(invoice.id)}">
                ${["Bancontact", "Wero", "Peppol", "Overschrijving"].map((channel) => `<option ${invoice.channel === channel ? "selected" : ""}>${channel}</option>`).join("")}
              </select></label>
              <div class="invoice-actions">
                ${badge(invoice.status, invoice.status === "Herinnering" ? "warning" : invoice.status === "Betaald" ? "success" : "warning")}
                <button class="ghost-action" data-action="remind-invoice" data-invoice-id="${escapeHtml(invoice.id)}" type="button">Herinner</button>
                <button class="ghost-action" data-action="mark-invoice-paid" data-invoice-id="${escapeHtml(invoice.id)}" type="button">Betaald</button>
              </div>
            </article>
          `).join("")}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><div><h2>Betaalstromen</h2><p>Bancontact, Wero en boekhouder-export.</p></div></div>
        <div class="payment-stack">
          <div><strong>${formatEuro(paid)}</strong><span>betaald in deze omgeving</span></div>
          <div><strong>${formatEuro(open)}</strong><span>openstaand of in voorstel</span></div>
          <div><strong>${state.invoices.filter((invoice) => invoice.status === "Herinnering").length}</strong><span>herinneringen actief</span></div>
        </div>
      </div>
      <form class="panel" data-form="invoice">
        <div class="panel-header"><div><h2>Nieuwe factuur</h2><p>Maak een factuur of voorschot buiten de automatische voorstellen.</p></div></div>
        <label class="field"><span>Client</span><select name="clientId" required>${state.clients.map((client) => `<option value="${escapeHtml(client.id)}">${escapeHtml(client.name)}</option>`).join("")}</select></label>
        <label class="field"><span>Afspraak</span><select name="appointmentId"><option value="">Geen afspraak koppelen</option>${invoiceAppointments.map((appointment) => `<option value="${escapeHtml(appointment.id)}">${escapeHtml(`${appointment.client} / ${appointment.time} / ${appointment.type}`)}</option>`).join("")}</select></label>
        <div class="form-grid">
          <label class="field"><span>Bedrag</span><input name="amount" type="number" min="1" step="1" value="75" required></label>
          <label class="field"><span>Betaalmethode</span><select name="channel"><option>Bancontact</option><option>Wero</option><option>Peppol</option><option>Overschrijving</option></select></label>
        </div>
        <div class="form-grid">
          <label class="field"><span>Status</span><select name="status"><option>Voorstel</option><option>Open</option><option>Klaar</option></select></label>
          <label class="field"><span>Vervaldag</span><input name="dueAt" placeholder="Bijv. 15/07"></label>
        </div>
        <button class="primary-action" type="submit">Factuur maken</button>
      </form>
    </section>
  `;
}

function aiView(state) {
  return `
    <section class="ai-layout">
      <div class="panel">
        <div class="panel-header"><div><h2>AI Copilot</h2><p>Maak een concept voor intake, nota, verslag of facturatie.</p></div></div>
        <label class="field"><span>Workflow</span>
          <select data-action="ai-workflow">
            ${["intake", "note", "letter", "billing"].map((workflow) => `<option value="${workflow}" ${state.aiWorkflow === workflow ? "selected" : ""}>${getWorkflowLabel(workflow)}</option>`).join("")}
          </select>
        </label>
        <label class="field"><span>Broncontext</span><textarea data-action="ai-input" rows="9">${escapeHtml(state.aiSource || "Client meldt stressklachten, slaapproblemen en piekeren rond werk. Eerste gesprek, vraag naar kortdurende begeleiding. Wil graag afspraken op dinsdagavond.")}</textarea></label>
        <div class="ai-actions"><button class="primary-action" data-action="run-ai" type="button">Genereer concept</button><button class="ghost-action" data-action="clear-ai" type="button">Wis</button></div>
      </div>
      <div class="panel ai-output-panel">
        <div class="panel-header"><div><h2>Concept</h2><p>Controleer, pas aan en keur goed voor opslag.</p></div><span class="draft-badge">Concept</span></div>
        <pre>${escapeHtml(state.aiDraft)}</pre>
        <div class="approval-row">
          <label class="checkbox-line"><input data-action="approve-checkbox" type="checkbox" ${state.aiApproved ? "checked" : ""}><span>Gecontroleerd door zorgverlener</span></label>
          <button class="primary-action" data-action="approve-ai" type="button" ${state.aiApproved ? "" : "disabled"}>Goedkeuren</button>
        </div>
      </div>
      <div class="panel wide">
        <div class="panel-header"><div><h2>AI draft history</h2><p>Alle gegenereerde concepten met status.</p></div></div>
        ${draftList(state)}
      </div>
      <div class="panel wide">
        <div class="panel-header"><div><h2>Audit trail</h2><p>Controleerbare historiek voor praktijkhouder en compliance.</p></div></div>
        ${auditList(state)}
      </div>
    </section>
  `;
}

function settingsView(state) {
  return `
    <section class="settings-grid">
      <form class="panel" data-form="practice">
        <div class="panel-header"><div><h2>Praktijk</h2><p>Basisconfiguratie voor de groepspraktijk.</p></div></div>
        <label class="field"><span>Praktijknaam</span><input name="name" value="${escapeHtml(state.practice.name)}" required></label>
        <div class="form-grid">
          <label class="field"><span>Taal</span><select name="language"><option ${state.practice.language === "NL" ? "selected" : ""}>NL</option><option ${state.practice.language === "FR" ? "selected" : ""}>FR</option></select></label>
          <label class="field"><span>Locaties</span><input name="locations" value="${escapeHtml(state.practice.locations.join(", "))}"></label>
        </div>
        <label class="field"><span>Betaalmethodes</span><input name="paymentMethods" value="${escapeHtml(state.practice.paymentMethods.join(", "))}"></label>
        <label class="field"><span>AI policy</span><textarea name="aiPolicy" rows="4">${escapeHtml(state.practice.aiPolicy)}</textarea></label>
        <button class="primary-action" type="submit">Instellingen opslaan</button>
      </form>

      <form class="panel" data-form="team">
        <div class="panel-header"><div><h2>Team en rollen</h2><p>Voeg zorgverleners of secretariaatsrollen toe.</p></div></div>
        <label class="field"><span>Naam</span><input name="name" placeholder="Naam of functie" required></label>
        <div class="form-grid">
          <label class="field"><span>Rol</span><select name="role"><option>Zorgverlener</option><option>Praktijkhouder</option><option>Administratie</option></select></label>
          <label class="field"><span>Toegang</span><select name="access"><option>Eigen dossiers</option><option>Planning en facturatie</option><option>Volledig</option></select></label>
        </div>
        <button class="primary-action" type="submit">Teamlid toevoegen</button>
      </form>

      <div class="panel wide">
        <div class="panel-header"><div><h2>Actieve rollen</h2><p>Huidige toegangen in de praktijk.</p></div></div>
        <div class="team-table">
          ${state.team.map((member) => `
            <article class="team-row">
              <strong>${escapeHtml(member.name)}</strong>
              <span>${escapeHtml(member.role)}</span>
              <span>${escapeHtml(member.access)}</span>
            </article>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function draftList(state) {
  if (!state.aiDrafts.length) {
    return `<p class="empty-state">Nog geen AI concepten gegenereerd.</p>`;
  }

  return `
    <div class="audit-list">
      ${state.aiDrafts.map((draft) => `
        <article class="audit-item">
          <div><strong>${escapeHtml(getWorkflowLabel(draft.workflow))}</strong><span>${escapeHtml(draft.createdAt)}${draft.approvedAt ? ` / goedgekeurd ${escapeHtml(draft.approvedAt)}` : ""}</span></div>
          ${badge(draft.status, draft.status === "Goedgekeurd" ? "success" : "warning")}
        </article>
      `).join("")}
    </div>
  `;
}

function auditList(state, limit = 8) {
  return `
    <div class="audit-list">
      ${state.auditLog.slice(0, limit).map((entry) => `
        <article class="audit-item">
          <div><strong>${escapeHtml(entry.event)}</strong><span>${escapeHtml(entry.detail)}</span></div>
          <span class="audit-meta">${escapeHtml(entry.at)} / ${escapeHtml(displayActor(entry.actor))}</span>
        </article>
      `).join("")}
    </div>
  `;
}

function displayActor(actor = "") {
  return actor.includes("API") || actor === "System" ? "PraktijkOS" : actor;
}

function modal(state) {
  if (state.modal === "appointment") return appointmentModal(state);
  if (state.modal === "client") return clientModal();
  return "";
}

function appointmentModal(state) {
  return `
    <div class="modal-backdrop" data-action="close-modal">
      <form class="modal" data-form="appointment" aria-label="Nieuwe afspraak">
        <div class="panel-header">
          <div><h2>Nieuwe afspraak</h2><p>Plan een afspraak en werk clientstatus meteen bij.</p></div>
          <button class="icon-button" data-action="close-modal" type="button">Sluit</button>
        </div>
        <label class="field"><span>Client</span><select name="clientId" required>${state.clients.map((client) => `<option value="${escapeHtml(client.id)}">${escapeHtml(client.name)}</option>`).join("")}</select></label>
        <div class="form-grid">
          <label class="field"><span>Tijd</span><input name="time" type="time" value="09:00" required></label>
          <label class="field"><span>Locatie</span><input name="location" value="Praktijk" required></label>
        </div>
        <label class="field"><span>Afspraaktype</span><input name="type" value="Intakegesprek" required></label>
        <label class="field"><span>Zorgverlener</span><input name="clinician" value="L. Janssens" required></label>
        <div class="modal-actions">
          <button class="ghost-action" data-action="close-modal" type="button">Annuleer</button>
          <button class="primary-action" type="submit">Plan afspraak</button>
        </div>
      </form>
    </div>
  `;
}

function clientModal() {
  return `
    <div class="modal-backdrop" data-action="close-modal">
      <form class="modal" data-form="client" aria-label="Nieuwe client">
        <div class="panel-header">
          <div><h2>Nieuwe client</h2><p>Maak een dossierstarter aan voor intake en planning.</p></div>
          <button class="icon-button" data-action="close-modal" type="button">Sluit</button>
        </div>
        <label class="field"><span>Naam</span><input name="name" placeholder="Naam client" required></label>
        <div class="form-grid">
          <label class="field"><span>Leeftijd</span><input name="age" type="number" min="0" value="30"></label>
          <label class="field"><span>Status</span><select name="status"><option>Intakefase</option><option>Actief traject</option><option>Opvolging</option></select></label>
        </div>
        <label class="field"><span>Traject</span><input name="track" placeholder="Bijv. stress en slaapklachten" required></label>
        <label class="field"><span>Zorgverlener</span><input name="clinician" value="L. Janssens" required></label>
        <div class="modal-actions">
          <button class="ghost-action" data-action="close-modal" type="button">Annuleer</button>
          <button class="primary-action" type="submit">Maak client</button>
        </div>
      </form>
    </div>
  `;
}

export function renderApp(state) {
  return shell(state);
}
