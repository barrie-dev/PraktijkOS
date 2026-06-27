import { appointments, clients, invoices, workQueue } from "./data.js";

const STORAGE_KEY = "praktijkos.state.v1";

const initialState = {
  view: "dashboard",
  locale: "NL",
  selectedClientId: clients[0].id,
  appointmentFilter: "",
  clientFilter: "",
  modal: null,
  aiDraft: "Kies een workflow en genereer een concept.",
  aiWorkflow: "intake",
  aiApproved: false,
  currentDraftId: null,
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
    return { ...initialState, ...JSON.parse(stored), modal: null };
  } catch {
    return { ...initialState };
  }
}

function persist(nextState) {
  const { modal, ...persistable } = nextState;
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

function commit(nextState) {
  state = nextState;
  persist(state);
  subscribers.forEach((subscriber) => subscriber(state));
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

export function addClient(formData) {
  const name = String(formData.get("name") || "").trim();
  const track = String(formData.get("track") || "").trim();
  const clinician = String(formData.get("clinician") || "").trim();

  if (!name || !track || !clinician) {
    return { ok: false, message: "Naam, traject en zorgverlener zijn verplicht." };
  }

  const client = {
    id: uid("cl"),
    name,
    age: Number(formData.get("age") || 0),
    track,
    status: String(formData.get("status") || "Intakefase"),
    clinician,
    nextAppointment: "Nog niet gepland",
    adminStatus: "Nieuwe client - intake klaar te zetten",
    aiSuggestion: "Maak een intakevoorstel en plan eerste afspraak."
  };

  const next = pushAudit(
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
  );

  commit(next);
  return { ok: true, message: "Client aangemaakt." };
}

export function addAppointment(formData) {
  const clientId = String(formData.get("clientId") || "");
  const client = state.clients.find((item) => item.id === clientId);
  const time = String(formData.get("time") || "").trim();
  const type = String(formData.get("type") || "").trim();
  const clinician = String(formData.get("clinician") || "").trim();
  const location = String(formData.get("location") || "").trim();

  if (!client || !time || !type || !clinician) {
    return { ok: false, message: "Client, tijd, type en zorgverlener zijn verplicht." };
  }

  const appointment = {
    id: uid("apt"),
    time,
    clientId,
    client: client.name,
    type,
    clinician,
    location: location || "Praktijk",
    status: "Nieuw",
    signal: "success",
    aiHint: "Controleer intake, betaalvoorkeur en reminderregels."
  };

  const updatedClients = state.clients.map((item) =>
    item.id === clientId
      ? { ...item, nextAppointment: `Vandaag ${time}`, adminStatus: "Afspraak gepland" }
      : item
  );

  const next = pushAudit(
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
  );

  commit(next);
  return { ok: true, message: "Afspraak gepland." };
}

export function recordDraft({ workflow, source, output }) {
  const draft = {
    id: uid("draft"),
    workflow,
    source,
    output,
    status: "Concept",
    createdAt: nowLabel(),
    approvedAt: null
  };

  const next = pushAudit(
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
  );

  commit(next);
}

export function approveCurrentDraft() {
  if (!state.currentDraftId || !state.aiApproved) {
    return { ok: false, message: "Vink eerst professionele review aan." };
  }

  const updatedDrafts = state.aiDrafts.map((draft) =>
    draft.id === state.currentDraftId
      ? { ...draft, status: "Goedgekeurd", approvedAt: nowLabel() }
      : draft
  );

  const next = pushAudit(
    {
      ...state,
      aiDrafts: updatedDrafts
    },
    "AI concept goedgekeurd",
    "Professionele review bevestigd en audit-event vastgelegd."
  );

  commit(next);
  return { ok: true, message: "Concept goedgekeurd en gelogd." };
}

export function resetDemoState() {
  window.localStorage.removeItem(STORAGE_KEY);
  commit({ ...initialState });
}

export function subscribe(subscriber) {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}
