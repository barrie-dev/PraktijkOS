import { getWorkflowLabel } from "./ai.js";

const viewTitles = {
  dashboard: "Dashboard",
  agenda: "Agenda",
  clients: "Cliënten",
  billing: "Facturatie",
  ai: "AI Copilot"
};

function formatEuro(amount) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(amount);
}

function badge(label, signal = "success") {
  return `<span class="badge ${signal}">${label}</span>`;
}

function shell(state) {
  const nav = [
    ["dashboard", "⌂", "Dashboard"],
    ["agenda", "▦", "Agenda"],
    ["clients", "◉", "Cliënten"],
    ["billing", "€", "Facturatie"],
    ["ai", "✦", "AI Copilot"]
  ];

  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">P</div>
          <div><strong>PraktijkOS</strong><span>Belgian AI practice OS</span></div>
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
          <div><strong>AI governance</strong><p>Concepten vereisen altijd professionele review.</p></div>
        </div>
      </aside>
      <main class="workspace">
        <header class="topbar">
          <div>
            <p class="eyebrow">Groepspraktijk · België · ${state.locale}</p>
            <h1>${viewTitles[state.view]}</h1>
          </div>
          <div class="topbar-actions">
            <button class="icon-button" data-action="toggle-locale" type="button">${state.locale}</button>
            <button class="primary-action" data-action="new-appointment" type="button">Nieuwe afspraak</button>
          </div>
        </header>
        ${renderView(state)}
      </main>
    </div>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
  `;
}

function renderView(state) {
  if (state.view === "agenda") return agendaView(state);
  if (state.view === "clients") return clientsView(state);
  if (state.view === "billing") return billingView(state);
  if (state.view === "ai") return aiView(state);
  return dashboardView(state);
}

function dashboardView(state) {
  const openAmount = state.invoices.reduce((total, invoice) => total + invoice.amount, 0);
  return `
    <section class="metric-grid">
      <article class="metric"><span>Vandaag</span><strong>${state.appointments.length}</strong><small>afspraken gepland</small></article>
      <article class="metric"><span>AI-tijdswinst</span><strong>4u 20</strong><small>deze week</small></article>
      <article class="metric"><span>Openstaand</span><strong>${formatEuro(openAmount)}</strong><small>${state.invoices.length} facturen</small></article>
      <article class="metric"><span>No-show risico</span><strong>3</strong><small>opvolging nodig</small></article>
    </section>
    <section class="content-grid">
      <div class="panel wide">
        <div class="panel-header"><div><h2>Vandaag</h2><p>Agenda, dossierstatus en administratie in één werkrij.</p></div></div>
        <div class="timeline">
          ${state.appointments.map((appointment) => `
            <article class="timeline-item">
              <span class="time">${appointment.time}</span>
              <div><strong>${appointment.client}</strong><span>${appointment.type} · ${appointment.clinician}</span></div>
              ${badge(appointment.status, appointment.signal)}
            </article>
          `).join("")}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><div><h2>AI werkvoorraad</h2><p>Concepten en controles die wachten.</p></div></div>
        <div class="task-list">
          ${state.workQueue.map((task) => `
            <article class="task-item">
              <strong>${task.label}</strong>
              <span>${task.owner} · ${task.priority}</span>
              <button class="ghost-action" data-action="navigate" data-view="ai" type="button">Open workflow</button>
            </article>
          `).join("")}
        </div>
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
      <label class="search-field"><span>Zoek</span><input data-action="filter-appointments" type="search" value="${state.appointmentFilter}" placeholder="Cliënt, zorgverlener of type"></label>
    </section>
    <section class="schedule-board">
      ${appointments.map((appointment) => `
        <article class="schedule-card">
          <header><div><span class="time">${appointment.time}</span><strong>${appointment.client}</strong></div>${badge(appointment.status, appointment.signal)}</header>
          <p>${appointment.type}</p>
          <span>${appointment.clinician} · ${appointment.location}</span>
          <p>${appointment.aiHint}</p>
          <button class="ghost-action" data-action="prepare-ai" data-source="${appointment.client}: ${appointment.aiHint}" type="button">AI actie</button>
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

  return `
    <section class="toolbar">
      <label class="search-field"><span>Zoek</span><input data-action="filter-clients" type="search" value="${state.clientFilter}" placeholder="Naam, traject of status"></label>
      <button class="primary-action" data-action="new-client" type="button">Nieuwe cliënt</button>
    </section>
    <section class="client-layout">
      <div class="client-list">
        ${clients.map((client) => `
          <button class="client-card ${client.id === selected.id ? "active" : ""}" data-action="select-client" data-client-id="${client.id}" type="button">
            <strong>${client.name}</strong><span>${client.track}</span>${badge(client.status)}
          </button>
        `).join("")}
      </div>
      <article class="panel client-detail">
        <div class="panel-header"><div><h2>${selected.name}</h2><p>${selected.track}</p></div>${badge(selected.status)}</div>
        <dl>
          <dt>Leeftijd</dt><dd>${selected.age}</dd>
          <dt>Zorgverlener</dt><dd>${selected.clinician}</dd>
          <dt>Volgende afspraak</dt><dd>${selected.nextAppointment}</dd>
          <dt>Administratie</dt><dd>${selected.adminStatus}</dd>
          <dt>AI voorstel</dt><dd>${selected.aiSuggestion}</dd>
        </dl>
        <button class="primary-action" data-action="prepare-ai" data-source="${selected.name}: ${selected.aiSuggestion}" type="button">Open AI workflow</button>
      </article>
    </section>
  `;
}

function billingView(state) {
  return `
    <section class="content-grid">
      <div class="panel wide">
        <div class="panel-header"><div><h2>Facturen</h2><p>Belgische betaalopvolging met Peppol-ready status.</p></div><button class="primary-action" data-action="generate-invoices" type="button">Maak voorstellen</button></div>
        <div class="invoice-table">
          ${state.invoices.map((invoice) => `
            <article class="invoice-row"><strong>${invoice.client}</strong><span>${formatEuro(invoice.amount)}</span><span>${invoice.channel}</span>${badge(invoice.status, invoice.status === "Herinnering" ? "warning" : "success")}</article>
          `).join("")}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><div><h2>Betaalstromen</h2><p>Bancontact, Wero en boekhouder-export.</p></div></div>
        <div class="payment-stack">
          <div><strong>€6.420</strong><span>betaald deze maand</span></div>
          <div><strong>€1.180</strong><span>te verzenden via Peppol</span></div>
          <div><strong>€460</strong><span>automatische herinnering klaar</span></div>
        </div>
      </div>
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
        <label class="field"><span>Broncontext</span><textarea data-action="ai-input" rows="9">Cliënt meldt stressklachten, slaapproblemen en piekeren rond werk. Eerste gesprek, vraag naar kortdurende begeleiding. Wil graag afspraken op dinsdagavond.</textarea></label>
        <div class="ai-actions"><button class="primary-action" data-action="run-ai" type="button">Genereer concept</button><button class="ghost-action" data-action="clear-ai" type="button">Wis</button></div>
      </div>
      <div class="panel ai-output-panel">
        <div class="panel-header"><div><h2>Concept</h2><p>Controleer, pas aan en keur goed voor opslag.</p></div><span class="draft-badge">Concept</span></div>
        <pre>${state.aiDraft}</pre>
        <div class="approval-row">
          <label class="checkbox-line"><input data-action="approve-checkbox" type="checkbox" ${state.aiApproved ? "checked" : ""}><span>Gecontroleerd door zorgverlener</span></label>
          <button class="primary-action" data-action="approve-ai" type="button" ${state.aiApproved ? "" : "disabled"}>Goedkeuren</button>
        </div>
      </div>
    </section>
  `;
}

export function renderApp(state) {
  return shell(state);
}
