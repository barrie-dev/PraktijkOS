import {
  approveDraft,
  completeTask as completeTaskRequest,
  createAppointment,
  createClient,
  createDocument,
  createIntake,
  createInvoice,
  createMessage,
  createNote,
  createPortalInvite,
  createTeamMember,
  createDraft,
  exportClient,
  fetchApiState,
  fetchSession,
  generateAiDraft,
  generateBillingProposals,
  login,
  logout,
  sendInvoiceReminder,
  updateAppointment,
  updateDocument,
  updateInvoice,
  updateMessage,
  updatePortalInvite,
  updatePractice
} from "./api.js";
import { generateDraft } from "./ai.js";
import { appointments, clients, invoices, workQueue } from "./data.js";

const STORAGE_KEY = "praktijkos.state.v1";

const initialState = {
  view: "dashboard",
  locale: "NL",
  apiStatus: "local",
  authStatus: "checking",
  currentUser: null,
  loginError: "",
  isLoading: false,
  selectedClientId: clients[0].id,
  appointmentFilter: "",
  clientFilter: "",
  modal: null,
  aiDraft: "Kies een workflow en genereer een concept.",
  aiSource: "",
  aiWorkflow: "intake",
  aiApproved: false,
  currentDraftId: null,
  analytics: {
    occupancyRate: 0,
    noShowRisk: 0,
    paidRevenue: 0,
    openRevenue: 0,
    adminBacklog: 0,
    activePortalAccesses: 0,
    billableAppointments: 0
  },
  practice: {
    name: "Groepspraktijk De Linde",
    language: "NL",
    locations: ["Antwerpen", "Online"],
    paymentMethods: ["Bancontact", "Wero", "Overschrijving"],
    aiPolicy: "Concepten vereisen professionele review voor opslag of verzending.",
    onboardingComplete: false
  },
  team: [
    { id: "usr-001", name: "L. Janssens", role: "Praktijkhouder", access: "Volledig" },
    { id: "usr-002", name: "N. Dubois", role: "Zorgverlener", access: "Eigen dossiers" }
  ],
  intakes: [
    {
      id: "int-001",
      clientId: "cl-001",
      client: "Mila Verbeeck",
      status: "Onvolledig",
      submittedAt: null,
      answers: {
        hulpvraag: "Stressklachten en slecht slapen.",
        voorkeur: "Dinsdagavond",
        voorgeschiedenis: "Nog aan te vullen"
      }
    }
  ],
  messages: [
    {
      id: "msg-001",
      clientId: "cl-001",
      client: "Mila Verbeeck",
      subject: "Intake aanvullen",
      body: "Kan je de ontbrekende voorgeschiedenis nog aanvullen voor je afspraak?",
      status: "Concept",
      channel: "Client portal"
    }
  ],
  portalInvites: [],
  notes: [],
  documents: [
    {
      id: "doc-001",
      clientId: "cl-002",
      client: "Olivier Peeters",
      title: "Sessienota concept",
      type: "Nota",
      status: "Review nodig"
    }
  ],
  appointments,
  clients,
  invoices,
  workQueue,
  auditLog: [
    {
      id: "audit-001",
      at: "Vandaag 08:12",
      actor: "System",
      event: "Demo praktijk geladen",
      detail: "Startdata voor agenda, clienten en facturatie beschikbaar."
    }
  ],
  aiDrafts: []
};

let state = hydrate();
const subscribers = new Set();

function hydrate() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...initialState };
    return { ...initialState, ...JSON.parse(stored), modal: null, isLoading: false };
  } catch {
    return { ...initialState };
  }
}

function persist(nextState) {
  const { modal, isLoading, ...persistable } = nextState;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function nowLabel() {
  return new Intl.DateTimeFormat("nl-BE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

function commit(nextState) {
  state = nextState;
  persist(state);
  subscribers.forEach((subscriber) => subscriber(state));
}

function pushAudit(nextState, event, detail, actor = "PraktijkOS") {
  return {
    ...nextState,
    auditLog: [
      {
        id: uid("audit"),
        at: nowLabel(),
        actor,
        event,
        detail
      },
      ...nextState.auditLog
    ].slice(0, 30)
  };
}

function formPayload(formData) {
  return Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value).trim()]));
}

