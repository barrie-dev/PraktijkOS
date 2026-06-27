import { generateDraft } from "./ai.js";
import { getState, setState, subscribe } from "./store.js";
import { renderApp } from "./render.js";

const root = document.querySelector("#app");
let toastTimer;

function render() {
  root.innerHTML = renderApp(getState());
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function inputValue(action) {
  return document.querySelector(`[data-action="${action}"]`)?.value || "";
}

function handleClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const action = target.dataset.action;

  if (action === "navigate") {
    setState({ view: target.dataset.view });
    return;
  }

  if (action === "toggle-locale") {
    setState({ locale: getState().locale === "NL" ? "FR" : "NL" });
    showToast("Taalcontext gewisseld.");
    return;
  }

  if (action === "new-appointment") {
    setState({ view: "agenda" });
    showToast("Nieuwe afspraak-flow wordt de volgende backend-stap.");
    return;
  }

  if (action === "new-client") {
    showToast("Cliënt aanmaken wordt gekoppeld aan de API-laag.");
    return;
  }

  if (action === "select-client") {
    setState({ selectedClientId: target.dataset.clientId });
    return;
  }

  if (action === "prepare-ai") {
    setState({
      view: "ai",
      aiDraft: `Broncontext voorbereid:\n${target.dataset.source}\n\nGenereer een concept om verder te werken.`,
      aiApproved: false
    });
    showToast("AI workflow voorbereid.");
    return;
  }

  if (action === "run-ai") {
    const state = getState();
    setState({
      aiDraft: generateDraft({ workflow: state.aiWorkflow, input: inputValue("ai-input") }),
      aiApproved: false
    });
    showToast("AI concept gegenereerd. Review blijft verplicht.");
    return;
  }

  if (action === "clear-ai") {
    setState({
      aiDraft: "Kies een workflow en genereer een concept.",
      aiApproved: false
    });
    return;
  }

  if (action === "approve-ai") {
    showToast("Concept goedgekeurd en audit-event gelogd.");
    return;
  }

  if (action === "generate-invoices") {
    showToast("Factuurvoorstellen gegenereerd voor review.");
  }
}

function handleInput(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  if (target.dataset.action === "filter-appointments") {
    setState({ appointmentFilter: target.value });
  }

  if (target.dataset.action === "filter-clients") {
    setState({ clientFilter: target.value });
  }
}

function handleChange(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  if (target.dataset.action === "ai-workflow") {
    setState({ aiWorkflow: target.value, aiApproved: false });
  }

  if (target.dataset.action === "approve-checkbox") {
    setState({ aiApproved: target.checked });
  }
}

subscribe(render);
render();

document.addEventListener("click", handleClick);
document.addEventListener("input", handleInput);
document.addEventListener("change", handleChange);
