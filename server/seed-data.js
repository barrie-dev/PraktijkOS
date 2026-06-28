const seedData = {
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
    { id: "usr-002", name: "N. Dubois", role: "Zorgverlener", access: "Eigen dossiers" },
    { id: "usr-003", name: "Secretariaat", role: "Administratie", access: "Planning en facturatie" }
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
  notes: [
    {
      id: "note-001",
      clientId: "cl-002",
      client: "Olivier Peeters",
      title: "Sessie 2",
      body: "Besproken: werkdruk, herstelmomenten en concrete grenzen voor volgende week.",
      author: "N. Dubois",
      status: "Concept",
      createdAt: "Vandaag 10:42"
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
  appointments: [
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
    }
  ],
  clients: [
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
    }
  ],
  invoices: [
    { id: "inv-001", client: "Mila Verbeeck", amount: 75, channel: "Bancontact", status: "Voorstel" },
    { id: "inv-002", client: "Olivier Peeters", amount: 75, channel: "Wero", status: "Open" }
  ],
  workQueue: [
    { id: "q-001", label: "2 sessienota's structureren", owner: "AI Copilot", priority: "Normaal", status: "Open" },
    { id: "q-002", label: "3 factuurvoorstellen controleren", owner: "Secretariaat", priority: "Hoog", status: "Open" },
    { id: "q-003", label: "1 doorverwijsbrief voorbereiden", owner: "L. Janssens", priority: "Normaal", status: "Open" }
  ],
  aiDrafts: [],
  auditLog: [
    {
      id: "audit-001",
      at: "Vandaag 08:12",
      actor: "PraktijkOS",
      event: "Praktijk gestart",
      detail: "Startgegevens voor agenda, clienten en facturatie beschikbaar."
    }
  ]
};

module.exports = { seedData };
