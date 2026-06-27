export const appointments = [
  {
    id: "apt-001",
    time: "08:30",
    clientId: "cl-001",
    client: "Mila Verbeeck",
    type: "Intake psychologische begeleiding",
    clinician: "L. Janssens",
    location: "Antwerpen",
    status: "Intake ontbreekt",
    signal: "warning",
    aiHint: "Vat het intakeformulier samen zodra het binnenkomt."
  },
  {
    id: "apt-002",
    time: "10:00",
    clientId: "cl-002",
    client: "Olivier Peeters",
    type: "Opvolggesprek",
    clinician: "N. Dubois",
    location: "Online",
    status: "Nota klaar",
    signal: "success",
    aiHint: "Conceptnota wacht op professionele review."
  },
  {
    id: "apt-003",
    time: "11:30",
    clientId: "cl-003",
    client: "Sara Maes",
    type: "Logopedie",
    clinician: "A. Willems",
    location: "Gent",
    status: "Factuurvoorstel",
    signal: "success",
    aiHint: "Prestatie werd herkend en kan gefactureerd worden."
  },
  {
    id: "apt-004",
    time: "14:00",
    clientId: "cl-004",
    client: "Noah Lambert",
    type: "Kinesitherapie",
    clinician: "M. Dierckx",
    location: "Brussel",
    status: "No-show risico",
    signal: "danger",
    aiHint: "Stuur bevestiging met duidelijk annulatiebeleid."
  }
];

export const clients = [
  {
    id: "cl-001",
    name: "Mila Verbeeck",
    age: 28,
    track: "Stress en slaapklachten",
    status: "Intakefase",
    clinician: "L. Janssens",
    nextAppointment: "Vandaag 08:30",
    adminStatus: "Intakeformulier ontbreekt",
    aiSuggestion: "Vraag ontbrekende voorgeschiedenis en voorkeursmomenten op."
  },
  {
    id: "cl-002",
    name: "Olivier Peeters",
    age: 41,
    track: "Werkgerelateerde spanning",
    status: "Actief traject",
    clinician: "N. Dubois",
    nextAppointment: "Vandaag 10:00",
    adminStatus: "Sessienota klaar voor review",
    aiSuggestion: "Controleer doelen en plan follow-up na sessie."
  },
  {
    id: "cl-003",
    name: "Sara Maes",
    age: 9,
    track: "Articulatietraject",
    status: "Actief traject",
    clinician: "A. Willems",
    nextAppointment: "Vandaag 11:30",
    adminStatus: "Factuurvoorstel klaar",
    aiSuggestion: "Zet thuisoefeningen klaar voor ouderportaal."
  },
  {
    id: "cl-004",
    name: "Noah Lambert",
    age: 34,
    track: "Revalidatie knie",
    status: "Opvolging",
    clinician: "M. Dierckx",
    nextAppointment: "Vandaag 14:00",
    adminStatus: "No-show risico",
    aiSuggestion: "Stuur extra bevestiging en vraag betaalvoorkeur."
  }
];

export const invoices = [
  { id: "inv-001", client: "Sara Maes", amount: 65, channel: "Bancontact", status: "Voorstel" },
  { id: "inv-002", client: "Olivier Peeters", amount: 75, channel: "Wero", status: "Open" },
  { id: "inv-003", client: "Groepspraktijk De Linde", amount: 1180, channel: "Peppol", status: "Klaar" },
  { id: "inv-004", client: "Emma Claes", amount: 90, channel: "Overschrijving", status: "Herinnering" }
];

export const workQueue = [
  { id: "q-001", label: "2 sessienota's structureren", owner: "AI Copilot", priority: "Normaal" },
  { id: "q-002", label: "3 factuurvoorstellen controleren", owner: "Secretariaat", priority: "Hoog" },
  { id: "q-003", label: "1 doorverwijsbrief voorbereiden", owner: "L. Janssens", priority: "Normaal" },
  { id: "q-004", label: "3 no-show reminders verzenden", owner: "Secretariaat", priority: "Hoog" }
];
