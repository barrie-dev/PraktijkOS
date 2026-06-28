import {
  addAppointment,
  addClient,
  addDocument,
  addIntake,
  addInvoice,
  addMessage,
  addNote,
  addPortalInvite,
  addTeamMember,
  approveCurrentDraft,
  bootstrapState,
  changeAppointmentStatus,
  changeDocumentStatus,
  changeInvoiceChannel,
  changeMessageStatus,
  closeModal,
  completeTask,
  completeOnboarding,
  createInvoiceProposals,
  getState,
  loginUser,
  logoutUser,
  openModal,
  markInvoicePaid,
  remindInvoice,
  resetDemoState,
  runAiWorkflow,
  savePracticeSettings,
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

async function handleClick(event) {
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

  if (action === "logout") {
    const result = await logoutUser();
    showToast(result.message);
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
    const source = inputValue("ai-input");
    const result = await runAiWorkflow(source);
    showToast(result.message);
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
    const result = await approveCurrentDraft();
    showToast(result.message);
    return;
  }

  if (action === "generate-invoices") {
    const result = await createInvoiceProposals();
    showToast(result.message);
    return;
  }

  if (action === "mark-invoice-paid") {
    const result = await markInvoicePaid(target.dataset.invoiceId);
    showToast(result.message);
    return;
  }

  if (action === "remind-invoice") {
    const result = await remindInvoice(target.dataset.invoiceId);
    showToast(result.message);
    return;
  }

  if (action === "complete-task") {
    const result = await completeTask(target.dataset.taskId);
    showToast(result.message);
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

  if (target.dataset.action === "invoice-channel") {
    changeInvoiceChannel(target.dataset.invoiceId, target.value).then((result) => showToast(result.message));
  }

  if (target.dataset.action === "appointment-status") {
    changeAppointmentStatus(target.dataset.appointmentId, target.value).then((result) => showToast(result.message));
  }

  if (target.dataset.action === "message-status") {
    changeMessageStatus(target.dataset.messageId, target.value).then((result) => showToast(result.message));
  }

  if (target.dataset.action === "document-status") {
    changeDocumentStatus(target.dataset.documentId, target.value).then((result) => showToast(result.message));
  }
}

async function handleSubmit(event) {
  const form = event.target.closest("[data-form]");
  if (!form) return;

  event.preventDefault();
  const formData = new FormData(form);
  let result;
  if (form.dataset.form === "client") {
    result = await addClient(formData);
  } else if (form.dataset.form === "login") {
    result = await loginUser(formData);
  } else if (form.dataset.form === "onboarding") {
    result = await completeOnboarding(formData);
  } else if (form.dataset.form === "appointment") {
    result = await addAppointment(formData);
  } else if (form.dataset.form === "practice") {
    result = await savePracticeSettings(formData);
  } else if (form.dataset.form === "team") {
    result = await addTeamMember(formData);
  } else if (form.dataset.form === "intake") {
    result = await addIntake(formData);
  } else if (form.dataset.form === "invoice") {
    result = await addInvoice(formData);
  } else if (form.dataset.form === "message") {
    result = await addMessage(formData);
  } else if (form.dataset.form === "portal-invite") {
    result = await addPortalInvite(formData);
  } else if (form.dataset.form === "note") {
    result = await addNote(formData);
  } else if (form.dataset.form === "document") {
    result = await addDocument(formData);
  }
  showToast(result.message);
}

subscribe(render);
render();
bootstrapState();

document.addEventListener("click", handleClick);
document.addEventListener("input", handleInput);
document.addEventListener("change", handleChange);
document.addEventListener("submit", handleSubmit);
