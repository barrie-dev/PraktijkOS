import {
  addAppointment,
  addAccessOverride,
  addClient,
  addDocument,
  addIntake,
  addInvoice,
  addIsoEvidenceAttachment,
  addIsoEvidenceNote,
  addAiModelEvaluation,
  addKnowledgeItem,
  addMessage,
  addNote,
  addPortalInvite,
  addTeamMember,
  addVoiceConsent,
  acknowledgeSaasActivity,
  applyPreparedImport,
  approveCurrentDraft,
  bootstrapState,
  changeAppointmentStatus,
  changeAccessOverrideStatus,
  changeDocumentStatus,
  changeSaasFeatureEntitlement,
  changeSaasSupportTicket,
  changeInvoiceChannel,
  changeKnowledgeItemStatus,
  changeMessageStatus,
  changePortalInviteStatus,
  changeRetentionPolicyStatus,
  closeModal,
  collectIsoEvidence,
  completeDayClose,
  completeIntegrationReview,
  completeKnowledgeReview,
  completeRetentionReview,
  completeSaasImplementationItem,
  completeSaasOnboardingItem,
  completeTask,
  completeOnboarding,
  createAccountingExport,
  createAuditExport,
  createBillingExport,
  createIsoEvidenceExport,
  createVoiceNoteDraft,
  createInvoiceProposals,
  downloadClientDossier,
  getState,
  loginUser,
  logoutUser,
  openModal,
  prepareImportPreview,
  prepareInvoiceForPeppol,
  prepareInvoicePaymentRequest,
  prepareSaasPaymentHandoff,
  markInvoicePaid,
  markSaasInvoicePaid,
  remindSaasInvoice,
  remindInvoice,
  resetDemoState,
  requestSaasLifecycleChange,
  requestSaasPlanChange,
  rollbackPreparedImport,
  runAiWorkflow,
  scheduleFromWaitlist,
  savePracticeSettings,
  saveSaasAccountSettings,
  selectMessageTemplate,
  setState,
  shareSaasContract,
  subscribe
} from "./store.js";
import { renderApp } from "./render.js";

const root = document.querySelector("#app");
let toastTimer;

