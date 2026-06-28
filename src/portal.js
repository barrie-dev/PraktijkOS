const app = document.querySelector("#portal-app");
const token = new URLSearchParams(window.location.search).get("token");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function itemList(items, emptyText, renderItem) {
  if (!items.length) return `<p class="empty-state">${escapeHtml(emptyText)}</p>`;
  return items.map(renderItem).join("");
}

function render(data) {
  app.innerHTML = `
    <section class="portal-hero">
      <div>
        <span>PraktijkOS Portal</span>
        <h1>${escapeHtml(data.practice.name)}</h1>
        <p>Welkom ${escapeHtml(data.client.name)}. Hier staan je berichten, documenten en intake-status klaar.</p>
      </div>
    </section>
    <section class="portal-grid">
      <article class="panel">
        <div class="panel-header"><div><h2>Berichten</h2><p>Communicatie vanuit de praktijk.</p></div></div>
        <div class="portal-list">
          ${itemList(data.messages, "Geen berichten.", (message) => `
            <article class="portal-item">
              <div><strong>${escapeHtml(message.subject)}</strong><span>${escapeHtml(message.channel)} / ${escapeHtml(message.status)}</span><p>${escapeHtml(message.body)}</p></div>
            </article>
          `)}
        </div>
      </article>
      <article class="panel">
        <div class="panel-header"><div><h2>Documenten</h2><p>Verslagen, attesten en nota's.</p></div></div>
        <div class="portal-list">
          ${itemList(data.documents, "Geen documenten.", (document) => `
            <article class="portal-item">
              <div><strong>${escapeHtml(document.title)}</strong><span>${escapeHtml(document.type)} / ${escapeHtml(document.status)}</span></div>
            </article>
          `)}
        </div>
      </article>
      <article class="panel wide">
        <div class="panel-header"><div><h2>Intake</h2><p>Status van ontvangen intakegegevens.</p></div></div>
        <div class="portal-list">
          ${itemList(data.intakes, "Geen intakegegevens.", (intake) => `
            <article class="portal-item">
              <div><strong>${escapeHtml(intake.status)}</strong><span>${escapeHtml(intake.submittedAt || "Nog niet ingediend")}</span><p>${escapeHtml(intake.answers?.hulpvraag || "")}</p></div>
            </article>
          `)}
        </div>
      </article>
    </section>
  `;
}

async function bootstrap() {
  if (!token) {
    app.innerHTML = `<section class="portal-error"><h1>Geen geldige toegang</h1><p>Vraag een nieuwe link aan bij je praktijk.</p></section>`;
    return;
  }

  try {
    const response = await fetch(`/api/portal/${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error("Portal unavailable");
    render(await response.json());
  } catch {
    app.innerHTML = `<section class="portal-error"><h1>Toegang niet actief</h1><p>Deze link is verlopen of bestaat niet meer.</p></section>`;
  }
}

bootstrap();
