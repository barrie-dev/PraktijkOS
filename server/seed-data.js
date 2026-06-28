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
  waitlist: [
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
      clientId: "cl-002",
      client: "Olivier Peeters",
      request: "Extra sessie rond werkdruk",
      priority: "Normaal",
      preferred: "Woensdagnamiddag",
      type: "Opvolggesprek",
      addedAt: "Gisteren"
    }
  ],
  workQueue: [
    {
      id: "q-001",
      label: "Sessienota structureren",
      description: "Olivier heeft een conceptnota klaarstaan. Controleer, keur goed en sla op in het dossier.",
      owner: "AI Copilot",
      priority: "Normaal",
      status: "Open",
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
      status: "Open",
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
      status: "Open",
      clientId: "cl-001",
      dueAt: "Morgen",
      category: "Dossier",
      action: "letter"
    }
  ],
  dayClose: [
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