function render() {
  const activeElement = document.activeElement;
  const restoreCommandSearch = activeElement?.dataset?.action === "command-search";
  const selectionStart = restoreCommandSearch ? activeElement.selectionStart : null;
  const selectionEnd = restoreCommandSearch ? activeElement.selectionEnd : null;
  root.innerHTML = renderApp(getState());
  if (restoreCommandSearch) {
    const nextInput = document.querySelector('[data-action="command-search"]');
    nextInput?.focus();
    nextInput?.setSelectionRange(selectionStart, selectionEnd);
  }
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
    setState({ view: target.dataset.view, commandQuery: "" });
    return;
  }

  if (action === "command-open") {
    const nextState = { commandQuery: "" };
    if (target.dataset.view) nextState.view = target.dataset.view;
    if (target.dataset.clientId) nextState.selectedClientId = target.dataset.clientId;
    if (target.dataset.appointmentFilter) nextState.appointmentFilter = target.dataset.appointmentFilter;
    setState(nextState);
    if (target.dataset.commandAction === "new-appointment") {
      openModal("appointment");
    }
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

  if (action === "schedule-waitlist") {
    setState({ selectedWaitlistId: target.dataset.waitlistId, selectedWaitlistSlot: null, modal: "waitlist" });
    return;
  }

  if (action === "suggest-waitlist-slot") {
    setState({
      selectedWaitlistId: target.dataset.waitlistId,
      selectedWaitlistSlot: {
        time: target.dataset.time,
        location: target.dataset.location,
        type: target.dataset.type
      },
      modal: "waitlist"
    });
    return;
  }

  if (action === "schedule-client") {
    setState({ selectedClientId: target.dataset.clientId, modal: "appointment" });
    return;
  }

  if (action === "compose-message") {
    setState({ selectedClientId: target.dataset.clientId, view: "portal" });
    showToast("Client staat klaar in het berichtformulier.");
    return;
  }

  if (action === "use-message-template") {
    const result = selectMessageTemplate(target.dataset.template);
    showToast(result.message);
    return;
  }

  if (action === "start-intake") {
    setState({ selectedClientId: target.dataset.clientId, view: "intake" });
    showToast("Client staat klaar in het intakeformulier.");
    return;
  }

  if (action === "new-client") {
    openModal("client");
    return;
  }

  if (action === "open-client") {
    setState({ selectedClientId: target.dataset.clientId, view: "clients" });
    return;
  }

  if (action === "select-client") {
    setState({ selectedClientId: target.dataset.clientId });
    return;
  }

  if (action === "export-client") {
    const result = await downloadClientDossier(target.dataset.clientId);
    showToast(result.message);
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

  if (action === "export-billing") {
    const result = await createBillingExport();
    showToast(result.message);
    return;
  }

  if (action === "export-accounting") {
    const result = await createAccountingExport(getState().accountingTool || "exact");
    showToast(result.message);
    return;
  }

  if (action === "prepare-peppol") {
    const result = await prepareInvoiceForPeppol(target.dataset.invoiceId);
    showToast(result.message);
    return;
  }

  if (action === "prepare-payment-request") {
    const result = await prepareInvoicePaymentRequest(target.dataset.invoiceId);
    showToast(result.message);
    return;
  }

  if (action === "export-audit") {
    const result = await createAuditExport(getState().auditFilter || "all");
    showToast(result.message);
    return;
  }

  if (action === "export-iso-evidence") {
    const result = await createIsoEvidenceExport();
    showToast(result.message);
    return;
  }

  if (action === "mark-invoice-paid") {
    const result = await markInvoicePaid(target.dataset.invoiceId);
    showToast(result.message);
    return;
  }

  if (action === "mark-saas-invoice-paid") {
    const result = await markSaasInvoicePaid(target.dataset.invoiceId);
    showToast(result.message);
    return;
  }

  if (action === "prepare-saas-payment") {
    const result = await prepareSaasPaymentHandoff(target.dataset.invoiceId);
    showToast(result.message);
    return;
  }

  if (action === "remind-saas-invoice") {
    const result = await remindSaasInvoice(target.dataset.invoiceId);
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
    return;
  }

  if (action === "complete-saas-onboarding") {
    const result = await completeSaasOnboardingItem(target.dataset.itemId);
    showToast(result.message);
    return;
  }

  if (action === "toggle-saas-entitlement") {
    const result = await changeSaasFeatureEntitlement(target.dataset.entitlementId, target.dataset.status);
    showToast(result.message);
    return;
  }

  if (action === "acknowledge-saas-activity") {
    const result = await acknowledgeSaasActivity(target.dataset.activityId);
    showToast(result.message);
    return;
  }

  if (action === "change-saas-support") {
    const result = await changeSaasSupportTicket(target.dataset.ticketId, target.dataset.status);
    showToast(result.message);
    return;
  }

  if (action === "share-saas-contract") {
    const result = await shareSaasContract(target.dataset.documentId);
    showToast(result.message);
    return;
  }

  if (action === "complete-saas-implementation") {
    const result = await completeSaasImplementationItem(target.dataset.milestoneId);
    showToast(result.message);
    return;
  }

  if (action === "complete-retention-review") {
    const result = await completeRetentionReview(target.dataset.policyId);
    showToast(result.message);
    return;
  }

  if (action === "complete-integration-review") {
    const result = await completeIntegrationReview(target.dataset.integrationId);
    showToast(result.message);
    return;
  }

  if (action === "collect-iso-evidence") {
    const result = await collectIsoEvidence(target.dataset.packId);
    showToast(result.message);
    return;
  }

  if (action === "complete-knowledge-review") {
    const result = await completeKnowledgeReview(target.dataset.knowledgeId);
    showToast(result.message);
    return;
  }

  if (action === "complete-day-close") {
    const result = await completeDayClose(target.dataset.itemId);
    showToast(result.message);
    return;
  }

  if (action === "apply-import") {
    const result = await applyPreparedImport(target.dataset.previewId);
    showToast(result.message);
    return;
  }

  if (action === "rollback-import") {
    const result = await rollbackPreparedImport(target.dataset.previewId);
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

  if (target.dataset.action === "command-search") {
    setState({ commandQuery: target.value });
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

  if (target.dataset.action === "ai-client") {
    setState({ selectedClientId: target.value });
  }

  if (target.dataset.action === "voice-client") {
    setState({ voiceClientId: target.value });
  }

  if (target.dataset.action === "ai-model") {
    setState({ aiModelId: target.value });
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

  if (target.dataset.action === "access-override-status") {
    changeAccessOverrideStatus(target.dataset.overrideId, target.value).then((result) => showToast(result.message));
  }

  if (target.dataset.action === "retention-policy-status") {
    changeRetentionPolicyStatus(target.dataset.policyId, target.value).then((result) => showToast(result.message));
  }

  if (target.dataset.action === "knowledge-status") {
    changeKnowledgeItemStatus(target.dataset.knowledgeId, target.value).then((result) => showToast(result.message));
  }

  if (target.dataset.action === "portal-invite-status") {
    changePortalInviteStatus(target.dataset.inviteId, target.value).then((result) => showToast(result.message));
  }

  if (target.dataset.action === "audit-filter") {
    setState({ auditFilter: target.value });
  }

  if (target.dataset.action === "accounting-tool") {
    setState({ accountingTool: target.value });
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
  } else if (form.dataset.form === "access-override") {
    result = await addAccessOverride(formData);
  } else if (form.dataset.form === "login") {
    result = await loginUser(formData);
  } else if (form.dataset.form === "onboarding") {
    result = await completeOnboarding(formData);
  } else if (form.dataset.form === "appointment") {
    result = await addAppointment(formData);
  } else if (form.dataset.form === "waitlist-appointment") {
    result = await scheduleFromWaitlist(formData);
  } else if (form.dataset.form === "practice") {
    result = await savePracticeSettings(formData);
  } else if (form.dataset.form === "saas-account") {
    result = await saveSaasAccountSettings(formData);
  } else if (form.dataset.form === "saas-plan-change") {
    result = await requestSaasPlanChange(formData);
  } else if (form.dataset.form === "saas-lifecycle") {
    result = await requestSaasLifecycleChange(formData);
  } else if (form.dataset.form === "team") {
    result = await addTeamMember(formData);
  } else if (form.dataset.form === "knowledge-base") {
    result = await addKnowledgeItem(formData);
  } else if (form.dataset.form === "ai-model-evaluation") {
    result = await addAiModelEvaluation(formData);
  } else if (form.dataset.form === "iso-evidence-note") {
    result = await addIsoEvidenceNote(formData);
  } else if (form.dataset.form === "iso-evidence-attachment") {
    result = await addIsoEvidenceAttachment(formData);
  } else if (form.dataset.form === "voice-consent") {
    result = await addVoiceConsent(formData);
  } else if (form.dataset.form === "voice-note") {
    result = await createVoiceNoteDraft(formData);
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
  } else if (form.dataset.form === "import-preview") {
    result = await prepareImportPreview(formData);
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
