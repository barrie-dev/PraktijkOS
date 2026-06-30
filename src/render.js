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
  import: "Import",
  security: "Veiligheid",
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
const auditFilterOptions = [
  { value: "all", label: "Alle events" },
  { value: "exports", label: "Exports" },
  { value: "access", label: "Toegang" },
  { value: "ai", label: "AI" },
  { value: "retention", label: "Retentie" },
  { value: "import", label: "Import" },
  { value: "portal", label: "Portaal" },
  { value: "billing", label: "Facturatie" }
];

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
  import: "practice",
  security: "practice",
  settings: "practice"
};

function can(state, permission) {
  return Boolean(permissionsByRole[state.currentUser?.role]?.includes(permission));
}

function canView(state, view) {
  return !viewPermissions[view] || can(state, viewPermissions[view]);
}

function firstAvailableView(state) {
  return ["dashboard", "work", "agenda", "waiting", "clients", "billing", "ai", "import", "security", "settings"].find((view) => canView(state, view)) || "dashboard";
}

function commandResults(state) {
  const query = `${state.commandQuery || ""}`.trim().toLowerCase();
  if (query.length < 2) return [];

  const matches = (parts) => parts.join(" ").toLowerCase().includes(query);
  const results = [];

  state.clients
    .filter((client) => matches([client.name, client.track, client.status, client.clinician]))
    .slice(0, 4)
    .forEach((client) => {
      results.push({
        type: "Dossier",
        title: client.name,
        detail: `${client.track} / ${client.clinician}`,
        view: "clients",
        clientId: client.id
      });
    });

  state.appointments
    .filter((appointment) => matches([appointment.client, appointment.time, appointment.type, appointment.clinician, appointment.status]))
    .slice(0, 3)
    .forEach((appointment) => {
      results.push({
        type: "Afspraak",
        title: `${appointment.time} ${appointment.client}`,
        detail: `${appointment.type} / ${appointment.status}`,
        view: "agenda",
        appointmentFilter: appointment.client
      });
    });

  state.invoices
    .filter((invoice) => matches([invoice.client, invoice.channel, invoice.status, String(invoice.amount)]))
    .slice(0, 3)
    .forEach((invoice) => {
      results.push({
        type: "Factuur",
        title: invoice.client,
        detail: `${formatEuro(invoice.amount)} / ${invoice.status}`,
        view: "billing"
      });
    });

  (state.waitlist || [])
    .filter((entry) => matches([entry.client, entry.request, entry.preferred, entry.priority]))
    .slice(0, 2)
    .forEach((entry) => {
      results.push({
        type: "Wachtlijst",
        title: entry.client,
        detail: `${entry.request} / ${entry.preferred}`,
        view: "waiting"
      });
    });

  [
    { title: "Nieuwe afspraak", detail: "Plan meteen een afspraak", action: "new-appointment", permission: "scheduling" },
    { title: "Factuurvoorstellen", detail: "Maak facturen voor billable afspraken", view: "billing", permission: "billing" },
    { title: "AI concept", detail: "Open de assistent", view: "ai", permission: "ai" }
  ]
    .filter((item) => matches([item.title, item.detail]) && can(state, item.permission))
    .forEach((item) => results.push({ type: "Actie", ...item }));

  return results.slice(0, 8);
}

function commandPanel(state) {
  const results = commandResults(state);
  if (!state.commandQuery || state.commandQuery.trim().length < 2) return "";
  return `
    <div class="command-panel" role="listbox" aria-label="Zoekresultaten">
      ${results.map((result) => `
        <button class="command-result" data-action="command-open" data-command-action="${escapeHtml(result.action || "")}" data-view="${escapeHtml(result.view || "")}" data-client-id="${escapeHtml(result.clientId || "")}" data-appointment-filter="${escapeHtml(result.appointmentFilter || "")}" type="button">
          <span>${escapeHtml(result.type)}</span>
          <strong>${escapeHtml(result.title)}</strong>
          <small>${escapeHtml(result.detail)}</small>
        </button>
      `).join("") || `<p class="empty-state">Geen resultaten.</p>`}
    </div>
  `;
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
    ["import", "M", "Import"],
    ["security", "V", "Veiligheid"],
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
          <div class="command-search">
            <label>
              <span>Zoek</span>
              <input data-action="command-search" type="search" value="${escapeHtml(state.commandQuery || "")}" placeholder="Dossier, afspraak, factuur of actie">
            </label>
            ${commandPanel(state)}
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
  if (state.view === "import") return importView(state);
  if (state.view === "security") return securityView(state);
  if (state.view === "settings") return settingsView(state);
  return dashboardView(state);
}

function dashboardForecast(state, openTasks, pendingIntakes, noShowCount) {
  const openInvoices = state.invoices.filter((invoice) => invoice.status !== "Betaald");
  const highWaitlist = (state.waitlist || []).filter((entry) => entry.priority === "Hoog").length;
  const billableAppointments = state.appointments.filter((appointment) => ["Aanwezig", "Klaar voor facturatie"].includes(appointment.status)).length;
  const openAmount = openInvoices.reduce((total, invoice) => total + Number(invoice.amount || 0), 0);
  const busyLevel = state.appointments.length >= 8 ? "Vol" : state.appointments.length >= 5 ? "Druk" : "Beheersbaar";

  return [
    {
      label: "Dagdruk",
      value: busyLevel,
      detail: `${state.appointments.length} afspraken, ${openTasks.filter((task) => task.dueAt === "Vandaag").length} taken vandaag`,
      signal: state.appointments.length >= 5 ? "warning" : "success"
    },
    {
      label: "Zorgsignalen",
      value: noShowCount + pendingIntakes + highWaitlist,
      detail: `${noShowCount} no-show, ${pendingIntakes} intake, ${highWaitlist} wachtlijst hoog`,
      signal: noShowCount + pendingIntakes + highWaitlist > 0 ? "warning" : "success"
    },
    {
      label: "Facturatie",
      value: formatEuro(openAmount),
      detail: `${openInvoices.length} open, ${billableAppointments} klaar voor voorstel`,
      signal: openInvoices.length ? "warning" : "success"
    }
  ];
}

function secretaryLanes(state) {
  const openInvoices = state.invoices.filter((invoice) => invoice.status !== "Betaald");
  const reminderInvoices = state.invoices.filter((invoice) => invoice.status === "Herinnering");
  const conceptMessages = state.messages.filter((message) => message.status === "Concept");
  const reviewDocuments = state.documents.filter((document) => document.status === "Review nodig");
  const waitingHigh = (state.waitlist || []).filter((entry) => entry.priority === "Hoog");
  const dayCloseOpen = (state.dayClose || []).filter((item) => item.status !== "Klaar");

  return [
    {
      label: "Planning",
      value: waitingHigh.length + dayCloseOpen.length,
      detail: `${waitingHigh.length} prioritaire wachtlijst, ${dayCloseOpen.length} dagchecks open`,
      view: "waiting",
      action: "Wachtlijst"
    },
    {
      label: "Facturatie",
      value: openInvoices.length,
      detail: `${formatEuro(openInvoices.reduce((total, invoice) => total + Number(invoice.amount || 0), 0))} open, ${reminderInvoices.length} herinneringen`,
      view: "billing",
      action: "Facturen"
    },
    {
      label: "Communicatie",
      value: conceptMessages.length + reviewDocuments.length,
      detail: `${conceptMessages.length} berichtconcepten, ${reviewDocuments.length} documenten review`,
      view: "portal",
      action: "Berichten"
    }
  ];
}

