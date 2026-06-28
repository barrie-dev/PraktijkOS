import {
  approveDraft,
  completeTask as completeTaskRequest,
  createAppointment,
  createClient,
  createDocument,
  createIntake,
  createMessage,
  createNote,
  createTeamMember,
  createDraft,
  fetchApiState,
  fetchSession,
  generateBillingProposals,
  login,
  logout,
  sendInvoiceReminder,
  updateInvoice,
  updatePractice
} from "./api.js";
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

export async function approveCurrentDraft() {
  if (!state.currentDraftId || !state.aiApproved) {
    return { ok: false, message: "Vink eerst professionele review aan." };
  }

  if (state.apiStatus === "connected") {
    try {
      await approveDraft(state.currentDraftId);
      await refreshFromApi();
      return { ok: true, message: "Concept goedgekeurd." };
    } catch {
      setState({ apiStatus: "local" });
    }
  }

  const updatedDrafts = state.aiDrafts.map((draft) =>
    draft.id === state.currentDraftId
      ? { ...draft, status: "Goedgekeurd", approvedAt: nowLabel() }
      : draft
  );

  commit(pushAudit(
    {
      ...state,
      aiDrafts: updatedDrafts
    },
    "AI concept goedgekeurd",
    "Professionele review bevestigd en audit-event vastgelegd."
  ));
  return { ok: true, message: "Concept lokaal goedgekeurd en gelogd." };
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
