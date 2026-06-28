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

export const waitlist = [
  {
    id: "wait-001",
    clientId: "cl-001",
    client: "Mila Verbeeck",
    request: "Vervroegde opvolgafspraak",
    priority: "Hoog",
    preferred: "Dinsdagavond of online",
    type: "Opvolggesprek",
    addedAt: "Vandaag"
  },
  {
    id: "wait-002",
    clientId: "cl-004",
    client: "Noah Lambert",
    request: "Snellere revalidatiecontrole",
    priority: "Normaal",
    preferred: "Vrijdagvoormiddag",
    type: "Kinesitherapie",
    addedAt: "Gisteren"
  }
];

export const workQueue = [
  {
    id: "q-001",
    label: "Sessienota structureren",
    description: "Olivier heeft een conceptnota klaarstaan. Controleer, keur goed en sla op in het dossier.",
    owner: "AI Copilot",
    priority: "Normaal",
    clientId: "cl-002",
    dueAt: "Vandaag",
    category: "Dossier",
    action: "ai-note"
  },
  {
    id: "q-002",
    label: "Factuurvoorstellen controleren",
    description: "Controleer de voorstellen na afgeronde afspraken en zet ze klaar voor betaling.",
    owner: "Secretariaat",
    priority: "Hoog",
    dueAt: "Vandaag",
    category: "Facturatie",
    action: "billing"
  },
  {
    id: "q-003",
    label: "Doorverwijsbrief voorbereiden",
    description: "Maak een briefconcept voor verdere opvolging en laat de zorgverlener reviewen.",
    owner: "L. Janssens",
    priority: "Normaal",
    clientId: "cl-001",
    dueAt: "Morgen",
    category: "Dossier",
    action: "letter"
  },
  {
    id: "q-004",
    label: "No-show reminders verzenden",
    description: "Stuur een duidelijke bevestiging met annulatiebeleid naar risicodossiers.",
    owner: "Secretariaat",
    priority: "Hoog",
    clientId: "cl-004",
    dueAt: "Vandaag",
    category: "Opvolging",
    action: "message"
  }
];

export const dayClose = [
  {
    id: "dc-001",
    label: "Afsprakenstatussen nagekeken",
    detail: "Controleer aanwezig, no-show en klaar voor facturatie voordat de dag dichtgaat.",
    category: "Planning",
    action: "agenda",
    status: "Open"
  },
  {
    id: "dc-002",
    label: "Facturatievoorstellen klaargezet",
    detail: "Maak voorstellen voor billable afspraken en markeer ontvangen betalingen.",
    category: "Facturatie",
    action: "billing",
    status: "Open"
  },
  {
    id: "dc-003",
    label: "Concepten en documenten gereviewd",
    detail: "Laat geen AI-concepten, nota's of documenten zonder professionele review achter.",
    category: "Dossier",
    action: "ai",
    status: "Open"
  },
  {
    id: "dc-004",
    label: "Opvolging voor morgen klaar",
    detail: "Werk open taken en wachtlijstsignalen bij zodat morgen helder start.",
    category: "Praktijk",
    action: "work",
    status: "Open"
  }
];