function roleHome(state, openTasks, pendingIntakes, noShowCount) {
  if (state.currentUser?.role === "Administratie") {
    const adminLanes = secretaryLanes(state).filter((lane) => canView(state, lane.view));
    return `
      <section class="role-home">
        <div>
          <span class="section-kicker">Administratie</span>
          <h2>Onthaal en backoffice</h2>
          <p>Hou planning, betalingen en dagafsluiting strak zonder door zorgdossiers te moeten bladeren.</p>
        </div>
        <div class="role-home-grid">
          ${adminLanes.map((lane) => `
            <article class="role-home-card">
              <span>${escapeHtml(lane.label)}</span>
              <strong>${escapeHtml(lane.value)}</strong>
              <p>${escapeHtml(lane.detail)}</p>
              <button class="ghost-action" data-action="navigate" data-view="${escapeHtml(lane.view)}" type="button">${escapeHtml(lane.action)}</button>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  if (state.currentUser?.role === "Zorgverlener") {
    const careTasks = openTasks.filter((task) => ["Dossier", "Opvolging"].includes(task.category));
    const reviewDocuments = state.documents.filter((document) => document.status === "Review nodig");
    const careSignals = state.appointments.filter((appointment) => appointment.signal !== "success");
    return `
      <section class="role-home">
        <div>
          <span class="section-kicker">Zorgverlener</span>
          <h2>Cliëntzorg eerst</h2>
          <p>Start bij dossiers die context, review of opvolging vragen. Administratieve ruis blijft op de achtergrond.</p>
        </div>
        <div class="role-home-grid">
          <article class="role-home-card">
            <span>Vandaag</span>
            <strong>${escapeHtml(state.appointments.length)}</strong>
            <p>${escapeHtml(noShowCount)} signaalafspraken, ${escapeHtml(pendingIntakes)} intake open</p>
            <button class="ghost-action" data-action="navigate" data-view="agenda" type="button">Agenda</button>
          </article>
          <article class="role-home-card">
            <span>Dossierwerk</span>
            <strong>${escapeHtml(careTasks.length)}</strong>
            <p>${escapeHtml(careTasks.slice(0, 2).map((task) => task.label).join(", ") || "Geen dossierwerk open")}</p>
            <button class="ghost-action" data-action="navigate" data-view="work" type="button">Werk</button>
          </article>
          <article class="role-home-card">
            <span>Review</span>
            <strong>${escapeHtml(reviewDocuments.length + state.aiDrafts.filter((draft) => draft.status !== "Goedgekeurd").length)}</strong>
            <p>${escapeHtml(reviewDocuments.length)} documenten, ${escapeHtml(state.aiDrafts.filter((draft) => draft.status !== "Goedgekeurd").length)} AI-concepten</p>
            <button class="ghost-action" data-action="navigate" data-view="ai" type="button">Assistent</button>
          </article>
        </div>
        ${careSignals.length ? `
          <div class="role-strip">
            ${careSignals.slice(0, 3).map((appointment) => `
              <button class="role-strip-item" data-action="open-client" data-client-id="${escapeHtml(appointment.clientId)}" type="button">
                <strong>${escapeHtml(appointment.client)}</strong>
                <span>${escapeHtml(appointment.status)} / ${escapeHtml(appointment.aiHint)}</span>
              </button>
            `).join("")}
          </div>
        ` : ""}
      </section>
    `;
  }

  const ownerLanes = secretaryLanes(state).filter((lane) => canView(state, lane.view));
  return `
    <section class="secretary-lanes">
      ${ownerLanes.map((lane) => `
        <article class="secretary-lane">
          <div>
            <span>${escapeHtml(lane.label)}</span>
            <strong>${escapeHtml(lane.value)}</strong>
            <p>${escapeHtml(lane.detail)}</p>
          </div>
          <button class="ghost-action" data-action="navigate" data-view="${escapeHtml(lane.view)}" type="button">${escapeHtml(lane.action)}</button>
        </article>
      `).join("")}
    </section>
  `;
}

function dashboardView(state) {
  const openAmount = state.invoices.reduce((total, invoice) => total + invoice.amount, 0);
  const noShowCount = state.appointments.filter((appointment) => appointment.signal === "danger").length;
  const pendingIntakes = state.intakes.filter((intake) => intake.status !== "Ingediend").length;
  const openTasks = state.workQueue.filter((task) => (task.status || "Open") !== "Klaar");
  const analytics = state.analytics || {};
  const forecast = dashboardForecast(state, openTasks, pendingIntakes, noShowCount);
  const dayCloseItems = state.dayClose || [];
  const dayCloseDone = dayCloseItems.filter((item) => item.status === "Klaar").length;

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
    ${roleHome(state, openTasks, pendingIntakes, noShowCount)}
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

      <div class="panel wide">
        <div class="panel-header"><div><span class="section-kicker">Forecast</span><h2>Hoe zwaar wordt de rest van de dag?</h2></div></div>
        <div class="forecast-grid">
          ${forecast.map((item) => `
            <article class="forecast-card ${escapeHtml(item.signal)}">
              <span>${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(item.value)}</strong>
              <p>${escapeHtml(item.detail)}</p>
            </article>
          `).join("")}
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
        <div class="panel-header"><div><span class="section-kicker">Dagafsluiting</span><h2>${dayCloseDone}/${dayCloseItems.length} klaar</h2></div></div>
        <div class="day-close-list">
          ${dayCloseItems.map((item) => `
            <article class="day-close-item ${item.status === "Klaar" ? "done" : ""}">
              <div>
                <div class="task-heading"><strong>${escapeHtml(item.label)}</strong>${badge(item.status || "Open", item.status === "Klaar" ? "success" : "warning")}</div>
                <span>${escapeHtml(item.category)}${item.completedAt ? ` / klaar ${escapeHtml(item.completedAt)}` : ""}</span>
                <p>${escapeHtml(item.detail)}</p>
              </div>
              <div class="inline-actions">
                ${item.action ? `<button class="ghost-action" data-action="navigate" data-view="${escapeHtml(item.action)}" type="button">Open</button>` : ""}
                ${item.status === "Klaar" ? "" : `<button class="primary-action" data-action="complete-day-close" data-item-id="${escapeHtml(item.id)}" type="button">Klaar</button>`}
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
        ${task.action === "security" ? `<button class="ghost-action" data-action="navigate" data-view="security" type="button">Veiligheid</button>` : ""}
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

function waitlistSlotSuggestions(state, entry) {
  const usedTimes = new Set(
    state.appointments
      .filter((appointment) => appointment.status !== "Geannuleerd")
      .map((appointment) => appointment.time)
  );
  const preferred = `${entry.preferred || ""}`.toLowerCase();
  let candidates = ["09:00", "11:30", "13:00", "14:30", "16:00", "18:00"];

  if (preferred.includes("avond")) {
    candidates = ["18:00", "16:00", "14:30", "11:30", "09:00"];
  } else if (preferred.includes("voormiddag")) {
    candidates = ["09:00", "11:30", "13:00", "14:30", "16:00"];
  } else if (preferred.includes("namiddag")) {
    candidates = ["13:00", "14:30", "16:00", "18:00", "11:30"];
  }

  const location = preferred.includes("online") ? "Online" : "Praktijk";
  const openSlots = candidates.filter((time) => !usedTimes.has(time));
  return (openSlots.length ? openSlots : ["18:30"]).slice(0, 3).map((time) => ({
    time,
    location,
    type: entry.type || "Opvolggesprek",
    label: `${time} / ${location}`
  }));
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
              <div class="slot-suggestions">
                ${waitlistSlotSuggestions(state, entry).map((slot) => `
                  <button class="slot-pill" data-action="suggest-waitlist-slot" data-waitlist-id="${escapeHtml(entry.id)}" data-time="${escapeHtml(slot.time)}" data-location="${escapeHtml(slot.location)}" data-type="${escapeHtml(slot.type)}" type="button">${escapeHtml(slot.label)}</button>
                `).join("")}
              </div>
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

function accessPolicyRows(state, client) {
  const team = state.team || [];
  const owner = team.find((member) => member.role === "Praktijkhouder") || { name: "Praktijkhouder" };
  const secretary = team.find((member) => member.role === "Administratie") || { name: "Secretariaat" };
  const clinician = team.find((member) => member.name === client.clinician) || { name: client.clinician, role: "Zorgverlener" };

  return [
    {
      actor: owner.name,
      role: "Praktijkhouder",
      access: "Volledig",
      detail: "Dossier, planning, facturatie, team en export."
    },
    {
      actor: clinician.name,
      role: "Behandelaar",
      access: "Zorginhoud",
      detail: "Sessies, intakes, documenten en AI-review voor dit dossier."
    },
    {
      actor: secretary.name,
      role: "Administratie",
      access: "Beperkt",
      detail: "Planning en facturatie zonder zorginhoudelijke nota's."
    },
    {
      actor: "AI Assistent",
      role: "Copilot",
      access: "Review nodig",
      detail: state.practice?.aiPolicy || "Concepten vereisen professionele review."
    }
  ];
}

function retentionLabelsForClient(state, client, invoices = []) {
  const policies = state.retentionPolicies || [];
  const byCategory = (category) => policies.find((policy) => policy.category === category);
  const rows = [
    {
      category: "Dossier",
      context: client.status,
      policy: byCategory("Dossier")
    }
  ];

  if (invoices.length) {
    rows.push({
      category: "Facturatie",
      context: `${invoices.length} facturatie-item${invoices.length === 1 ? "" : "s"}`,
      policy: byCategory("Facturatie")
    });
  }

  rows.push(
    {
      category: "Portaal",
      context: "Delen en clientinput",
      policy: byCategory("Portaal")
    },
    {
      category: "AI",
      context: client.aiSuggestion,
      policy: byCategory("AI")
    }
  );

  return rows.filter((row) => row.policy);
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
  const clientAccessOverrides = (state.accessOverrides || []).filter((item) => item.clientId === selected.id);
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
  const accessRows = accessPolicyRows(state, selected);
  const retentionRows = retentionLabelsForClient(state, selected, clientInvoices);

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

          <section class="dossier-section wide">
            <div class="section-row">
              <h3>Toegangsbeleid</h3>
              <span>${escapeHtml(state.currentUser?.role || "Rol")}</span>
            </div>
            <div class="access-policy-list">
              ${accessRows.map((row) => `
                <article class="access-policy-row">
                  <div>
                    <strong>${escapeHtml(row.actor)}</strong>
                    <span>${escapeHtml(row.role)} / ${escapeHtml(row.detail)}</span>
                  </div>
                  ${badge(row.access, row.access === "Volledig" ? "success" : row.access === "Review nodig" ? "warning" : "warning")}
                </article>
              `).join("")}
            </div>
            <div class="access-exceptions">
              ${clientAccessOverrides.map((override) => `
                <article class="access-policy-row">
                  <div>
                    <strong>${escapeHtml(override.member)}</strong>
                    <span>${escapeHtml(override.access)} / ${escapeHtml(override.reason)} / review ${escapeHtml(override.reviewDue || "Binnen 7 dagen")} / ${escapeHtml(override.createdBy || "PraktijkOS")}${override.reviewedAt ? ` / herzien ${escapeHtml(override.reviewedAt)}` : ""}</span>
                  </div>
                  ${can(state, "practice") ? `
                    <label class="compact-select"><span>Status</span><select data-action="access-override-status" data-override-id="${escapeHtml(override.id)}">
                      ${["Actief", "Verlopen", "Ingetrokken"].map((status) => `<option ${override.status === status ? "selected" : ""}>${status}</option>`).join("")}
                    </select></label>
                  ` : badge(override.status || "Actief", override.status === "Actief" ? "success" : "warning")}
                </article>
              `).join("") || `<p class="empty-state">Geen dossieruitzonderingen actief.</p>`}
            </div>
            ${can(state, "practice") ? `
              <form class="access-exception-form" data-form="access-override">
                <input type="hidden" name="clientId" value="${escapeHtml(selected.id)}">
                <label class="field"><span>Teamlid</span><select name="memberId" required>
                  ${(state.team || []).map((member) => `<option value="${escapeHtml(member.id)}">${escapeHtml(member.name)} / ${escapeHtml(member.role)}</option>`).join("")}
                </select></label>
                <label class="field"><span>Toegang</span><select name="access"><option>Extra toegang</option><option>Beperkte toegang</option><option>Tijdelijke review</option></select></label>
                <label class="field"><span>Reviewtermijn</span><select name="reviewDue"><option>Binnen 7 dagen</option><option>Vandaag</option><option>Einde maand</option></select></label>
                <label class="field"><span>Reden</span><input name="reason" placeholder="Bijv. vervanging tijdens verlof" required></label>
                <button class="ghost-action" type="submit">Uitzondering opslaan</button>
              </form>
            ` : ""}
          </section>

          <section class="dossier-section wide">
            <div class="section-row">
              <h3>Retentie</h3>
              <span>${retentionRows.length} labels</span>
            </div>
            <div class="retention-label-list">
              ${retentionRows.map((row) => `
                <article class="access-policy-row retention-label">
                  <div>
                    <strong>${escapeHtml(row.category)} / ${escapeHtml(row.policy.label)}</strong>
                    <span>${escapeHtml(row.policy.duration)} / ${escapeHtml(row.context)} / eigenaar ${escapeHtml(row.policy.owner || "Praktijkhouder")}</span>
                  </div>
                  ${badge(row.policy.status, row.policy.status === "Actief" ? "success" : "warning")}
                </article>
              `).join("") || `<p class="empty-state">Geen retentiebeleid ingesteld.</p>`}
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
  const messageTemplate = state.messageTemplate || {};
  const messageChannels = ["Client portal", "Email concept", "SMS reminder"];

  return `
    <section class="settings-grid">
      <form class="panel" data-form="portal-invite">
        <div class="panel-header"><div><h2>Portaaltoegang</h2><p>Maak een tijdelijke toegang voor berichten, documenten en intake-status.</p></div></div>
        <label class="field"><span>Client</span><select name="clientId" required>${clientOptions(state)}</select></label>
        <button class="primary-action" type="submit">Toegang maken</button>
      </form>

      <form class="panel" data-form="message">
        <div class="panel-header"><div><h2>Nieuw bericht</h2><p>Bereid veilige clientcommunicatie voor.</p></div></div>
        <div class="template-strip" aria-label="Berichttemplates">
          <button class="slot-pill" data-action="use-message-template" data-template="intake" type="button">Intake aanvullen</button>
          <button class="slot-pill" data-action="use-message-template" data-template="appointment" type="button">Afspraakherinnering</button>
          <button class="slot-pill" data-action="use-message-template" data-template="document" type="button">Document klaar</button>
        </div>
        <label class="field"><span>Client</span><select name="clientId" required>${clientOptions(state)}</select></label>
        <label class="field"><span>Onderwerp</span><input name="subject" value="${escapeHtml(messageTemplate.subject || "Opvolging afspraak")}" required></label>
        <label class="field"><span>Bericht</span><textarea name="body" rows="5" required>${escapeHtml(messageTemplate.body || "")}</textarea></label>
        <div class="form-grid">
          <label class="field"><span>Kanaal</span><select name="channel">${messageChannels.map((channel) => `<option ${channel === messageTemplate.channel ? "selected" : ""}>${channel}</option>`).join("")}</select></label>
          <label class="field"><span>Status</span><select name="status">${messageStatuses.map((status) => `<option ${status === messageTemplate.status ? "selected" : ""}>${status}</option>`).join("")}</select></label>
        </div>
        <input type="hidden" name="consentNote" value="${escapeHtml(messageTemplate.consentNote || "Inhoudelijke info via portaal; e-mail of sms enkel praktisch.")}">
        <p class="consent-note">${escapeHtml(messageTemplate.consentNote || "Inhoudelijke info via portaal; e-mail of sms enkel praktisch.")}</p>
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
              <div><strong>${escapeHtml(message.subject)}</strong><span>${escapeHtml(message.client)} / ${escapeHtml(message.channel)} / ${escapeHtml(message.status)}</span><p>${escapeHtml(message.body)}</p>${message.consentNote ? `<p>${escapeHtml(message.consentNote)}</p>` : ""}</div>
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
  const peppolPreparations = state.peppolPreparations || [];
  const paymentRequests = state.paymentRequests || [];
  const invoiceAppointments = state.appointments.filter((appointment) =>
    !state.invoices.some((invoice) => invoice.appointmentId === appointment.id)
  );
  const exportSummary = state.billingExport?.summary;
  const accountingExport = state.accountingExport;
  const accountingTool = state.accountingTool || "exact";

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
                ${invoice.channel === "Peppol" ? badge((peppolPreparations.find((item) => item.invoiceId === invoice.id)?.status || "Peppol te checken"), peppolPreparations.find((item) => item.invoiceId === invoice.id)?.status === "Klaar voor Peppol" ? "success" : "warning") : ""}
                ${invoice.channel === "Peppol" ? `<button class="ghost-action" data-action="prepare-peppol" data-invoice-id="${escapeHtml(invoice.id)}" type="button">Peppol check</button>` : ""}
                ${["Bancontact", "Wero"].includes(invoice.channel) ? badge((paymentRequests.find((item) => item.invoiceId === invoice.id)?.status || "Betaalverzoek te maken"), paymentRequests.find((item) => item.invoiceId === invoice.id)?.status === "Klaar om te delen" ? "success" : "warning") : ""}
                ${["Bancontact", "Wero"].includes(invoice.channel) ? `<button class="ghost-action" data-action="prepare-payment-request" data-invoice-id="${escapeHtml(invoice.id)}" type="button">Betaalverzoek</button>` : ""}
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
      <div class="panel">
        <div class="panel-header"><div><h2>Boekhoudtools</h2><p>Exportprofielen voor veelgebruikte Belgische workflows.</p></div></div>
        <label class="field"><span>Tool</span><select data-action="accounting-tool">
          <option value="exact" ${accountingTool === "exact" ? "selected" : ""}>Exact Online</option>
          <option value="yuki" ${accountingTool === "yuki" ? "selected" : ""}>Yuki</option>
          <option value="octopus" ${accountingTool === "octopus" ? "selected" : ""}>Octopus</option>
        </select></label>
        <div class="handoff-summary">
          <div><strong>${accountingExport ? accountingExport.summary.invoiceCount : state.invoices.length}</strong><span>facturen</span></div>
          <div><strong>${accountingExport ? formatEuro(accountingExport.summary.totalAmount) : formatEuro(open + paid)}</strong><span>exportwaarde</span></div>
          <div><strong>${accountingExport ? accountingExport.summary.peppolCount : state.invoices.filter((invoice) => invoice.channel === "Peppol").length}</strong><span>Peppolregels</span></div>
        </div>
        ${accountingExport ? `<p class="handoff-note">${escapeHtml(accountingExport.label)} export klaar: ${escapeHtml(accountingExport.files.csvFilename)}</p>` : `<p class="handoff-note">Kies een profiel en maak een CSV/JSON export voor de boekhouder.</p>`}
        <button class="primary-action" data-action="export-accounting" type="button">Maak tool-export</button>
      </div>
      <div class="panel wide">
        <div class="panel-header"><div><h2>Peppol voorbereiding</h2><p>Controleer of Peppol-facturen klaar zijn voor levering.</p></div></div>
        <div class="security-list">
          ${peppolPreparations.slice(0, 8).map((item) => `
            <article class="security-row">
              <div>
                <strong>${escapeHtml(item.client)} / ${formatEuro(item.amount)}</strong>
                <span>${item.missing?.length ? escapeHtml(item.missing.join(" / ")) : `Referentie ${escapeHtml(item.deliveryReference)}`} / ${escapeHtml(item.preparedAt)} / ${escapeHtml(item.preparedBy)}</span>
              </div>
              ${badge(item.status, item.status === "Klaar voor Peppol" ? "success" : "warning")}
            </article>
          `).join("") || `<p class="empty-state">Nog geen Peppol checks uitgevoerd.</p>`}
        </div>
      </div>
      <div class="panel wide">
        <div class="panel-header"><div><h2>Betaalverzoeken</h2><p>Bancontact en Wero betaalcontext klaarzetten voor clientcommunicatie.</p></div></div>
        <div class="security-list">
          ${paymentRequests.slice(0, 8).map((item) => `
            <article class="security-row">
              <div>
                <strong>${escapeHtml(item.client)} / ${escapeHtml(item.channel)} / ${formatEuro(item.amount)}</strong>
                <span>${item.missing?.length ? escapeHtml(item.missing.join(" / ")) : escapeHtml(item.shareText)} / ${escapeHtml(item.preparedAt)} / ${escapeHtml(item.preparedBy)}</span>
              </div>
              ${badge(item.status, item.status === "Klaar om te delen" ? "success" : "warning")}
            </article>
          `).join("") || `<p class="empty-state">Nog geen betaalverzoeken voorbereid.</p>`}
        </div>
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
  const activeKnowledge = (state.knowledgeBase || []).filter((item) => item.status === "Actief");
  const activeModels = (state.aiModels || []).filter((model) => model.status === "Actief");
  const selectedModel = activeModels.find((model) => model.id === state.aiModelId) || activeModels[0] || (state.aiModels || [])[0];
  const voiceClientId = state.voiceClientId || state.selectedClientId;
  const voiceClient = state.clients.find((client) => client.id === voiceClientId) || state.clients[0];
  const voiceConsent = (state.voiceConsents || []).find((consent) => consent.clientId === voiceClient?.id && consent.status === "Actief");
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
        <label class="field"><span>Modelprofiel</span>
          <select data-action="ai-model">
            ${activeModels.map((model) => `<option value="${escapeHtml(model.id)}" ${selectedModel?.id === model.id ? "selected" : ""}>${escapeHtml(model.name)} / ${escapeHtml(model.promptVersion)}</option>`).join("")}
          </select>
        </label>
        <div class="model-summary">
          <strong>${escapeHtml(selectedModel?.name || "Geen model geselecteerd")}</strong>
          <span>${escapeHtml(selectedModel?.useCase || "Voeg een actief model toe in de registry.")}</span>
          ${selectedModel ? badge(`Risico ${selectedModel.riskLevel}`, selectedModel.riskLevel === "Laag" ? "success" : "warning") : ""}
        </div>
        <label class="field"><span>Broncontext</span><textarea data-action="ai-input" rows="9">${escapeHtml(state.aiSource || "Client meldt stressklachten, slaapproblemen en piekeren rond werk. Eerste gesprek, vraag naar kortdurende begeleiding. Wil graag afspraken op dinsdagavond.")}</textarea></label>
        <div class="ai-actions"><button class="primary-action" data-action="run-ai" type="button">Genereer concept</button><button class="ghost-action" data-action="clear-ai" type="button">Wis</button></div>
      </div>
      <div class="panel">
        <div class="panel-header"><div><h2>Praktijkkennis</h2><p>${activeKnowledge.length} actieve regels worden meegenomen.</p></div></div>
        <div class="mini-list">
          ${activeKnowledge.slice(0, 5).map((item) => `
            <article><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.category)} / ${escapeHtml(item.content)}</span></div>${badge(item.status, "success")}</article>
          `).join("") || `<p class="empty-state">Nog geen actieve kennisregels.</p>`}
        </div>
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
        <div class="panel-header"><div><h2>Voice-to-note</h2><p>Transcript pas verwerken wanneer toestemming actief is.</p></div>${voiceConsent ? badge("Consent actief", "success") : badge("Consent ontbreekt", "warning")}</div>
        <div class="voice-grid">
          <form data-form="voice-consent" class="voice-card">
            <label class="field"><span>Client</span><select name="clientId" data-action="voice-client">${clientOptions(state, voiceClient?.id)}</select></label>
            <label class="field"><span>Scope</span><select name="scope"><option>Sessie-audio naar conceptnota</option><option>Dictaat naar dossiernota</option><option>Telefonisch overleg naar verslag</option></select></label>
            <label class="field"><span>Geldig tot</span><select name="expiresAt"><option>Einde traject</option><option>Alleen vandaag</option><option>Volgende sessie</option></select></label>
            <button class="ghost-action" type="submit">Toestemming vastleggen</button>
            <p class="consent-note">${voiceConsent ? `${escapeHtml(voiceConsent.scope)} / ${escapeHtml(voiceConsent.recordedBy)} / ${escapeHtml(voiceConsent.expiresAt)}` : "Leg mondelinge of schriftelijke toestemming vast voordat transcriptie wordt gebruikt."}</p>
          </form>
          <form data-form="voice-note" class="voice-card">
            <input type="hidden" name="clientId" value="${escapeHtml(voiceClient?.id || "")}">
            <label class="field"><span>Titel</span><input name="title" value="Voice-to-note concept"></label>
            <div class="form-grid">
              <label class="field"><span>Transcriptbron</span><select name="transcriptSource"><option>Handmatig transcript</option><option>Dictaat zorgverlener</option><option>Extern transcript nagekeken</option></select></label>
              <label class="field"><span>Kwaliteit</span><select name="quality"><option>Nagekeken door zorgverlener</option><option>Onzekerheden gemarkeerd</option><option>Alleen ruwe notities</option></select></label>
            </div>
            <label class="field"><span>Transcript</span><textarea name="transcript" rows="6" placeholder="Plak hier het nagekeken transcript of dictaat." required></textarea></label>
            <label class="checkbox-line"><input name="consentConfirmed" type="checkbox" ${voiceConsent ? "" : "disabled"}><span>Toestemming gecontroleerd voor dit dossier</span></label>
            <label class="checkbox-line"><input name="transcriptReviewed" type="checkbox" ${voiceConsent ? "" : "disabled"}><span>Transcript nagekeken voor opslag als concept</span></label>
            <button class="primary-action" type="submit" ${voiceConsent ? "" : "disabled"}>Maak notaconcept</button>
          </form>
        </div>
      </div>
      <div class="panel wide">
        <div class="panel-header"><div><h2>Wijzigingen</h2><p>Laatste acties in de praktijk.</p></div></div>
        ${auditList(state)}
      </div>
    </section>
  `;
}

function importView(state) {
  const preview = state.importPreview || (state.importRuns || [])[0];
  const previewRows = preview?.mappedRows || [];
  const importRuns = state.importRuns || [];
  const applySummary = state.importApplySummary || preview?.applySummary;
  const rollbackSummary = state.importRollbackSummary || preview?.rollbackSummary;

  return `
    <section class="content-grid">
      <form class="panel wide" data-form="import-preview">
        <div class="panel-header"><div><h2>Migratie voorbereiden</h2><p>Plak CSV uit Excel, agenda of boekhouding en controleer de mapping voor import.</p></div></div>
        <div class="form-grid">
          <label class="field"><span>Type data</span><select name="kind">
            ${[
              ["clients", "Clienten"],
              ["appointments", "Afspraken"],
              ["invoices", "Facturen"]
            ].map(([value, label]) => `<option value="${value}" ${state.importKind === value ? "selected" : ""}>${label}</option>`).join("")}
          </select></label>
          <div class="import-help"><strong>Veilige preview</strong><span>Deze stap analyseert alleen. Er wordt nog niets in dossiers, agenda of facturatie geschreven.</span></div>
        </div>
        <label class="field"><span>CSV</span><textarea name="csv" rows="9" required>${escapeHtml(state.importCsv || "")}</textarea></label>
        <button class="primary-action" type="submit">Analyseer bestand</button>
      </form>

      <div class="panel">
        <div class="panel-header"><div><h2>Preview</h2><p>Controleer kolommen en waarschuwingen.</p></div></div>
        ${preview ? `
          <div class="handoff-summary">
            <div><strong>${escapeHtml(preview.rowCount)}</strong><span>rijen gevonden</span></div>
            <div><strong>${escapeHtml(preview.headers.length)}</strong><span>kolommen herkend</span></div>
            <div><strong>${escapeHtml(preview.warnings.length)}</strong><span>waarschuwingen</span></div>
          </div>
          <p class="handoff-note">${escapeHtml(preview.suggestedAction)}</p>
          <div class="warning-list">
            ${preview.warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("") || `<p>Geen blokkerende waarschuwingen.</p>`}
          </div>
          <div class="import-actions">
            ${preview.rolledBackAt ? "" : `<button class="primary-action" data-action="apply-import" data-preview-id="${escapeHtml(preview.id)}" type="button" ${preview.missingHeaders?.length || preview.applySummary ? "disabled" : ""}>Importeer gecontroleerd</button>`}
            ${preview.applySummary && !preview.rolledBackAt ? `<button class="ghost-action" data-action="rollback-import" data-preview-id="${escapeHtml(preview.id)}" type="button">Draai import terug</button>` : ""}
          </div>
          ${applySummary ? `<p class="handoff-note">${escapeHtml(applySummary.created)} aangemaakt, ${escapeHtml(applySummary.skipped)} overgeslagen door ${escapeHtml(applySummary.appliedBy || "PraktijkOS")}.</p>` : ""}
          ${rollbackSummary ? `<p class="handoff-note">${escapeHtml(rollbackSummary.removed)} records teruggedraaid door ${escapeHtml(rollbackSummary.rolledBackBy || "PraktijkOS")}.</p>` : ""}
        ` : `<p class="empty-state">Nog geen preview. Plak CSV en analyseer eerst.</p>`}
      </div>

      <div class="panel wide">
        <div class="panel-header"><div><h2>Gemapte rijen</h2><p>Eerste rijen zoals PraktijkOS ze begrijpt.</p></div></div>
        <div class="import-table">
          ${previewRows.slice(0, 8).map((row) => `
            <article class="import-row">
              <strong>Rij ${escapeHtml(row.row)}</strong>
              <span>${escapeHtml(Object.entries(row.values).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join(" / ") || "Geen waarden gemapt")}</span>
              ${row.issues?.length ? badge(`${row.issues.length} issue`, "warning") : badge("OK", "success")}
            </article>
          `).join("") || `<p class="empty-state">Nog geen gemapte rijen.</p>`}
        </div>
      </div>

      <div class="panel wide">
        <div class="panel-header"><div><h2>Importgeschiedenis</h2><p>Recente previews zonder ruwe bestandsdata.</p></div></div>
        <div class="import-table">
          ${importRuns.slice(0, 5).map((run) => `
            <article class="import-row">
              <strong>${escapeHtml(run.label || run.kind)}</strong>
              <span>${escapeHtml(run.createdAt || "")} / ${escapeHtml(run.createdBy || "PraktijkOS")} / ${escapeHtml(run.rowCount || 0)} rijen</span>
              <div class="inline-actions">
                ${badge(run.rolledBackAt ? "Teruggedraaid" : run.applySummary ? "Geimporteerd" : run.warnings?.length ? "Controleer" : "Klaar", run.warnings?.length ? "warning" : "success")}
                ${run.applySummary && !run.rolledBackAt ? `<button class="ghost-action" data-action="rollback-import" data-preview-id="${escapeHtml(run.id)}" type="button">Terugdraaien</button>` : ""}
              </div>
            </article>
          `).join("") || `<p class="empty-state">Nog geen importpreviews.</p>`}
        </div>
      </div>
    </section>
  `;
}

function retentionCleanupQueue(state) {
  const activeOverrides = (state.accessOverrides || []).filter((item) => item.status === "Actief");
  const activeInvites = (state.portalInvites || []).filter((invite) => invite.status === "Actief");
  const reviewDocuments = (state.documents || []).filter((document) => document.status === "Review nodig");
  const retentionReviews = (state.retentionPolicies || []).filter((policy) => policy.status !== "Actief");
  const importRuns = (state.importRuns || []).filter((run) => run.applySummary && !run.rolledBackAt);
  const items = retentionReviews.map((policy) => ({
    id: `policy-${policy.id}`,
    label: `${policy.category}: review afronden`,
    detail: `${policy.label} staat op ${policy.status}. Volgende review: ${policy.nextReviewDue || "Nog te bepalen"}.`,
    severity: "warning",
    policyId: policy.id
  }));

  if (activeOverrides.length) {
    items.push({
      id: "access-overrides",
      label: "Tijdelijke dossiertoegang opruimen",
      detail: `${activeOverrides.length} actieve uitzondering${activeOverrides.length === 1 ? "" : "en"} controleren of intrekken.`,
      severity: "warning",
      view: "clients"
    });
  }

  if (activeInvites.length) {
    items.push({
      id: "portal-invites",
      label: "Portaaltoegang nakijken",
      detail: `${activeInvites.length} actieve clientlink${activeInvites.length === 1 ? "" : "s"} bevestigen of afsluiten.`,
      severity: "warning",
      view: "portal"
    });
  }

  if (reviewDocuments.length) {
    items.push({
      id: "documents-review",
      label: "Documenten met review nodig",
      detail: `${reviewDocuments.length} document${reviewDocuments.length === 1 ? "" : "en"} afronden voor retentie.`,
      severity: "warning",
      view: "portal"
    });
  }

  if (importRuns.length) {
    items.push({
      id: "import-review",
      label: "Migratiesteekproef vastleggen",
      detail: `${importRuns.length} uitgevoerde import${importRuns.length === 1 ? "" : "s"} controleren na cleanup.`,
      severity: "warning",
      view: "import"
    });
  }

  return items;
}

function securityView(state) {
  const activeOverrides = (state.accessOverrides || []).filter((item) => item.status === "Actief");
  const inactiveOverrides = (state.accessOverrides || []).filter((item) => item.status !== "Actief");
  const activeInvites = (state.portalInvites || []).filter((invite) => invite.status === "Actief");
  const exportEvents = (state.auditLog || []).filter((item) => `${item.event} ${item.detail}`.toLowerCase().includes("export"));
  const importRuns = state.importRuns || [];
  const retentionPolicies = state.retentionPolicies || [];
  const retentionReviews = retentionPolicies.filter((policy) => policy.status !== "Actief");
  const integrationReadiness = state.integrationReadiness || [];
  const openIntegrationReviews = integrationReadiness.filter((item) => item.status !== "Review afgerond");
  const isoEvidencePacks = state.isoEvidencePacks || [];
  const openIsoEvidence = isoEvidencePacks.filter((pack) => pack.status !== "Bewijs verzameld");
  const isoEvidenceExport = state.isoEvidenceExport;
  const cleanupQueue = retentionCleanupQueue(state);
  const selectedAuditFilter = state.auditFilter || "all";
  const selectedAuditRows = filteredAuditLog(state, selectedAuditFilter);
  const securityAlerts = [
    ...activeOverrides.map((override) => ({
      label: "Toegang reviewen",
      detail: `${override.member} heeft ${override.access} op ${override.client}. Review: ${override.reviewDue || "Binnen 7 dagen"}`,
      action: "clients",
      severity: override.reviewDue === "Vandaag" ? "danger" : "warning"
    })),
    ...(activeInvites.length ? [{
      label: "Portaaltoegang actief",
      detail: `${activeInvites.length} clientlinks zijn actief. Controleer of ze nog nodig zijn.`,
      action: "portal",
      severity: "warning"
    }] : []),
    ...importRuns.filter((run) => run.applySummary && !run.rolledBackAt).slice(0, 2).map((run) => ({
      label: "Import nagekeken?",
      detail: `${run.label || run.kind}: ${run.applySummary.created} records aangemaakt. Controleer steekproef.`,
      action: "import",
      severity: "warning"
    })),
    ...retentionReviews.map((policy) => ({
      label: "Retentiebeleid reviewen",
      detail: `${policy.label}: ${policy.status}. Eigenaar: ${policy.owner || "Praktijkhouder"}`,
      action: "security",
      severity: "warning"
    })),
    ...openIntegrationReviews.slice(0, 2).map((item) => ({
      label: "Integratie readiness",
      detail: `${item.name}: ${item.nextStep}`,
      action: "security",
      severity: item.priority === "Hoog" ? "warning" : "info"
    })),
    ...openIsoEvidence.slice(0, 2).map((pack) => ({
      label: "ISO bewijsmap",
      detail: `${pack.label}: ${pack.summary}`,
      action: "security",
      severity: "warning"
    }))
  ];

  return `
    <section class="metric-grid">
      <article class="metric"><span>Actieve uitzonderingen</span><strong>${activeOverrides.length}</strong><small>dossiertoegang te reviewen</small></article>
      <article class="metric"><span>Portaaltoegang</span><strong>${activeInvites.length}</strong><small>actieve clientlinks</small></article>
      <article class="metric"><span>Exports</span><strong>${exportEvents.length}</strong><small>dossier of boekhouding</small></article>
      <article class="metric"><span>Integraties</span><strong>${openIntegrationReviews.length}</strong><small>readiness reviews open</small></article>
      <article class="metric"><span>ISO bewijs</span><strong>${openIsoEvidence.length}</strong><small>evidence packs open</small></article>
    </section>
    <section class="content-grid">
      <div class="panel wide">
        <div class="panel-header"><div><h2>Review alerts</h2><p>Wat moet vandaag of deze week security-aandacht krijgen?</p></div></div>
        <div class="security-alerts">
          ${securityAlerts.slice(0, 8).map((alert) => `
            <article class="security-alert ${escapeHtml(alert.severity)}">
              <div><strong>${escapeHtml(alert.label)}</strong><span>${escapeHtml(alert.detail)}</span></div>
              <button class="ghost-action" data-action="navigate" data-view="${escapeHtml(alert.action)}" type="button">Open</button>
            </article>
          `).join("") || `<p class="empty-state">Geen security alerts open.</p>`}
        </div>
      </div>
      <div class="panel wide" data-section="integration-readiness">
        <div class="panel-header"><div><h2>Belgische integraties</h2><p>Beslisruimte voor Itsme/eID, eHealth en consent voordat development start.</p></div></div>
        <div class="security-list">
          ${integrationReadiness.map((item) => `
            <article class="security-row">
              <div>
                <strong>${escapeHtml(item.name)} / ${escapeHtml(item.category)}</strong>
                <span>${escapeHtml(item.value)} Doelgroep: ${escapeHtml(item.targetSegment || "Nog te bepalen")}</span>
                <span>${escapeHtml(item.decision || "")}</span>
                <span>Volgende stap: ${escapeHtml(item.nextStep || "Nog te bepalen")}</span>
                <span>Controles: ${(item.controls || []).map((control) => `${escapeHtml(control.label)} (${escapeHtml(control.status)})`).join(" / ")}</span>
                <span>Risico's: ${(item.risks || []).map((risk) => escapeHtml(risk)).join(" / ") || "Geen open risico's"}</span>
              </div>
              <div class="status-stack">
                ${badge(item.status || "Analyse", item.status === "Review afgerond" ? "success" : "warning")}
                ${badge(item.priority || "Medium", item.priority === "Hoog" ? "warning" : "success")}
                ${item.reviewedAt ? `<span class="muted-small">Review ${escapeHtml(item.reviewedAt)} door ${escapeHtml(item.reviewedBy || "PraktijkOS")}</span>` : ""}
                ${can(state, "practice") && item.status !== "Review afgerond" ? `<button class="primary-action" data-action="complete-integration-review" data-integration-id="${escapeHtml(item.id)}" type="button">Review klaar</button>` : ""}
              </div>
            </article>
          `).join("") || `<p class="empty-state">Nog geen integratie-readiness items.</p>`}
        </div>
      </div>
      <div class="panel wide" data-section="iso-evidence">
        <div class="panel-header">
          <div><h2>ISO 27001 bewijsmap</h2><p>Verzamel auditmateriaal uit rollen, AI-governance, retentie en exportlogs.</p></div>
          <button class="primary-action" data-action="export-iso-evidence" type="button">Evidence export</button>
        </div>
        ${isoEvidenceExport ? `<p class="handoff-note">${escapeHtml(isoEvidenceExport.summary.evidenceRows)} bewijsregels en ${escapeHtml(isoEvidenceExport.summary.attachmentCount || 0)} bijlagen klaar in ${escapeHtml(isoEvidenceExport.files.csvFilename)}.</p>` : `<p class="handoff-note">Maak een export wanneer een auditor, DPO of adviseur bewijs wil nakijken.</p>`}
        <form class="inline-form" data-form="iso-evidence-note">
          <label class="field"><span>Bewijsmap</span><select name="packId">
            ${isoEvidencePacks.map((pack) => `<option value="${escapeHtml(pack.id)}">${escapeHtml(pack.label)}</option>`).join("")}
          </select></label>
          <label class="field"><span>Status</span><select name="status"><option>Opvolging</option><option>Vraag auditor</option><option>Akkoord</option><option>Gap</option></select></label>
          <label class="field grow"><span>Reviewnotitie</span><input name="note" placeholder="Bijv. DPIA toevoegen voor AI-leverancier" required></label>
          <button class="primary-action" type="submit">Notitie toevoegen</button>
        </form>
        <form class="inline-form evidence-attachment-form" data-form="iso-evidence-attachment">
          <label class="field"><span>Bewijsmap</span><select name="packId">
            ${isoEvidencePacks.map((pack) => `<option value="${escapeHtml(pack.id)}">${escapeHtml(pack.label)}</option>`).join("")}
          </select></label>
          <label class="field"><span>Type</span><select name="type"><option>Document</option><option>Export</option><option>Screenshot</option><option>Contract</option><option>Beleid</option></select></label>
          <label class="field grow"><span>Titel</span><input name="title" placeholder="Bijv. DPA leverancier" required></label>
          <label class="field grow"><span>Bron</span><input name="source" placeholder="URL, bestandsnaam of systeembron" required></label>
          <label class="field"><span>Locatie</span><input name="storageLocation" value="PraktijkOS evidence vault"></label>
          <label class="field"><span>Status</span><select name="status"><option>Gekoppeld</option><option>Review nodig</option><option>Vervangen</option></select></label>
          <button class="primary-action" type="submit">Bewijsstuk koppelen</button>
        </form>
        <div class="security-list">
          ${isoEvidencePacks.map((pack) => `
            <article class="security-row">
              <div>
                <strong>${escapeHtml(pack.label)} / ${escapeHtml(pack.domain)}</strong>
                <span>${escapeHtml(pack.summary)} Eigenaar: ${escapeHtml(pack.owner || "Praktijkhouder")} / deadline ${escapeHtml(pack.dueAt || "Nog te plannen")}</span>
                <span>Bronnen: ${(pack.sources || []).map((source) => escapeHtml(source)).join(" / ")}</span>
                <span>Bewijs: ${(pack.evidence || []).map((item) => `${escapeHtml(item.label)} (${escapeHtml(item.status)})`).join(" / ")}</span>
                <span>Gaps: ${(pack.gaps || []).map((gap) => escapeHtml(gap)).join(" / ") || "Geen open gaps"}</span>
                ${pack.snapshot ? `<span>Snapshot: ${escapeHtml(pack.snapshot.counts.auditEvents)} audit-events / ${escapeHtml(pack.snapshot.counts.retentionPolicies)} retentiebeleid / ${escapeHtml(pack.snapshot.counts.aiModels)} AI-modellen</span>` : ""}
                ${(pack.attachments || []).slice(0, 4).map((attachment) => `<span>Bijlage: ${escapeHtml(attachment.type)} / ${escapeHtml(attachment.title)} / ${escapeHtml(attachment.source)} / ${escapeHtml(attachment.status)} / ${escapeHtml(attachment.addedBy || "PraktijkOS")} ${escapeHtml(attachment.addedAt || "")}</span>`).join("")}
                ${(pack.reviewerNotes || []).slice(0, 3).map((note) => `<span>Notitie: ${escapeHtml(note.status)} / ${escapeHtml(note.note)} / ${escapeHtml(note.createdBy || "PraktijkOS")} ${escapeHtml(note.createdAt || "")}</span>`).join("")}
              </div>
              <div class="status-stack">
                ${badge(pack.status || "Open", pack.status === "Bewijs verzameld" ? "success" : "warning")}
                ${pack.collectedAt ? `<span class="muted-small">Verzameld ${escapeHtml(pack.collectedAt)} door ${escapeHtml(pack.collectedBy || "PraktijkOS")}</span>` : ""}
                ${can(state, "practice") && pack.status !== "Bewijs verzameld" ? `<button class="primary-action" data-action="collect-iso-evidence" data-pack-id="${escapeHtml(pack.id)}" type="button">Bewijs verzamelen</button>` : ""}
              </div>
            </article>
          `).join("") || `<p class="empty-state">Nog geen ISO evidence packs.</p>`}
        </div>
      </div>
      <div class="panel wide">
        <div class="panel-header"><div><h2>Access review</h2><p>Bekijk tijdelijke toegang en trek uitzonderingen in wanneer ze niet meer nodig zijn.</p></div></div>
        <div class="security-list">
          ${[...activeOverrides, ...inactiveOverrides].slice(0, 12).map((override) => `
            <article class="security-row">
              <div>
                <strong>${escapeHtml(override.member)} / ${escapeHtml(override.client)}</strong>
                <span>${escapeHtml(override.access)} / ${escapeHtml(override.reason)} / aangemaakt door ${escapeHtml(override.createdBy || "PraktijkOS")}</span>
              </div>
              <div class="status-stack">
                ${badge(override.status || "Actief", override.status === "Actief" ? "success" : "warning")}
                ${override.status === "Actief" ? `<label class="compact-select"><span>Status</span><select data-action="access-override-status" data-override-id="${escapeHtml(override.id)}"><option selected>Actief</option><option>Verlopen</option><option>Ingetrokken</option></select></label>` : ""}
              </div>
            </article>
          `).join("") || `<p class="empty-state">Geen toegangsuitzonderingen.</p>`}
        </div>
      </div>
      <div class="panel wide" data-section="retention-policies">
        <div class="panel-header"><div><h2>Retentiebeleid</h2><p>Bewaarregels die automatisch als label in elk dossier zichtbaar zijn.</p></div></div>
        <div class="security-list">
          ${retentionPolicies.map((policy) => `
            <article class="security-row retention-policy-row">
              <div>
                <strong>${escapeHtml(policy.category)} / ${escapeHtml(policy.label)}</strong>
                <span>${escapeHtml(policy.duration)} / ${escapeHtml(policy.scope)} / review ${escapeHtml(policy.reviewCadence)} / eigenaar ${escapeHtml(policy.owner || "Praktijkhouder")}${policy.reviewedAt ? ` / herzien ${escapeHtml(policy.reviewedAt)}` : ""}</span>
              </div>
              <div class="status-stack">
                ${badge(policy.status, policy.status === "Actief" ? "success" : "warning")}
                ${can(state, "practice") ? `<label class="compact-select"><span>Status</span><select data-action="retention-policy-status" data-policy-id="${escapeHtml(policy.id)}">
                  ${["Actief", "Review nodig", "Pauze", "Vervangen"].map((status) => `<option ${policy.status === status ? "selected" : ""}>${status}</option>`).join("")}
                </select></label>` : ""}
                ${can(state, "practice") && policy.status !== "Actief" ? `<button class="primary-action" data-action="complete-retention-review" data-policy-id="${escapeHtml(policy.id)}" type="button">Review klaar</button>` : ""}
              </div>
            </article>
          `).join("") || `<p class="empty-state">Nog geen retentiebeleid ingesteld.</p>`}
        </div>
      </div>
      <div class="panel wide" data-section="cleanup-queue">
        <div class="panel-header"><div><h2>Cleanup queue</h2><p>Concrete retentie-acties voor toegang, portaal, documenten en migratie.</p></div></div>
        <div class="security-list">
          ${cleanupQueue.slice(0, 10).map((item) => `
            <article class="security-row ${escapeHtml(item.severity)}">
              <div>
                <strong>${escapeHtml(item.label)}</strong>
                <span>${escapeHtml(item.detail)}</span>
              </div>
              <div class="inline-actions">
                ${item.policyId && can(state, "practice") ? `<button class="primary-action" data-action="complete-retention-review" data-policy-id="${escapeHtml(item.policyId)}" type="button">Review klaar</button>` : ""}
                ${item.view ? `<button class="ghost-action" data-action="navigate" data-view="${escapeHtml(item.view)}" type="button">Open</button>` : ""}
              </div>
            </article>
          `).join("") || `<p class="empty-state">Geen cleanup-acties open.</p>`}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><div><h2>Portaal en delen</h2><p>Actieve links en deelstatus.</p></div></div>
        <div class="security-list">
          ${activeInvites.slice(0, 6).map((invite) => `
            <article class="security-row compact">
              <div><strong>${escapeHtml(invite.client)}</strong><span>${escapeHtml(invite.createdBy || "PraktijkOS")} / ${escapeHtml(invite.status)}</span></div>
              ${badge(invite.status, "success")}
            </article>
          `).join("") || `<p class="empty-state">Geen actieve portaaltoegangen.</p>`}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><div><h2>Exports</h2><p>Laatste dossier- en boekhouderexports.</p></div></div>
        <div class="security-list">
          ${exportEvents.slice(0, 8).map((event) => `
            <article class="security-row compact">
              <div><strong>${escapeHtml(event.event)}</strong><span>${escapeHtml(event.detail)} / ${escapeHtml(event.actor)} / ${escapeHtml(event.at)}</span></div>
            </article>
          `).join("") || `<p class="empty-state">Nog geen exports gelogd.</p>`}
        </div>
      </div>
      <div class="panel wide">
        <div class="panel-header"><div><h2>Importcontrole</h2><p>Previews, uitgevoerde imports en rollbacks.</p></div><button class="ghost-action" data-action="navigate" data-view="import" type="button">Import openen</button></div>
        <div class="security-list">
          ${importRuns.slice(0, 8).map((run) => `
            <article class="security-row">
              <div><strong>${escapeHtml(run.label || run.kind)}</strong><span>${escapeHtml(run.rowCount || 0)} rijen / ${escapeHtml(run.createdAt || "")} / ${escapeHtml(run.appliedAt ? "geimporteerd" : "preview")}${run.rolledBackAt ? " / teruggedraaid" : ""}</span></div>
              ${badge(run.rolledBackAt ? "Teruggedraaid" : run.applySummary ? "Geimporteerd" : "Preview", run.warnings?.length ? "warning" : "success")}
            </article>
          `).join("") || `<p class="empty-state">Nog geen importactiviteit.</p>`}
        </div>
      </div>
      <div class="panel wide">
        <div class="panel-header">
          <div><h2>Auditlog</h2><p>${selectedAuditRows.length} events binnen deze filter.</p></div>
          <div class="inline-actions">
            <label class="compact-select"><span>Filter</span><select data-action="audit-filter">
              ${auditFilterOptions.map((option) => `<option value="${escapeHtml(option.value)}" ${selectedAuditFilter === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
            </select></label>
            <button class="primary-action" data-action="export-audit" type="button">Export</button>
          </div>
        </div>
        ${auditList(state, 12, selectedAuditFilter)}
      </div>
    </section>
  `;
}

function usageSeverity(used, limit) {
  if (!limit) return null;
  const ratio = used / limit;
  if (ratio >= 1) return "danger";
  if (ratio >= 0.8) return "warning";
  return null;
}

function localSaasUsageAlerts(state) {
  const account = state.practice?.saasAccount || {};
  const candidates = [
    {
      id: "seats",
      label: "Seatlimiet",
      used: state.team?.length || 0,
      limit: Number(account.seatsIncluded || 0),
      detail: `${state.team?.length || 0}/${account.seatsIncluded || "?"} seats gebruikt.`
    },
    {
      id: "clients",
      label: "Clientlimiet",
      used: state.clients?.length || 0,
      limit: Number(account.clientLimit || 0),
      detail: `${state.clients?.length || 0}/${account.clientLimit || "?"} dossiers binnen deze tenant.`
    },
    {
      id: "ai-credits",
      label: "AI credits",
      used: Number(account.aiCreditsUsed || 0),
      limit: Number(account.aiCreditsIncluded || 0),
      detail: `${account.aiCreditsUsed || 0}/${account.aiCreditsIncluded || "?"} maandcredits gebruikt.`
    }
  ];
  const alerts = candidates
    .map((item) => ({ ...item, severity: usageSeverity(item.used, item.limit) }))
    .filter((item) => item.severity);

  const billingStatus = `${account.billingStatus || ""}`.toLowerCase();
  if (billingStatus.includes("betaal") || billingStatus.includes("pauze")) {
    alerts.push({
      id: "billing",
      label: "Billingstatus",
      detail: account.billingStatus,
      severity: billingStatus.includes("pauze") ? "danger" : "warning"
    });
  }
  return alerts;
}

function settingsView(state) {
  const modelEvaluations = state.aiModelEvaluations || [];
  const saasAccount = state.practice.saasAccount || {};
  const saasUsageAlerts = state.saasUsageAlerts?.length ? state.saasUsageAlerts : localSaasUsageAlerts(state);
  const seatsUsed = state.team.length;
  const seatsIncluded = Number(saasAccount.seatsIncluded || seatsUsed || 1);
  const clientCount = state.clients.length;
  const clientLimit = Number(saasAccount.clientLimit || clientCount || 1);
  const aiCreditsUsed = Number(saasAccount.aiCreditsUsed || 0);
  const aiCreditsIncluded = Number(saasAccount.aiCreditsIncluded || 1);
  const saasInvoices = state.saasInvoices || [];
  const openSaasInvoices = saasInvoices.filter((invoice) => invoice.status !== "Betaald");
  const saasUsageLedger = state.saasUsageLedger || [];
  const saasPlanChanges = state.saasPlanChanges || [];
  return `
    <section class="settings-grid">
      <form class="panel wide" data-form="saas-account">
        <div class="panel-header"><div><h2>SaaS account</h2><p>Tenant, abonnement en platformlimieten voor deze praktijkomgeving.</p></div>${badge(saasAccount.billingStatus || "Actief", (saasAccount.billingStatus || "").toLowerCase().includes("pauze") ? "warning" : "success")}</div>
        <div class="metric-grid compact-metrics">
          <article class="metric"><span>Tenant</span><strong>${escapeHtml(saasAccount.tenantId || "tenant")}</strong><small>${escapeHtml(saasAccount.dataRegion || "EU / Belgie")}</small></article>
          <article class="metric"><span>Plan</span><strong>${escapeHtml(saasAccount.plan || "Pro")}</strong><small>verlenging ${escapeHtml(saasAccount.renewalDate || "nog te plannen")}</small></article>
          <article class="metric"><span>Seats</span><strong>${seatsUsed}/${seatsIncluded}</strong><small>teamleden binnen abonnement</small></article>
          <article class="metric"><span>Clienten</span><strong>${clientCount}/${clientLimit}</strong><small>dossiers binnen tenantlimiet</small></article>
          <article class="metric"><span>AI credits</span><strong>${aiCreditsUsed}/${aiCreditsIncluded}</strong><small>maandbudget voor AI-acties</small></article>
        </div>
        <div class="security-alerts">
          ${saasUsageAlerts.map((alert) => `
            <article class="security-alert ${escapeHtml(alert.severity)}">
              <div><strong>${escapeHtml(alert.label)}</strong><span>${escapeHtml(alert.detail)}</span></div>
              ${badge(alert.severity === "danger" ? "Actie nodig" : "Opvolgen", alert.severity)}
            </article>
          `).join("") || `<p class="empty-state">Geen tenant usage alerts.</p>`}
        </div>
        <div class="form-grid">
          <label class="field"><span>Tenant ID</span><input name="tenantId" value="${escapeHtml(saasAccount.tenantId || "tenant-de-linde")}" required></label>
          <label class="field"><span>Plan</span><select name="plan">${["Starter", "Pro", "Scale", "Enterprise"].map((plan) => `<option ${saasAccount.plan === plan ? "selected" : ""}>${plan}</option>`).join("")}</select></label>
          <label class="field"><span>Billingstatus</span><select name="billingStatus">${["Trial actief", "Actief", "Betaalactie nodig", "Pauze"].map((status) => `<option ${saasAccount.billingStatus === status ? "selected" : ""}>${status}</option>`).join("")}</select></label>
          <label class="field"><span>Dataregio</span><select name="dataRegion">${["EU / Belgie", "EU", "EU / Nederland"].map((region) => `<option ${saasAccount.dataRegion === region ? "selected" : ""}>${region}</option>`).join("")}</select></label>
        </div>
        <div class="form-grid">
          <label class="field"><span>Seats inbegrepen</span><input name="seatsIncluded" type="number" min="1" value="${escapeHtml(seatsIncluded)}"></label>
          <label class="field"><span>Clientlimiet</span><input name="clientLimit" type="number" min="1" value="${escapeHtml(clientLimit)}"></label>
          <label class="field"><span>AI credits/maand</span><input name="aiCreditsIncluded" type="number" min="0" value="${escapeHtml(aiCreditsIncluded)}"></label>
          <label class="field"><span>AI credits gebruikt</span><input name="aiCreditsUsed" type="number" min="0" value="${escapeHtml(aiCreditsUsed)}"></label>
        </div>
        <label class="field"><span>Volgende verlenging</span><input name="renewalDate" value="${escapeHtml(saasAccount.renewalDate || "")}" placeholder="31/07/2026"></label>
        <button class="primary-action" type="submit">SaaS account opslaan</button>
      </form>

      <div class="panel wide" data-section="saas-usage-ledger">
        <div class="panel-header"><div><h2>Usage ledger</h2><p>Transparante tenant-events die abonnement, limieten en AI-verbruik verklaren.</p></div>${badge(`${saasUsageLedger.length} events`, "success")}</div>
        <div class="security-list">
          ${saasUsageLedger.map((entry) => `
            <article class="security-row">
              <div>
                <strong>${escapeHtml(entry.category)} / ${escapeHtml(entry.metric)}</strong>
                <span>${escapeHtml(entry.period)} / ${escapeHtml(entry.recordedAt)} / ${escapeHtml(entry.used)} van ${escapeHtml(entry.limit)} gebruikt</span>
                <span>${escapeHtml(entry.impact)}</span>
              </div>
              <div class="status-stack">
                ${badge(entry.status, entry.status === "Open" ? "warning" : "success")}
              </div>
            </article>
          `).join("") || `<p class="empty-state">Nog geen usage events voor deze tenant.</p>`}
        </div>
      </div>

      <form class="panel wide" data-form="saas-plan-change" data-section="saas-plan-change">
        <div class="panel-header"><div><h2>Planwijziging</h2><p>Vraag een upgrade, downgrade of contractaanpassing aan voor deze tenant.</p></div>${badge(saasPlanChanges.length ? `${saasPlanChanges.length} aanvragen` : "Geen aanvragen", saasPlanChanges.length ? "warning" : "success")}</div>
        <div class="form-grid">
          <label class="field"><span>Gewenst plan</span><select name="requestedPlan">${["Starter", "Pro", "Scale", "Enterprise"].map((plan) => `<option ${plan === "Scale" ? "selected" : ""}>${plan}</option>`).join("")}</select></label>
          <label class="field"><span>Ingang vanaf</span><input name="effectiveAt" value="${escapeHtml(saasAccount.renewalDate || "01/08/2026")}" required></label>
        </div>
        <label class="field"><span>Reden</span><textarea name="reason" rows="3" required>Meer seats, clienten of AI credits nodig voor de praktijkgroei.</textarea></label>
        <button class="primary-action" type="submit">Planwijziging aanvragen</button>
        <div class="security-list">
          ${saasPlanChanges.map((change) => `
            <article class="security-row">
              <div>
                <strong>${escapeHtml(change.currentPlan)} naar ${escapeHtml(change.requestedPlan)}</strong>
                <span>${escapeHtml(change.effectiveAt)} / aangevraagd door ${escapeHtml(change.requestedBy || "PraktijkOS")} op ${escapeHtml(change.requestedAt || "vandaag")}</span>
                <span>${escapeHtml(change.reason)}</span>
              </div>
              <div class="status-stack">
                ${badge(change.status || "Aangevraagd", change.status === "Goedgekeurd" ? "success" : "warning")}
              </div>
            </article>
          `).join("") || `<p class="empty-state">Nog geen planwijzigingen aangevraagd.</p>`}
        </div>
      </form>

      <div class="panel wide" data-section="saas-billing">
        <div class="panel-header"><div><h2>SaaS billing</h2><p>Abonnementfacturen voor deze tenant en betaalstatus.</p></div>${badge(openSaasInvoices.length ? `${openSaasInvoices.length} open` : "Betaald", openSaasInvoices.length ? "warning" : "success")}</div>
        <div class="security-list">
          ${saasInvoices.map((invoice) => `
            <article class="security-row">
              <div>
                <strong>${escapeHtml(invoice.period)} / ${escapeHtml(invoice.plan)} / ${formatEuro(invoice.amount)}</strong>
                <span>Tenant ${escapeHtml(invoice.tenantId || saasAccount.tenantId || "tenant")} / uitgifte ${escapeHtml(invoice.issuedAt || "n.v.t.")} / vervalt ${escapeHtml(invoice.dueAt || "n.v.t.")}${invoice.paidAt ? ` / betaald ${escapeHtml(invoice.paidAt)}` : ""}</span>
                ${invoice.paymentHandoff ? `<span>Betaallink: ${escapeHtml(invoice.paymentHandoff.status)} / ${escapeHtml(invoice.paymentHandoff.reference)} / ${escapeHtml(invoice.paymentHandoff.channel)}</span>` : ""}
                ${invoice.dunningNotice ? `<span>Opvolging: ${escapeHtml(invoice.dunningNotice.status)} / ronde ${escapeHtml(invoice.dunningNotice.sequence)} / ${escapeHtml(invoice.dunningNotice.channel)}</span>` : ""}
                ${invoice.receipt ? `<span>Ontvangstbewijs: ${escapeHtml(invoice.receipt.status)} / ${escapeHtml(invoice.receipt.reference)} / ${escapeHtml(invoice.receipt.channel)}</span>` : ""}
              </div>
              <div class="status-stack">
                ${badge(invoice.status || "Open", invoice.status === "Betaald" ? "success" : "warning")}
                ${invoice.status !== "Betaald" ? `<button class="ghost-action" data-action="prepare-saas-payment" data-invoice-id="${escapeHtml(invoice.id)}" type="button">Betaallink</button>` : ""}
                ${invoice.status !== "Betaald" ? `<button class="ghost-action" data-action="remind-saas-invoice" data-invoice-id="${escapeHtml(invoice.id)}" type="button">Herinner</button>` : ""}
                ${invoice.status !== "Betaald" ? `<button class="primary-action" data-action="mark-saas-invoice-paid" data-invoice-id="${escapeHtml(invoice.id)}" type="button">Markeer betaald</button>` : ""}
              </div>
            </article>
          `).join("") || `<p class="empty-state">Nog geen SaaS facturen.</p>`}
        </div>
      </div>

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

      <form class="panel wide" data-form="knowledge-base">
        <div class="panel-header"><div><h2>Praktijkkennis</h2><p>Regels die de AI-assistent als context gebruikt.</p></div></div>
        <div class="form-grid">
          <label class="field"><span>Categorie</span><select name="category"><option>Communicatie</option><option>Planning</option><option>AI</option><option>Facturatie</option><option>Praktijk</option></select></label>
          <label class="field"><span>Titel</span><input name="title" placeholder="Bijv. Tariefbeleid of verwijsbriefstijl" required></label>
        </div>
        <label class="field"><span>Inhoud</span><textarea name="content" rows="4" placeholder="Beschrijf de praktijkregel die de assistent moet volgen." required></textarea></label>
        <div class="form-grid">
          <label class="field"><span>Status</span><select name="status"><option>Actief</option><option>Concept</option></select></label>
          <label class="field"><span>Eigenaar</span><input name="owner" value="Praktijkhouder"></label>
        </div>
        <label class="field"><span>Reviewtermijn</span><select name="reviewDue"><option>Volgend kwartaal</option><option>Maandelijks</option><option>Einde maand</option><option>Jaarlijks</option></select></label>
        <button class="primary-action" type="submit">Kennisregel toevoegen</button>
      </form>

      <div class="panel wide">
        <div class="panel-header"><div><h2>Kennisbank</h2><p>${(state.knowledgeBase || []).length} regels beschikbaar voor AI-context.</p></div></div>
        <div class="security-list">
          ${(state.knowledgeBase || []).map((item) => `
            <article class="security-row">
              <div>
                <strong>${escapeHtml(item.title)} / v${escapeHtml(item.version || 1)}</strong>
                <span>${escapeHtml(item.category)} / ${escapeHtml(item.content)} / review ${escapeHtml(item.reviewDue || "Volgend kwartaal")} / volgende ${escapeHtml(item.nextReviewDue || "nog niet gepland")} / ${(item.history || []).length} vorige versies</span>
              </div>
              <div class="status-stack">
                <label class="compact-select"><span>Status</span><select data-action="knowledge-status" data-knowledge-id="${escapeHtml(item.id)}">
                  ${["Actief", "Concept", "Gearchiveerd"].map((status) => `<option ${item.status === status ? "selected" : ""}>${status}</option>`).join("")}
                </select></label>
                <button class="ghost-action" data-action="complete-knowledge-review" data-knowledge-id="${escapeHtml(item.id)}" type="button">Review klaar</button>
                ${badge(item.status || "Actief", item.status === "Actief" ? "success" : "warning")}
              </div>
            </article>
          `).join("") || `<p class="empty-state">Nog geen kennisregels.</p>`}
        </div>
      </div>

      <div class="panel wide">
        <div class="panel-header"><div><h2>AI model registry</h2><p>Modelprofielen, promptversies en risicolabels voor AI-concepten.</p></div></div>
        <div class="security-list">
          ${(state.aiModels || []).map((model) => `
            <article class="security-row">
              <div>
                <strong>${escapeHtml(model.name)} / ${escapeHtml(model.promptVersion)}</strong>
                <span>${escapeHtml(model.provider)} / ${escapeHtml(model.useCase)} / standaard voor ${(model.defaultFor || []).join(", ") || "geen workflow"} / ${modelEvaluations.filter((evaluation) => evaluation.modelId === model.id).length} evaluaties</span>
              </div>
              <div class="status-stack">
                ${badge(model.status, model.status === "Actief" ? "success" : "warning")}
                ${badge(`Risico ${model.riskLevel}`, model.riskLevel === "Laag" ? "success" : "warning")}
              </div>
            </article>
          `).join("") || `<p class="empty-state">Nog geen modelprofielen.</p>`}
        </div>
      </div>

      <form class="panel wide" data-form="ai-model-evaluation">
        <div class="panel-header"><div><h2>Modelevaluatie</h2><p>Registreer reviewresultaten voor modelgovernance.</p></div></div>
        <div class="form-grid">
          <label class="field"><span>Model</span><select name="modelId">
            ${(state.aiModels || []).map((model) => `<option value="${escapeHtml(model.id)}">${escapeHtml(model.name)} / ${escapeHtml(model.promptVersion)}</option>`).join("")}
          </select></label>
          <label class="field"><span>Score</span><select name="score"><option>Goedgekeurd</option><option>Review nodig</option><option>Niet gebruiken</option></select></label>
        </div>
        <label class="field"><span>Status</span><input name="status" value="Review geregistreerd"></label>
        <label class="field"><span>Notities</span><textarea name="notes" rows="4" placeholder="Wat is getest, welke risico's blijven open en voor welke workflows mag dit model gebruikt worden?" required></textarea></label>
        <button class="primary-action" type="submit">Evaluatie registreren</button>
      </form>

      <div class="panel wide">
        <div class="panel-header"><div><h2>Evaluatiegeschiedenis</h2><p>${modelEvaluations.length} modelreviews vastgelegd.</p></div></div>
        <div class="security-list">
          ${modelEvaluations.slice(0, 8).map((evaluation) => `
            <article class="security-row">
              <div>
                <strong>${escapeHtml(evaluation.modelName)} / ${escapeHtml(evaluation.score)}</strong>
                <span>${escapeHtml(evaluation.status)} / ${escapeHtml(evaluation.notes)} / ${escapeHtml(evaluation.reviewedAt)} / ${escapeHtml(evaluation.reviewedBy)}</span>
              </div>
              ${badge(evaluation.score, evaluation.score === "Goedgekeurd" ? "success" : "warning")}
            </article>
          `).join("") || `<p class="empty-state">Nog geen modelevaluaties.</p>`}
        </div>
      </div>

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
          <div><strong>${escapeHtml(getWorkflowLabel(draft.workflow))}</strong><span>${escapeHtml(draft.modelName || "Model onbekend")} / ${escapeHtml(draft.promptVersion || "prompt onbekend")} / ${escapeHtml(draft.createdAt)}${draft.approvedAt ? ` / goedgekeurd ${escapeHtml(draft.approvedAt)}` : ""}${draft.savedNoteId ? " / opgeslagen als nota" : ""}</span></div>
          <div class="status-stack">
            ${badge(draft.riskLevel ? `Risico ${draft.riskLevel}` : "Geen model", draft.riskLevel === "Laag" ? "success" : "warning")}
            ${badge(draft.status, draft.status === "Goedgekeurd" ? "success" : "warning")}
          </div>
        </article>
      `).join("")}
    </div>
  `;
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

function filteredAuditLog(state, filter = "all") {
  return (state.auditLog || []).filter((entry) => auditMatchesFilter(entry, filter));
}

function auditList(state, limit = 8, filter = "all") {
  const entries = filteredAuditLog(state, filter).slice(0, limit);
  return `
    <div class="audit-list">
      ${entries.map((entry) => `
        <article class="audit-item">
          <div><strong>${escapeHtml(entry.event)}</strong><span>${escapeHtml(entry.detail)}</span></div>
          <span class="audit-meta">${escapeHtml(entry.at)} / ${escapeHtml(displayActor(entry.actor))}</span>
        </article>
      `).join("") || `<p class="empty-state">Geen audit-events voor deze filter.</p>`}
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
  const slot = state.selectedWaitlistSlot || {};

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
          <label class="field"><span>Tijd</span><input name="time" type="time" value="${escapeHtml(slot.time || "09:00")}" required></label>
          <label class="field"><span>Locatie</span><input name="location" value="${escapeHtml(slot.location || "Praktijk")}" required></label>
        </div>
        <label class="field"><span>Afspraaktype</span><input name="type" value="${escapeHtml(slot.type || entry.type || "Opvolggesprek")}" required></label>
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
