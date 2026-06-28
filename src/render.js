import { getWorkflowLabel } from "./ai.js";

const viewTitles = {
  dashboard: "Vandaag",
  work: "Werk",
  agenda: "Agenda",
  waiting: "Wachtlijst",
  clients: "Dossiers",
  intake: "Intake",
  portal: "Berichten",
  billing: "Facturatie",
  ai: "Assistent",
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

function clientOptions(state, selectedId = state.selectedClientId) {
  return state.clients.map((client) =>
    `<option value="${escapeHtml(client.id)}" ${client.id === selectedId ? "selected" : ""}>${escapeHtml(client.name)}</option>`
  ).join("");
}

const appointmentStatuses = ["Nieuw", "Aanwezig", "Klaar voor facturatie", "Intake ontbreekt", "Opvolging nodig", "No-show risico", "Geannuleerd"];
const messageStatuses = ["Concept", "Klaar voor verzending", "Verzonden", "Gearchiveerd"];
const documentStatuses = ["Review nodig", "Klaar voor delen", "Gedeeld", "Gearchiveerd"];
const portalInviteStatuses = ["Actief", "Ingetrokken"];

const permissionsByRole = {
  Praktijkhouder: ["practice", "team", "care", "scheduling", "billing", "ai", "tasks"],
  Zorgverlener: ["care", "scheduling", "ai", "tasks"],
  Administratie: ["scheduling", "billing", "tasks"]
};

const viewPermissions = {
  dashboard: "tasks",
  work: "tasks",
  agenda: "scheduling",
  waiting: "scheduling",
  clients: "care",
  intake: "care",
  portal: "care",
  billing: "billing",
  ai: "ai",
  settings: "practice"
};

function can(state, permission) {
  return Boolean(permissionsByRole[state.currentUser?.role]?.includes(permission));
}

function canView(state, view) {
  return !viewPermissions[view] || can(state, viewPermissions[view]);
}

function firstAvailableView(state) {
  return ["dashboard", "work", "agenda", "waiting", "clients", "billing", "ai", "settings"].find((view) => canView(state, view)) || "dashboard";
}

function shell(state) {
  if (state.authStatus !== "authenticated") {
    return loginView(state);
  }

  if (!state.practice?.onboardingComplete) {
    return onboardingView(state);
  }

  const activeView = canView(state, state.view) ? state.view : firstAvailableView(state);
  const nav = [
    ["dashboard", "D", "Vandaag"],
    ["work", "W", "Werk"],
    ["agenda", "A", "Agenda"],
    ["waiting", "L", "Wachtlijst"],
    ["clients", "C", "Dossiers"],
    ["intake", "I", "Intake"],
    ["portal", "B", "Berichten"],
    ["billing", "E", "Facturatie"],
    ["ai", "AI", "Assistent"],
    ["settings", "S", "Instellingen"]
  ].filter(([view]) => canView(state, view));

  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">P</div>
          <div><strong>PraktijkOS</strong><span>Praktijkbeheer</span></div>
        </div>
        <nav class="nav-list" aria-label="Hoofdnavigatie">
          ${nav.map(([view, icon, label]) => `
            <button class="nav-item ${activeView === view ? "active" : ""}" data-action="navigate" data-view="${view}" type="button">
              <span>${icon}</span>${label}
            </button>
          `).join("")}
        </nav>
        <div class="security-note">
          <span class="status-dot"></span>
          <div><strong>Zorgvuldig werken</strong><p>${can(state, "ai") ? "Concepten worden pas opgeslagen na review." : "Je ziet alleen wat bij je rol hoort."}</p></div>
        </div>
      </aside>
      <main class="workspace">
        <header class="topbar">
          <div>
            <p class="eyebrow">${escapeHtml(state.practice?.name || "Groepspraktijk")}</p>
            <h1>${viewTitles[activeView]}</h1>
          </div>
          <div class="topbar-actions">
            <span class="connection-pill">${state.apiStatus === "connected" ? "Opgeslagen" : "Lokaal"}</span>
            <span class="user-pill">${escapeHtml(state.currentUser?.name || "Gebruiker")}</span>
            <button class="ghost-action" data-action="logout" type="button">Afmelden</button>
            ${can(state, "scheduling") ? `<button class="primary-action" data-action="new-appointment" type="button">Nieuwe afspraak</button>` : ""}
          </div>
        </header>
        ${renderView({ ...state, view: activeView })}
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
  if (state.view === "work") return workView(state);
  if (state.view === "agenda") return agendaView(state);
  if (state.view === "waiting") return waitingView(state);
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
  const analytics = state.analytics || {};

  return `
    <section class="metric-grid">
      <article class="metric"><span>Afspraken</span><strong>${state.appointments.length}</strong><small>vandaag gepland</small></article>
      <article class="metric"><span>Concepten</span><strong>${state.aiDrafts.length}</strong><small>${state.aiDrafts.filter((draft) => draft.status === "Goedgekeurd").length} klaar na review</small></article>
      <article class="metric"><span>Te innen</span><strong>${formatEuro(openAmount)}</strong><small>${state.invoices.length} betalingen</small></article>
      <article class="metric"><span>Aandacht</span><strong>${noShowCount + pendingIntakes}</strong><small>vragen opvolging</small></article>
    </section>
    <section class="quick-actions">
      ${can(state, "care") ? `<button class="quick-action" data-action="new-client" type="button"><span>Dossier</span><strong>Nieuwe client</strong></button>` : ""}
      ${can(state, "tasks") ? `<button class="quick-action" data-action="navigate" data-view="work" type="button"><span>Werk</span><strong>Taken opvolgen</strong></button>` : ""}
      ${can(state, "scheduling") ? `<button class="quick-action" data-action="navigate" data-view="waiting" type="button"><span>Wachtlijst</span><strong>Plan vrije plaats</strong></button>` : ""}
      ${can(state, "care") ? `<button class="quick-action" data-action="navigate" data-view="intake" type="button"><span>Intake</span><strong>Antwoorden vastleggen</strong></button>` : ""}
      ${can(state, "billing") ? `<button class="quick-action" data-action="navigate" data-view="billing" type="button"><span>Betalingen</span><strong>Facturen opvolgen</strong></button>` : ""}
    </section>
    <section class="dashboard-grid">
      <div class="panel wide">
        <div class="panel-header"><div><span class="section-kicker">Overzicht</span><h2>Wat vraagt vandaag aandacht?</h2></div></div>
        <div class="insight-grid">
          <article><span>Agenda gevuld</span><strong>${escapeHtml(analytics.occupancyRate ?? 0)}%</strong><small>van de dagcapaciteit</small></article>
          <article><span>Opvolging</span><strong>${escapeHtml(analytics.noShowRisk ?? noShowCount)}</strong><small>afspraken met signaal</small></article>
          <article><span>Ontvangen</span><strong>${formatEuro(analytics.paidRevenue ?? 0)}</strong><small>vandaag geregistreerd</small></article>
          <article><span>Werkvoorraad</span><strong>${escapeHtml(analytics.adminBacklog ?? openTasks.length)}</strong><small>taken open</small></article>
        </div>
      </div>

      <div class="panel work-surface">
        <div class="panel-header">
          <div><span class="section-kicker">Dagplanning</span><h2>Vandaag</h2></div>
          ${can(state, "scheduling") ? `<button class="ghost-action" data-action="new-appointment" type="button">Afspraak plannen</button>` : ""}
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
              <div class="day-actions">
                ${badge(appointment.status, appointment.signal)}
                <button class="ghost-action" data-action="open-client" data-client-id="${escapeHtml(appointment.clientId)}" type="button">Dossier</button>
              </div>
            </article>
          `).join("")}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><div><span class="section-kicker">Prioriteiten</span><h2>Werkvoorraad</h2></div><button class="ghost-action" data-action="navigate" data-view="work" type="button">Alle taken</button></div>
        <div class="task-list">
          ${openTasks.slice(0, 5).map((task) => taskCard(state, task, true)).join("")}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><div><span class="section-kicker">Signalen</span><h2>Opvolging</h2></div></div>
        <div class="risk-list">
          ${state.appointments.filter((appointment) => appointment.signal !== "success").map((appointment) => `
            <article class="risk-item">
              <div><strong>${escapeHtml(appointment.client)}</strong><span>${escapeHtml(appointment.aiHint)}</span></div>
              <div class="status-stack">
                ${badge(appointment.status, appointment.signal)}
                <button class="ghost-action" data-action="open-client" data-client-id="${escapeHtml(appointment.clientId)}" type="button">Open dossier</button>
              </div>
            </article>
          `).join("") || `<p class="empty-state">Geen kritieke signalen.</p>`}
          ${pendingIntakes ? `<article class="risk-item"><div><strong>${pendingIntakes} intake open</strong><span>Clientinput ontbreekt voor volledige dossierstart.</span></div><div class="status-stack">${badge("Intake", "warning")}<button class="ghost-action" data-action="navigate" data-view="intake" type="button">Naar intakes</button></div></article>` : ""}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><div><span class="section-kicker">Laatste wijzigingen</span><h2>Wat is net gebeurd?</h2></div></div>
        ${auditList(state, 5)}
      </div>
    </section>
  `;
}

function workView(state) {
  const openTasks = state.workQueue.filter((task) => (task.status || "Open") !== "Klaar");
  const doneTasks = state.workQueue.filter((task) => (task.status || "Open") === "Klaar");
  const highPriority = openTasks.filter((task) => task.priority === "Hoog").length;
  const dueToday = openTasks.filter((task) => task.dueAt === "Vandaag").length;

  return `
    <section class="metric-grid">
      <article class="metric"><span>Open</span><strong>${openTasks.length}</strong><small>taken in behandeling</small></article>
      <article class="metric"><span>Vandaag</span><strong>${dueToday}</strong><small>moeten opgevolgd worden</small></article>
      <article class="metric"><span>Hoog</span><strong>${highPriority}</strong><small>prioritaire acties</small></article>
      <article class="metric"><span>Klaar</span><strong>${doneTasks.length}</strong><small>afgewerkt</small></article>
    </section>
    <section class="content-grid">
      <div class="panel wide">
        <div class="panel-header"><div><span class="section-kicker">Werkvoorraad</span><h2>Wat moet er nu gebeuren?</h2></div></div>
        <div class="task-list rich-task-list">
          ${openTasks.map((task) => taskCard(state, task)).join("") || `<p class="empty-state">Geen open taken.</p>`}
        </div>
      </div>
      <div class="panel wide">
        <div class="panel-header"><div><span class="section-kicker">Afgewerkt</span><h2>Recent klaar</h2></div></div>
        <div class="task-list">
          ${doneTasks.slice(0, 6).map((task) => taskCard(state, task, true)).join("") || `<p class="empty-state">Nog niets afgewerkt.</p>`}
        </div>
      </div>
    </section>
  `;
}

function taskCard(state, task, compact = false) {
  const client = task.clientId ? state.clients.find((item) => item.id === task.clientId) : null;
  const status = task.status || "Open";
  const signal = status === "Klaar" ? "success" : task.priority === "Hoog" ? "danger" : "warning";
  const source = `${client?.name || "Praktijk"}: ${task.label}. ${task.description || ""}`;

  return `
    <article class="task-item ${compact ? "" : "rich-task"}">
      <div>
        <div class="task-heading">
          <strong>${escapeHtml(task.label)}</strong>
          ${badge(status, signal)}
        </div>
        <span>${escapeHtml(task.category || "Taak")} / ${escapeHtml(displayActor(task.owner))} / ${escapeHtml(task.priority || "Normaal")} / ${escapeHtml(task.dueAt || "Geen datum")}</span>
        ${compact ? "" : `<p>${escapeHtml(task.description || "Geen extra context.")}</p>`}
      </div>
      <div class="inline-actions">
        ${client ? `<button class="ghost-action" data-action="open-client" data-client-id="${escapeHtml(client.id)}" type="button">Dossier</button>` : ""}
        ${task.action === "message" && client ? `<button class="ghost-action" data-action="compose-message" data-client-id="${escapeHtml(client.id)}" type="button">Bericht</button>` : ""}
        ${task.action === "billing" ? `<button class="ghost-action" data-action="navigate" data-view="billing" type="button">Facturen</button>` : ""}
        ${task.action === "ai-note" && can(state, "ai") ? `<button class="ghost-action" data-action="prepare-ai" data-source="${escapeHtml(source)}" type="button">Nota maken</button>` : ""}
        ${task.action === "letter" && can(state, "ai") ? `<button class="ghost-action" data-action="prepare-ai" data-source="${escapeHtml(source)}" type="button">Brief maken</button>` : ""}
        ${task.action === "intake" && client ? `<button class="ghost-action" data-action="start-intake" data-client-id="${escapeHtml(client.id)}" type="button">Intake</button>` : ""}
        ${status !== "Klaar" ? `<button class="primary-action" data-action="complete-task" data-task-id="${escapeHtml(task.id)}" type="button">Klaar</button>` : ""}
      </div>
    </article>
  `;
}

function agendaView(state) {
  const filter = state.appointmentFilter.toLowerCase();
  const appointments = state.appointments.filter((appointment) =>
    [appointment.client, appointment.type, appointment.clinician, appointment.location, appointment.status].join(" ").toLowerCase().includes(filter)
  );

  return `
    <section class="toolbar">
      <label class="search-field"><span>Zoek</span><input data-action="filter-appointments" type="search" value="${escapeHtml(state.appointmentFilter)}" placeholder="Client, zorgverlener of type"></label>
      ${can(state, "scheduling") ? `<button class="primary-action" data-action="new-appointment" type="button">Afspraak plannen</button>` : ""}
    </section>
    <section class="schedule-board">
      ${appointments.map((appointment) => `
        <article class="schedule-card">
          <header><div><span class="time">${escapeHtml(appointment.time)}</span><strong>${escapeHtml(appointment.client)}</strong></div>${badge(appointment.status, appointment.signal)}</header>
          <p>${escapeHtml(appointment.type)}</p>
          <span>${escapeHtml(appointment.clinician)} / ${escapeHtml(appointment.location)}</span>
          <p>${escapeHtml(appointment.aiHint)}</p>
          <label class="compact-select"><span>Status</span><select data-action="appointment-status" data-appointment-id="${escapeHtml(appointment.id)}">
            ${appointmentStatuses.map((status) => `<option ${appointment.status === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
          </select></label>
          <div class="inline-actions">
            <button class="ghost-action" data-action="open-client" data-client-id="${escapeHtml(appointment.clientId)}" type="button">Dossier</button>
            <button class="ghost-action" data-action="compose-message" data-client-id="${escapeHtml(appointment.clientId)}" type="button">Bericht</button>
            ${can(state, "ai") ? `<button class="ghost-action" data-action="prepare-ai" data-source="${escapeHtml(`${appointment.client}: ${appointment.aiHint}`)}" type="button">Concept</button>` : ""}
          </div>
        </article>
      `).join("")}
    </section>
  `;
}

function waitingView(state) {
  const entries = state.waitlist || [];
  const highPriority = entries.filter((entry) => entry.priority === "Hoog").length;

  return `
    <section class="metric-grid">
      <article class="metric"><span>Wachtend</span><strong>${entries.length}</strong><small>clients zoeken een plek</small></article>
      <article class="metric"><span>Hoog</span><strong>${highPriority}</strong><small>prioritair te plannen</small></article>
      <article class="metric"><span>Vandaag</span><strong>${entries.filter((entry) => entry.addedAt === "Vandaag").length}</strong><small>nieuw aangemeld</small></article>
      <article class="metric"><span>Actie</span><strong>${entries.length ? "Plan" : "OK"}</strong><small>${entries.length ? "vrije slots benutten" : "geen wachtenden"}</small></article>
    </section>
    <section class="panel">
      <div class="panel-header"><div><span class="section-kicker">Planning</span><h2>Wachtlijst</h2></div><button class="ghost-action" data-action="new-appointment" type="button">Losse afspraak</button></div>
      <div class="waitlist-grid">
        ${entries.map((entry) => `
          <article class="waitlist-item">
            <div>
              <div class="task-heading">
                <strong>${escapeHtml(entry.client)}</strong>
                ${badge(entry.priority, entry.priority === "Hoog" ? "danger" : "warning")}
              </div>
              <span>${escapeHtml(entry.request)} / ${escapeHtml(entry.preferred)} / sinds ${escapeHtml(entry.addedAt)}</span>
              <p>${escapeHtml(entry.type || "Opvolggesprek")}</p>
            </div>
            <div class="inline-actions">
              <button class="ghost-action" data-action="open-client" data-client-id="${escapeHtml(entry.clientId)}" type="button">Dossier</button>
              <button class="ghost-action" data-action="compose-message" data-client-id="${escapeHtml(entry.clientId)}" type="button">Bericht</button>
              <button class="primary-action" data-action="schedule-waitlist" data-waitlist-id="${escapeHtml(entry.id)}" type="button">Plan afspraak</button>
            </div>
          </article>
        `).join("") || `<p class="empty-state">Geen wachtlijstitems.</p>`}
      </div>
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
      <section class="panel"><p class="empty-state">Nog geen dossiers.</p></section>
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
          <button class="ghost-action" data-action="schedule-client" data-client-id="${escapeHtml(selected.id)}" type="button">Afspraak plannen</button>
          <button class="ghost-action" data-action="compose-message" data-client-id="${escapeHtml(selected.id)}" type="button">Bericht maken</button>
          <button class="ghost-action" data-action="start-intake" data-client-id="${escapeHtml(selected.id)}" type="button">Intake aanvullen</button>
          <button class="ghost-action" data-action="export-client" data-client-id="${escapeHtml(selected.id)}" type="button">Dossier export</button>
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
              ${!clientIntakes.length ? `<button class="ghost-action" data-action="start-intake" data-client-id="${escapeHtml(selected.id)}" type="button">Intake vastleggen</button>` : ""}
              ${!clientAppointments.length ? `<button class="ghost-action" data-action="schedule-client" data-client-id="${escapeHtml(selected.id)}" type="button">Eerste afspraak plannen</button>` : ""}
              ${!clientMessages.length ? `<button class="ghost-action" data-action="compose-message" data-client-id="${escapeHtml(selected.id)}" type="button">Bericht voorbereiden</button>` : ""}
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
            <div class="section-row">
              <h3>Dossiertimeline</h3>
              <span>${activity.length} items</span>
            </div>
            <div class="activity-list">
              ${activity.map((item) => `
                <article class="activity-item">
                  <span>${escapeHtml(item.type)}</span>
                  <div>
                    <div class="activity-heading">
                      <strong>${escapeHtml(item.title)}</strong>
                      ${badge(item.status, item.signal)}
                    </div>
                    <small>${escapeHtml(item.detail)}</small>
                    <small>${escapeHtml(item.moment)}</small>
                  </div>
                  ${can(state, "ai") ? `<button class="ghost-action" data-action="prepare-ai" data-source="${escapeHtml(item.source)}" type="button">AI</button>` : ""}
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

  const signalFor = (status = "") => {
    if (["No-show risico", "Herinnering", "Ingetrokken", "Geannuleerd"].includes(status)) return "danger";
    if (["Concept", "Review nodig", "Onvolledig", "Intake ontbreekt", "Open", "Voorstel"].includes(status)) return "warning";
    return "success";
  };

  const addItem = (item) => {
    items.push({
      signal: signalFor(item.status),
      source: `${client.name}: ${item.type} - ${item.title}. ${item.detail}`,
      ...item
    });
  };

  state.appointments.filter((item) => item.clientId === client.id).forEach((item) => {
    addItem({
      type: "Afspraak",
      title: item.type,
      detail: `${item.clinician} / ${item.location}`,
      status: item.status,
      moment: `Vandaag ${item.time}`,
      order: 70 + Number(item.time.replace(":", "."))
    });
  });
  state.intakes.filter((item) => item.clientId === client.id).forEach((item) => {
    addItem({
      type: "Intake",
      title: item.answers.hulpvraag,
      detail: `${item.answers.voorkeur || "Geen voorkeur"} / ${item.answers.voorgeschiedenis || "Geen voorgeschiedenis"}`,
      status: item.status,
      moment: item.submittedAt || "Nog niet ingediend",
      order: item.submittedAt ? 90 : 40
    });
  });
  state.documents.filter((item) => item.clientId === client.id).forEach((item) => {
    addItem({
      type: "Document",
      title: item.title,
      detail: item.type,
      status: item.status,
      moment: item.createdAt || "Document",
      order: 60
    });
  });
  (state.notes || []).filter((item) => item.clientId === client.id).forEach((item) => {
    addItem({
      type: "Nota",
      title: item.title,
      detail: item.body || item.author,
      status: item.status,
      moment: item.createdAt || "Sessienota",
      order: 80
    });
  });
  state.messages.filter((item) => item.clientId === client.id).forEach((item) => {
    addItem({
      type: "Bericht",
      title: item.subject,
      detail: item.body || item.channel,
      status: item.status,
      moment: item.channel,
      order: 50
    });
  });
  state.invoices.filter((item) => item.clientId === client.id || item.client === client.name).forEach((item) => {
    addItem({
      type: "Factuur",
      title: formatEuro(item.amount),
      detail: item.channel,
      status: item.status,
      moment: item.paidAt || item.reminderSentAt || "Facturatie",
      order: 30
    });
  });

  return items.sort((a, b) => b.order - a.order || a.type.localeCompare(b.type)).slice(0, 12);
}

function intakeView(state) {
  return `
    <section class="content-grid">
      <form class="panel" data-form="intake">
        <div class="panel-header"><div><h2>Nieuwe intake</h2><p>Leg clientinput vast voor dossier en AI-samenvatting.</p></div></div>
        <label class="field"><span>Client</span><select name="clientId" required>${clientOptions(state)}</select></label>
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
        <label class="field"><span>Client</span><select name="clientId" required>${clientOptions(state)}</select></label>
        <button class="primary-action" type="submit">Toegang maken</button>
      </form>

      <form class="panel" data-form="message">
        <div class="panel-header"><div><h2>Nieuw bericht</h2><p>Bereid veilige clientcommunicatie voor.</p></div></div>
        <label class="field"><span>Client</span><select name="clientId" required>${clientOptions(state)}</select></label>
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
        <label class="field"><span>Client</span><select name="clientId" required>${clientOptions(state)}</select></label>
        <label class="field"><span>Titel</span><input name="title" value="Verslag concept" required></label>
        <div class="form-grid">
          <label class="field"><span>Type</span><select name="type"><option>Verslag</option><option>Attest</option><option>Nota</option><option>Doorverwijsbrief</option></select></label>
          <label class="field"><span>Status</span><select name="status"><option>Review nodig</option><option>Klaar voor delen</option></select></label>
        </div>
        <button class="primary-action" type="submit">Document registreren</button>
      </form>

      <div class="panel wide">
        <div class="panel-header"><div><h2>Toegangen</h2><p>Beheer clientlinks voor de portal.</p></div></div>
        <div class="portal-list">
          ${invites.map((invite) => `
            <article class="portal-item">
              <div><strong>${escapeHtml(invite.client)}</strong><span>${escapeHtml(invite.status)} / aangemaakt door ${escapeHtml(invite.createdBy || "PraktijkOS")}</span><p><a href="${escapeHtml(invite.portalUrl)}" target="_blank" rel="noreferrer">${escapeHtml(invite.portalUrl)}</a></p></div>
              <div class="status-stack">
                ${badge(invite.status, invite.status === "Actief" ? "success" : "warning")}
                <label class="compact-select"><span>Status</span><select data-action="portal-invite-status" data-invite-id="${escapeHtml(invite.id)}">
                  ${portalInviteStatuses.map((status) => `<option ${invite.status === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
                </select></label>
              </div>
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
              <div class="status-stack">
                ${badge(message.status, message.status === "Concept" ? "warning" : "success")}
                <label class="compact-select"><span>Status</span><select data-action="message-status" data-message-id="${escapeHtml(message.id)}">
                  ${messageStatuses.map((status) => `<option ${message.status === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
                </select></label>
              </div>
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
              <div class="status-stack">
                ${badge(document.status, document.status === "Review nodig" ? "warning" : "success")}
                <label class="compact-select"><span>Status</span><select data-action="document-status" data-document-id="${escapeHtml(document.id)}">
                  ${documentStatuses.map((status) => `<option ${document.status === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
                </select></label>
              </div>
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
  const exportSummary = state.billingExport?.summary;

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
      <div class="panel">
        <div class="panel-header"><div><h2>Boekhouderpakket</h2><p>CSV en JSON met facturen, statussen en afspraakkoppelingen.</p></div></div>
        <div class="handoff-summary">
          <div><strong>${exportSummary ? exportSummary.invoiceCount : state.invoices.length}</strong><span>facturen in pakket</span></div>
          <div><strong>${exportSummary ? formatEuro(exportSummary.openAmount) : formatEuro(open)}</strong><span>openstaand mee te geven</span></div>
          <div><strong>${exportSummary ? exportSummary.peppolCount : state.invoices.filter((invoice) => invoice.channel === "Peppol").length}</strong><span>Peppol-regels</span></div>
        </div>
        ${state.billingExport ? `<p class="handoff-note">${escapeHtml(state.billingExport.accountantMessage)}</p>` : `<p class="handoff-note">Maak een export wanneer de boekhouder of accountant om een actuele stand vraagt.</p>`}
        <button class="primary-action" data-action="export-billing" type="button">Maak boekhouderpakket</button>
      </div>
      <form class="panel" data-form="invoice">
        <div class="panel-header"><div><h2>Nieuwe factuur</h2><p>Maak een factuur of voorschot buiten de automatische voorstellen.</p></div></div>
        <label class="field"><span>Client</span><select name="clientId" required>${clientOptions(state)}</select></label>
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
        <div class="panel-header"><div><h2>Assistent</h2><p>Maak een concept voor intake, nota, verslag of facturatie.</p></div></div>
        <label class="field"><span>Workflow</span>
          <select data-action="ai-workflow">
            ${["intake", "note", "letter", "billing"].map((workflow) => `<option value="${workflow}" ${state.aiWorkflow === workflow ? "selected" : ""}>${getWorkflowLabel(workflow)}</option>`).join("")}
          </select>
        </label>
        <label class="field"><span>Client voor dossieropslag</span>
          <select data-action="ai-client">
            ${clientOptions(state)}
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
          <button class="primary-action" data-action="approve-ai" type="button" ${state.aiApproved ? "" : "disabled"}>${state.aiWorkflow === "note" ? "Goedkeuren en opslaan" : "Goedkeuren"}</button>
        </div>
      </div>
      <div class="panel wide">
        <div class="panel-header"><div><h2>Concepten</h2><p>Gegenereerde teksten en hun reviewstatus.</p></div></div>
        ${draftList(state)}
      </div>
      <div class="panel wide">
        <div class="panel-header"><div><h2>Wijzigingen</h2><p>Laatste acties in de praktijk.</p></div></div>
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
          <div><strong>${escapeHtml(getWorkflowLabel(draft.workflow))}</strong><span>${escapeHtml(draft.createdAt)}${draft.approvedAt ? ` / goedgekeurd ${escapeHtml(draft.approvedAt)}` : ""}${draft.savedNoteId ? " / opgeslagen als nota" : ""}</span></div>
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
  if (actor.includes("API") || actor === "System") return "PraktijkOS";
  if (actor === "AI Copilot") return "Assistent";
  return actor;
}

function modal(state) {
  if (state.modal === "appointment") return appointmentModal(state);
  if (state.modal === "waitlist") return waitlistModal(state);
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
        <label class="field"><span>Client</span><select name="clientId" required>${clientOptions(state)}</select></label>
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

function waitlistModal(state) {
  const entry = (state.waitlist || []).find((item) => item.id === state.selectedWaitlistId);
  if (!entry) return "";

  return `
    <div class="modal-backdrop" data-action="close-modal">
      <form class="modal" data-form="waitlist-appointment" aria-label="Wachtlijst plannen">
        <div class="panel-header">
          <div><h2>Plan vanuit wachtlijst</h2><p>${escapeHtml(entry.client)} / ${escapeHtml(entry.preferred)}</p></div>
          <button class="icon-button" data-action="close-modal" type="button">Sluit</button>
        </div>
        <input type="hidden" name="waitlistId" value="${escapeHtml(entry.id)}">
        <label class="field"><span>Client</span><input value="${escapeHtml(entry.client)}" disabled></label>
        <div class="form-grid">
          <label class="field"><span>Tijd</span><input name="time" type="time" value="09:00" required></label>
          <label class="field"><span>Locatie</span><input name="location" value="Praktijk" required></label>
        </div>
        <label class="field"><span>Afspraaktype</span><input name="type" value="${escapeHtml(entry.type || "Opvolggesprek")}" required></label>
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