function mergeServerState(serverState) {
  return {
    ...state,
    ...serverState,
    apiStatus: "connected",
    authStatus: "authenticated",
    isLoading: false,
    modal: null,
    selectedClientId: serverState.clients?.[0]?.id || state.selectedClientId
  };
}

async function refreshFromApi() {
  const serverState = await fetchApiState();
  commit(mergeServerState(serverState));
}

export async function bootstrapState() {
  setState({ isLoading: true });
  try {
    const session = await fetchSession();
    setState({ authStatus: "authenticated", currentUser: session.user, loginError: "" });
    await refreshFromApi();
  } catch {
    setState({ apiStatus: "local", authStatus: "unauthenticated", currentUser: null, isLoading: false });
  }
}

export async function loginUser(formData) {
  const payload = formPayload(formData);
  try {
    const result = await login(payload);
    setState({ authStatus: "authenticated", currentUser: result.user, loginError: "", isLoading: true });
    await refreshFromApi();
    return { ok: true, message: "Welkom." };
  } catch (error) {
    setState({ authStatus: "unauthenticated", currentUser: null, loginError: error.message || "Aanmelden mislukt.", isLoading: false });
    return { ok: false, message: "Aanmelden mislukt." };
  }
}

export async function logoutUser() {
  try {
    await logout();
  } finally {
    setState({ authStatus: "unauthenticated", currentUser: null, apiStatus: "local" });
  }
  return { ok: true, message: "Afgemeld." };
}

export function getState() {
  return state;
}

export function setState(partialState) {
  commit({ ...state, ...partialState });
}

export function openModal(modal) {
  setState({ modal });
}

export function closeModal() {
  setState({ modal: null });
}

