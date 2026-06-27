import { getWorkflowLabel } from "./ai.js";

const viewTitles = {
  dashboard: "Dashboard",
  agenda: "Agenda",
  clients: "Clienten",
  billing: "Facturatie",
  ai: "AI Copilot"
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
  const nav = [
    ["dashboard", "D", "Dashboard"],
    ["agenda", "A", "Agenda"],
    ["clients", "C", "Clienten"],
    ["billing", "E", "Facturatie"],
    ["ai", "AI", "AI Copilot"]
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
            <p class="eyebrow">Groepspraktijk / Belgie / ${state.locale}</p>
            <h1>${viewTitles[state.view]}</h1>
          </div>
          <div class="topbar-actions">
            <button class="icon-button" data-action="toggle-locale" type="button">${state.locale}</button>
            <button class="ghost-action" data-action="reset-demo" type="button">Reset demo</button>
            <button class="primary-action" data-action="new-appointment" type="button">Nieuwe afspraak</button>
          </div>
        </header>
        ${renderView(state)}
      </main>
    </div>
    ${modal(state)}
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
  const noShowCount = state.appointments.filter((appointment) => appointment.signal === "danger").length;

  return `
    <section class="metric-grid">
      <article class="metric"><span>Vandaag</span><strong>${state.appointments.length}</strong><small>afspraken gepland</small></article>
      <article class="metric"><span>AI concepten</span><strong>${state.aiDrafts.length}</strong><small>${state.aiDrafts.filter((draft) => draft.status === "Goedgekeurd").length} goedgekeurd</small></article>
      <article class="metric"><span>Openstaand</span><strong>${formatEuro(openAmount)}</strong><small>${state.invoices.length} facturen</small></article>
      <article class="metric"><span>No-show risico</span><strong>${noShowCount}</strong><small>opvolging nodig</small></article>
    </section>
    <section class="content-grid">
      <div class="panel wide">
        <div class="panel-header"><div><h2>Vandaag</h2><p>Agenda, dossierstatus en administratie in een werkrij.</p></div></div>
        <div class="timeline">
          ${state.appointments.map((appointment) => `
            <article class="timeline-item">
              <span class="time">${escapeHtml(appointment.time)}</span>
              <div><strong>${escapeHtml(appointment.client)}</strong><span>${escapeHtml(appointment.type)} / ${escapeHtml(appointment.clinician)}</span></div>
              ${badge(appointment.status, appointment.signal)}
            </article>
          `).join("")}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><div><h2>Werkvoorraad</h2><p>Wat secretariaat en zorgverleners vandaag moeten afwerken.</p></div></div>
        <div class="task-list">
          ${state.workQueue.map((task) => `
            <article class="task-item">
              <strong>${escapeHtml(task.label)}</strong>
              <span>${escapeHtml(task.owner)} / ${escapeHtml(task.priority)}</span>
              <button class="ghost-action" data-action="navigate" data-view="ai" type="button">Open workflow</button>
            </article>
          `).join("")}
        </div>
      </div>
      <div class="panel wide">
        <div class="panel-header"><div><h2>Audit trail</h2><p>Laatste systeem- en AI-events.</p></div></div>
        ${auditList(state)}
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
        <div class="panel-header"><div><h2>${escapeHtml(selected.name)}</h2><p>${escapeHtml(selected.track)}</p></div>${badge(selected.status)}</div>
        <dl>
          <dt>Leeftijd</dt><dd>${escapeHtml(selected.age)}</dd>
          <dt>Zorgverlener</dt><dd>${escapeHtml(selected.clinician)}</dd>
          <dt>Volgende afspraak</dt><dd>${escapeHtml(selected.nextAppointment)}</dd>
          <dt>Administratie</dt><dd>${escapeHtml(selected.adminStatus)}</dd>
          <dt>AI voorstel</dt><dd>${escapeHtml(selected.aiSuggestion)}</dd>
        </dl>
        <button class="primary-action" data-action="prepare-ai" data-source="${escapeHtml(`${selected.name}: ${selected.aiSuggestion}`)}" type="button">Open AI workflow</button>
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
            <article class="invoice-row"><strong>${escapeHtml(invoice.client)}</strong><span>${formatEuro(invoice.amount)}</span><span>${escapeHtml(invoice.channel)}</span>${badge(invoice.status, invoice.status === "Herinnering" ? "warning" : "success")}</article>
          `).join("")}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><div><h2>Betaalstromen</h2><p>Bancontact, Wero en boekhouder-export.</p></div></div>
        <div class="payment-stack">
          <div><strong>EUR 6.420</strong><span>betaald deze maand</span></div>
          <div><strong>EUR 1.180</strong><span>te verzenden via Peppol</span></div>
          <div><strong>EUR 460</strong><span>automatische herinnering klaar</span></div>
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

function auditList(state) {
  return `
    <div class="audit-list">
      ${state.auditLog.slice(0, 8).map((entry) => `
        <article class="audit-item">
          <div><strong>${escapeHtml(entry.event)}</strong><span>${escapeHtml(entry.detail)}</span></div>
          <span class="audit-meta">${escapeHtml(entry.at)} / ${escapeHtml(entry.actor)}</span>
        </article>
      `).join("")}
    </div>
  `;
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
