import { appointments, clients, invoices, workQueue } from "./data.js";

const initialState = {
  view: "dashboard",
  locale: "NL",
  selectedClientId: clients[0].id,
  appointmentFilter: "",
  clientFilter: "",
  aiDraft: "Kies een workflow en genereer een concept.",
  aiWorkflow: "intake",
  aiApproved: false,
  appointments,
  clients,
  invoices,
  workQueue
};

let state = { ...initialState };
const subscribers = new Set();

export function getState() {
  return state;
}

export function setState(partialState) {
  state = { ...state, ...partialState };
  subscribers.forEach((subscriber) => subscriber(state));
}

export function subscribe(subscriber) {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}