export async function addClient(formData) {
  const payload = formPayload(formData);
  const name = payload.name;
  const track = payload.track;
  const clinician = payload.clinician;

  if (!name || !track || !clinician) {
    return { ok: false, message: "Naam, traject en zorgverlener zijn verplicht." };
  }

  if (state.apiStatus === "connected") {
    try {
      const client = await createClient(payload);
      await refreshFromApi();
      setState({ selectedClientId: client.id, view: "clients" });
      return { ok: true, message: "Client aangemaakt." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  const client = {
    id: uid("cl"),
    name,
    age: Number(payload.age || 0),
    track,
    status: payload.status || "Intakefase",
    clinician,
    nextAppointment: "Nog niet gepland",
    adminStatus: "Nieuwe client - intake klaar te zetten",
    aiSuggestion: "Maak een intakevoorstel en plan eerste afspraak."
  };

  commit(pushAudit(
    {
      ...state,
      clients: [client, ...state.clients],
      selectedClientId: client.id,
      clientFilter: "",
      modal: null,
      view: "clients"
    },
    "Client aangemaakt",
    `${client.name} toegevoegd aan ${client.track}.`
  ));
  return { ok: true, message: "Client lokaal aangemaakt." };
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function localClientExport(clientId) {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) return null;
  return {
    exportedAt: new Date().toISOString(),
    exportedBy: state.currentUser,
    practice: state.practice,
    client,
    records: {
      appointments: state.appointments.filter((item) => item.clientId === client.id),
      intakes: state.intakes.filter((item) => item.clientId === client.id),
      notes: (state.notes || []).filter((item) => item.clientId === client.id),
      messages: state.messages.filter((item) => item.clientId === client.id),
      documents: state.documents.filter((item) => item.clientId === client.id),
      invoices: state.invoices.filter((item) => item.clientId === client.id || item.client === client.name),
      portalInvites: (state.portalInvites || []).filter((item) => item.clientId === client.id).map(({ token, ...invite }) => invite)
    },
    audit: state.auditLog.filter((item) => `${item.detail || ""} ${item.event || ""}`.includes(client.name))
  };
}

export async function downloadClientDossier(clientId) {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) {
    return { ok: false, message: "Client niet gevonden." };
  }

  if (state.apiStatus === "connected") {
    try {
      const payload = await exportClient(clientId);
      downloadJson(`${client.name.replaceAll(" ", "-").toLowerCase()}-dossier.json`, payload);
      await refreshFromApi();
      return { ok: true, message: "Dossierexport aangemaakt." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  const payload = localClientExport(clientId);
  downloadJson(`${client.name.replaceAll(" ", "-").toLowerCase()}-dossier.json`, payload);
  return { ok: true, message: "Lokale dossierexport aangemaakt." };
}

export async function addAppointment(formData) {
  const payload = formPayload(formData);
  const client = state.clients.find((item) => item.id === payload.clientId);

  if (!client || !payload.time || !payload.type || !payload.clinician) {
    return { ok: false, message: "Client, tijd, type en zorgverlener zijn verplicht." };
  }

  if (state.apiStatus === "connected") {
    try {
      await createAppointment(payload);
      await refreshFromApi();
      setState({ view: "agenda" });
      return { ok: true, message: "Afspraak gepland." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  const appointment = {
    id: uid("apt"),
    time: payload.time,
    clientId: payload.clientId,
    client: client.name,
    type: payload.type,
    clinician: payload.clinician,
    location: payload.location || "Praktijk",
    status: "Nieuw",
    signal: "success",
    aiHint: "Controleer intake, betaalvoorkeur en reminderregels."
  };

  const updatedClients = state.clients.map((item) =>
    item.id === payload.clientId
      ? { ...item, nextAppointment: `Vandaag ${payload.time}`, adminStatus: "Afspraak gepland" }
      : item
  );

  commit(pushAudit(
    {
      ...state,
      appointments: [...state.appointments, appointment].sort((a, b) => a.time.localeCompare(b.time)),
      clients: updatedClients,
      appointmentFilter: "",
      modal: null,
      view: "agenda"
    },
    "Afspraak gepland",
    `${appointment.client} om ${appointment.time} bij ${appointment.clinician}.`
  ));
  return { ok: true, message: "Afspraak lokaal gepland." };
}

function appointmentSignal(status) {
  if (["No-show risico", "Geannuleerd"].includes(status)) return "danger";
  if (["Intake ontbreekt", "Opvolging nodig"].includes(status)) return "warning";
  return "success";
}

export async function changeAppointmentStatus(appointmentId, status) {
  const appointment = state.appointments.find((item) => item.id === appointmentId);
  if (!appointment || !status) {
    return { ok: false, message: "Afspraakstatus kon niet worden bijgewerkt." };
  }

  if (state.apiStatus === "connected") {
    try {
      await updateAppointment(appointmentId, { status });
      await refreshFromApi();
      return { ok: true, message: "Afspraakstatus bijgewerkt." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  const updatedAppointment = { ...appointment, status, signal: appointmentSignal(status) };
  commit(pushAudit(
    {
      ...state,
      appointments: state.appointments.map((item) => item.id === appointmentId ? updatedAppointment : item),
      clients: state.clients.map((client) =>
        client.id === appointment.clientId
          ? { ...client, adminStatus: `Afspraakstatus: ${status}`, nextAppointment: `${appointment.time} / ${appointment.type}` }
          : client
      )
    },
    "Afspraakstatus bijgewerkt",
    `${appointment.client}: ${status}.`
  ));
  return { ok: true, message: "Afspraakstatus lokaal bijgewerkt." };
}

export async function recordDraft({ workflow, source, output }) {
  if (state.apiStatus === "connected") {
    try {
      const draft = await createDraft({ workflow, source, output });
      await refreshFromApi();
      setState({ aiDraft: output, aiApproved: false, currentDraftId: draft.id });
      return;
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  const draft = {
    id: uid("draft"),
    workflow,
    source,
    output,
    status: "Concept",
    createdAt: nowLabel(),
    approvedAt: null
  };

  commit(pushAudit(
    {
      ...state,
      aiDraft: output,
      aiApproved: false,
      currentDraftId: draft.id,
      aiDrafts: [draft, ...state.aiDrafts].slice(0, 20)
    },
    "AI concept gegenereerd",
    `${workflow} concept staat klaar voor review.`,
    "AI Copilot"
  ));
}

export async function runAiWorkflow(source) {
  const workflow = state.aiWorkflow;

  if (state.apiStatus === "connected") {
    try {
      const draft = await generateAiDraft({ workflow, source });
      await refreshFromApi();
      setState({ aiDraft: draft.output, aiApproved: false, currentDraftId: draft.id });
      return { ok: true, message: "AI concept gegenereerd. Review blijft verplicht." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  const output = generateDraft({ workflow, input: source });
  await recordDraft({ workflow, source, output });
  return { ok: true, message: "AI concept lokaal gegenereerd. Review blijft verplicht." };
}

export async function approveCurrentDraft() {
  if (!state.currentDraftId || !state.aiApproved) {
    return { ok: false, message: "Vink eerst professionele review aan." };
  }

  const currentDraft = state.aiDrafts.find((draft) => draft.id === state.currentDraftId);
  const selectedClient = state.clients.find((client) => client.id === state.selectedClientId);
  const shouldStoreNote = currentDraft?.workflow === "note" && selectedClient;

  if (state.apiStatus === "connected") {
    try {
      const approvedDraft = await approveDraft(state.currentDraftId, {
        clientId: selectedClient?.id,
        storeAsNote: shouldStoreNote
      });
      await refreshFromApi();
      return {
        ok: true,
        message: approvedDraft.savedNoteId ? "Concept goedgekeurd en als nota opgeslagen." : "Concept goedgekeurd."
      };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  const updatedDrafts = state.aiDrafts.map((draft) =>
    draft.id === state.currentDraftId
      ? { ...draft, status: "Goedgekeurd", approvedAt: nowLabel() }
      : draft
  );
  const savedNote = shouldStoreNote ? {
    id: uid("note"),
    clientId: selectedClient.id,
    client: selectedClient.name,
    title: "AI sessienota",
    body: currentDraft.output,
    status: "Afgewerkt",
    author: state.currentUser?.name || "PraktijkOS",
    createdAt: nowLabel(),
    sourceDraftId: currentDraft.id
  } : null;

  commit(pushAudit(
    {
      ...state,
      aiDrafts: updatedDrafts,
      notes: savedNote ? [savedNote, ...(state.notes || [])] : state.notes
    },
    "AI concept goedgekeurd",
    savedNote ? `${selectedClient.name}: AI nota opgeslagen in dossier.` : "Professionele review bevestigd en audit-event vastgelegd."
  ));
  return {
    ok: true,
    message: savedNote ? "Concept lokaal goedgekeurd en als nota opgeslagen." : "Concept lokaal goedgekeurd en gelogd."
  };
}

export async function createInvoiceProposals() {
  if (state.apiStatus === "connected") {
    try {
      const result = await generateBillingProposals();
      await refreshFromApi();
      return { ok: true, message: `${result.created} factuurvoorstellen gegenereerd.` };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  return { ok: true, message: "Factuurvoorstellen staan klaar zodra de opslag opnieuw verbonden is." };
}

export async function addInvoice(formData) {
  const payload = formPayload(formData);
  const client = state.clients.find((item) => item.id === payload.clientId);
  const amount = Number(payload.amount || 0);

  if (!client || amount <= 0) {
    return { ok: false, message: "Client en positief bedrag zijn verplicht." };
  }

  if (state.apiStatus === "connected") {
    try {
      await createInvoice({ ...payload, amount });
      await refreshFromApi();
      setState({ view: "billing" });
      return { ok: true, message: "Factuur aangemaakt." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  const invoice = {
    id: uid("inv"),
    clientId: client.id,
    appointmentId: payload.appointmentId || null,
    client: client.name,
    amount,
    channel: payload.channel || "Bancontact",
    status: payload.status || "Voorstel",
    issuedAt: nowLabel(),
    dueAt: payload.dueAt || "",
    paidAt: null,
    reminderSentAt: null
  };

  commit(pushAudit(
    { ...state, invoices: [invoice, ...state.invoices], view: "billing" },
    "Factuur aangemaakt",
    `${invoice.client} lokaal gefactureerd.`
  ));
  return { ok: true, message: "Factuur lokaal aangemaakt." };
}

export async function markInvoicePaid(invoiceId) {
  if (state.apiStatus === "connected") {
    try {
      await updateInvoice(invoiceId, { status: "Betaald" });
      await refreshFromApi();
      return { ok: true, message: "Factuur gemarkeerd als betaald." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  const invoice = state.invoices.find((item) => item.id === invoiceId);
  setState({
    invoices: state.invoices.map((item) => item.id === invoiceId ? { ...item, status: "Betaald", paidAt: nowLabel() } : item)
  });
  commit(pushAudit(getState(), "Factuur betaald", `${invoice?.client || invoiceId} lokaal gemarkeerd als betaald.`));
  return { ok: true, message: "Factuur lokaal betaald." };
}

export async function remindInvoice(invoiceId) {
  if (state.apiStatus === "connected") {
    try {
      await sendInvoiceReminder(invoiceId);
      await refreshFromApi();
      return { ok: true, message: "Herinnering klaargezet." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  const invoice = state.invoices.find((item) => item.id === invoiceId);
  setState({
    invoices: state.invoices.map((item) => item.id === invoiceId ? { ...item, status: "Herinnering", reminderSentAt: nowLabel() } : item)
  });
  commit(pushAudit(getState(), "Betalingsherinnering klaargezet", `${invoice?.client || invoiceId} lokaal herinnerd.`));
  return { ok: true, message: "Herinnering lokaal klaargezet." };
}

export async function changeInvoiceChannel(invoiceId, channel) {
  if (state.apiStatus === "connected") {
    try {
      await updateInvoice(invoiceId, { channel });
      await refreshFromApi();
      return { ok: true, message: "Betaalmethode bijgewerkt." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  setState({
    invoices: state.invoices.map((item) => item.id === invoiceId ? { ...item, channel } : item)
  });
  return { ok: true, message: "Betaalmethode lokaal bijgewerkt." };
}

export async function completeTask(taskId) {
  if (state.apiStatus === "connected") {
    try {
      await completeTaskRequest(taskId);
      await refreshFromApi();
      return { ok: true, message: "Taak afgewerkt." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  setState({
    workQueue: state.workQueue.map((task) => task.id === taskId ? { ...task, status: "Klaar" } : task)
  });
  return { ok: true, message: "Taak lokaal afgewerkt." };
}

export async function savePracticeSettings(formData) {
  const payload = formPayload(formData);
  const practice = {
    ...state.practice,
    name: payload.name,
    language: payload.language,
    locations: payload.locations.split(",").map((item) => item.trim()).filter(Boolean),
    paymentMethods: payload.paymentMethods.split(",").map((item) => item.trim()).filter(Boolean),
    aiPolicy: payload.aiPolicy,
    onboardingComplete: state.practice.onboardingComplete
  };

  if (state.apiStatus === "connected") {
    try {
      await updatePractice(practice);
      await refreshFromApi();
      return { ok: true, message: "Praktijkinstellingen opgeslagen." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  commit(pushAudit(
    { ...state, practice },
    "Praktijkinstellingen bijgewerkt",
    `${practice.name} lokaal opgeslagen.`
  ));
  return { ok: true, message: "Praktijkinstellingen lokaal opgeslagen." };
}

export async function completeOnboarding(formData) {
  const payload = formPayload(formData);
  const practice = {
    ...state.practice,
    name: payload.name,
    language: payload.language,
    locations: payload.locations.split(",").map((item) => item.trim()).filter(Boolean),
    paymentMethods: payload.paymentMethods.split(",").map((item) => item.trim()).filter(Boolean),
    aiPolicy: payload.aiPolicy,
    onboardingComplete: true
  };

  if (state.apiStatus === "connected") {
    try {
      await updatePractice(practice);
      await refreshFromApi();
      return { ok: true, message: "Praktijk is ingesteld." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  commit(pushAudit(
    { ...state, practice },
    "Praktijk ingesteld",
    `${practice.name} is klaar voor gebruik.`
  ));
  return { ok: true, message: "Praktijk is lokaal ingesteld." };
}

export async function addTeamMember(formData) {
  const payload = formPayload(formData);
  if (!payload.name || !payload.role) {
    return { ok: false, message: "Naam en rol zijn verplicht." };
  }

  if (state.apiStatus === "connected") {
    try {
      await createTeamMember(payload);
      await refreshFromApi();
      return { ok: true, message: "Teamlid toegevoegd." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  const member = {
    id: uid("usr"),
    name: payload.name,
    role: payload.role,
    access: payload.access || "Eigen dossiers"
  };

  commit(pushAudit(
    { ...state, team: [member, ...state.team] },
    "Teamlid toegevoegd",
    `${member.name} lokaal toegevoegd.`
  ));
  return { ok: true, message: "Teamlid lokaal toegevoegd." };
}

export async function addIntake(formData) {
  const payload = formPayload(formData);
  const client = state.clients.find((item) => item.id === payload.clientId);
  if (!client || !payload.hulpvraag) {
    return { ok: false, message: "Client en hulpvraag zijn verplicht." };
  }

  if (state.apiStatus === "connected") {
    try {
      await createIntake(payload);
      await refreshFromApi();
      return { ok: true, message: "Intake opgeslagen." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  const intake = {
    id: uid("int"),
    clientId: client.id,
    client: client.name,
    status: "Ingediend",
    submittedAt: nowLabel(),
    answers: {
      hulpvraag: payload.hulpvraag,
      voorkeur: payload.voorkeur || "",
      voorgeschiedenis: payload.voorgeschiedenis || ""
    }
  };

  commit(pushAudit(
    { ...state, intakes: [intake, ...state.intakes] },
    "Intake ontvangen",
    `${intake.client} intake lokaal opgeslagen.`
  ));
  return { ok: true, message: "Intake lokaal opgeslagen." };
}

export async function addMessage(formData) {
  const payload = formPayload(formData);
  const client = state.clients.find((item) => item.id === payload.clientId);
  if (!client || !payload.subject || !payload.body) {
    return { ok: false, message: "Client, onderwerp en bericht zijn verplicht." };
  }

  if (state.apiStatus === "connected") {
    try {
      await createMessage(payload);
      await refreshFromApi();
      return { ok: true, message: "Bericht aangemaakt." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  const message = {
    id: uid("msg"),
    clientId: client.id,
    client: client.name,
    subject: payload.subject,
    body: payload.body,
    status: payload.status || "Concept",
    channel: payload.channel || "Client portal"
  };

  commit(pushAudit(
    { ...state, messages: [message, ...state.messages] },
    "Bericht aangemaakt",
    `${message.subject} lokaal aangemaakt.`
  ));
  return { ok: true, message: "Bericht lokaal aangemaakt." };
}

export async function changeMessageStatus(messageId, status) {
  const message = state.messages.find((item) => item.id === messageId);
  if (!message || !status) {
    return { ok: false, message: "Berichtstatus kon niet worden bijgewerkt." };
  }

  if (state.apiStatus === "connected") {
    try {
      await updateMessage(messageId, { status });
      await refreshFromApi();
      return { ok: true, message: "Berichtstatus bijgewerkt." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  commit(pushAudit(
    {
      ...state,
      messages: state.messages.map((item) => item.id === messageId ? { ...item, status } : item)
    },
    "Berichtstatus bijgewerkt",
    `${message.subject}: ${status}.`
  ));
  return { ok: true, message: "Berichtstatus lokaal bijgewerkt." };
}

export async function addPortalInvite(formData) {
  const payload = formPayload(formData);
  const client = state.clients.find((item) => item.id === payload.clientId);
  if (!client) {
    return { ok: false, message: "Client is verplicht." };
  }

  if (state.apiStatus === "connected") {
    try {
      await createPortalInvite(payload);
      await refreshFromApi();
      return { ok: true, message: "Portaaltoegang aangemaakt." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  const token = uid("portal");
  const invite = {
    id: uid("portal"),
    token,
    clientId: client.id,
    client: client.name,
    status: "Actief",
    createdAt: nowLabel(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 14,
    createdBy: state.currentUser?.name || "PraktijkOS",
    portalUrl: `/portal.html?token=${token}`
  };

  commit(pushAudit(
    { ...state, portalInvites: [invite, ...state.portalInvites] },
    "Portaaltoegang aangemaakt",
    `${client.name} lokaal klaargezet.`
  ));
  return { ok: true, message: "Portaaltoegang lokaal aangemaakt." };
}

export async function changePortalInviteStatus(inviteId, status) {
  const invite = state.portalInvites.find((item) => item.id === inviteId);
  if (!invite) {
    return { ok: false, message: "Portaaltoegang niet gevonden." };
  }

  if (state.apiStatus === "connected") {
    try {
      await updatePortalInvite(inviteId, { status });
      await refreshFromApi();
      return { ok: true, message: "Portaaltoegang bijgewerkt." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  commit(pushAudit(
    {
      ...state,
      portalInvites: state.portalInvites.map((item) => item.id === inviteId ? { ...item, status } : item)
    },
    "Portaaltoegang bijgewerkt",
    `${invite.client}: ${status}.`
  ));
  return { ok: true, message: "Portaaltoegang lokaal bijgewerkt." };
}

export async function addDocument(formData) {
  const payload = formPayload(formData);
  const client = state.clients.find((item) => item.id === payload.clientId);
  if (!client || !payload.title || !payload.type) {
    return { ok: false, message: "Client, titel en type zijn verplicht." };
  }

  if (state.apiStatus === "connected") {
    try {
      await createDocument(payload);
      await refreshFromApi();
      return { ok: true, message: "Document aangemaakt." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  const document = {
    id: uid("doc"),
    clientId: client.id,
    client: client.name,
    title: payload.title,
    type: payload.type,
    status: payload.status || "Review nodig"
  };

  commit(pushAudit(
    { ...state, documents: [document, ...state.documents] },
    "Document aangemaakt",
    `${document.title} lokaal aangemaakt.`
  ));
  return { ok: true, message: "Document lokaal aangemaakt." };
}

export async function changeDocumentStatus(documentId, status) {
  const document = state.documents.find((item) => item.id === documentId);
  if (!document || !status) {
    return { ok: false, message: "Documentstatus kon niet worden bijgewerkt." };
  }

  if (state.apiStatus === "connected") {
    try {
      await updateDocument(documentId, { status });
      await refreshFromApi();
      return { ok: true, message: "Documentstatus bijgewerkt." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  commit(pushAudit(
    {
      ...state,
      documents: state.documents.map((item) => item.id === documentId ? { ...item, status } : item)
    },
    "Documentstatus bijgewerkt",
    `${document.title}: ${status}.`
  ));
  return { ok: true, message: "Documentstatus lokaal bijgewerkt." };
}

export async function addNote(formData) {
  const payload = formPayload(formData);
  const client = state.clients.find((item) => item.id === payload.clientId);
  if (!client || !payload.title || !payload.body) {
    return { ok: false, message: "Client, titel en nota zijn verplicht." };
  }

  if (state.apiStatus === "connected") {
    try {
      await createNote(payload);
      await refreshFromApi();
      setState({ selectedClientId: client.id, view: "clients" });
      return { ok: true, message: "Sessienota opgeslagen." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  const note = {
    id: uid("note"),
    clientId: client.id,
    client: client.name,
    title: payload.title,
    body: payload.body,
    author: state.currentUser?.name || "Zorgverlener",
    status: payload.status || "Concept",
    createdAt: nowLabel()
  };

  commit(pushAudit(
    { ...state, notes: [note, ...state.notes], selectedClientId: client.id, view: "clients" },
    "Sessienota aangemaakt",
    `${note.title} lokaal aangemaakt.`
  ));
  return { ok: true, message: "Sessienota lokaal opgeslagen." };
}

export function resetDemoState() {
  window.localStorage.removeItem(STORAGE_KEY);
  commit({ ...initialState });
}

export function subscribe(subscriber) {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}
