import { generateDraft } from "./ai.js";
import {
  addAppointment,
  addClient,
  approveCurrentDraft,
  closeModal,
  getState,
  openModal,
  recordDraft,
  resetDemoState,
  setState,
  subscribe
} from "./store.js";
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

  if (action === "close-modal") {
    if (event.target === target || target.tagName === "BUTTON") {
      closeModal();
    }
    return;
  }

  if (action === "navigate") {
    setState({ view: target.dataset.view });
    return;
  }

  if (action === "toggle-locale") {
    setState({ locale: getState().locale === "NL" ? "FR" : "NL" });
    showToast("Taalcontext gewisseld.");
    return;
  }

  if (action === "reset-demo") {
    resetDemoState();
    showToast("Demo opnieuw geladen.");
    return;
  }

  if (action === "new-appointment") {
    openModal("appointment");
    return;
  }

  if (action === "new-client") {
    openModal("client");
    return;
  }

  if (action === "select-client") {
    setState({ selectedClientId: target.dataset.clientId });
    return;
  }

  if (action === "prepare-ai") {
    const source = target.dataset.source || "";
    setState({
      view: "ai",
      aiSource: source,
      aiDraft: `Broncontext voorbereid:\n${source}\n\nGenereer een concept om verder te werken.`,
      aiApproved: false,
      currentDraftId: null
    });
    showToast("AI workflow voorbereid.");
    return;
  }

  if (action === "run-ai") {
    const state = getState();
    const source = inputValue("ai-input");
    const output = generateDraft({ workflow: state.aiWorkflow, input: source });
    recordDraft({ workflow: state.aiWorkflow, source, output });
    showToast("AI concept gegenereerd. Review blijft verplicht.");
    return;
  }

  if (action === "clear-ai") {
    setState({
      aiDraft: "Kies een workflow en genereer een concept.",
      aiSource: "",
      aiApproved: false,
      currentDraftId: null
    });
    return;
  }

  if (action === "approve-ai") {
    const result = approveCurrentDraft();
    showToast(result.message);
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

  if (target.dataset.action === "ai-input") {
    setState({ aiSource: target.value });
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

function handleSubmit(event) {
  const form = event.target.closest("[data-form]");
  if (!form) return;

  event.preventDefault();
  const formData = new FormData(form);
  const result = form.dataset.form === "client" ? addClient(formData) : addAppointment(formData);
  showToast(result.message);
}

subscribe(render);
render();

document.addEventListener("click", handleClick);
document.addEventListener("input", handleInput);
document.addEventListener("change", handleChange);
document.addEventListener("submit", handleSubmit);
