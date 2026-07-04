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

export const retentionPolicies = [
  {
    id: "ret-001",
    category: "Dossier",
    label: "Actieve clientdossiers",
    scope: "Zorginhoud, sessienota's, intake en documenten",
    duration: "10 jaar na laatste clientcontact",
    reviewCadence: "Jaarlijks",
    status: "Actief",
    owner: "Praktijkhouder",
    nextReviewDue: "Volgend jaar"
  },
  {
    id: "ret-002",
    category: "Facturatie",
    label: "Facturen en betaalbewijzen",
    scope: "Boekhouding, prestaties en betaalstatus",
    duration: "7 jaar",
    reviewCadence: "Jaarlijks",
    status: "Actief",
    owner: "Administratie",
    nextReviewDue: "Volgend jaar"
  },
  {
    id: "ret-003",
    category: "Portaal",
    label: "Portaaltoegang en gedeelde documenten",
    scope: "Clientlinks, gedeelde documenten en intake-antwoorden",
    duration: "Zolang traject actief is, daarna review",
    reviewCadence: "Bij trajectafsluiting",
    status: "Actief",
    owner: "Administratie",
    nextReviewDue: "Bij trajectafsluiting"
  },
  {
    id: "ret-004",
    category: "AI",
    label: "AI-concepten en goedgekeurde output",
    scope: "Conceptnota's, brieven en auditspoor",
    duration: "Concepten periodiek opschonen; goedgekeurde output volgt dossierbeleid",
    reviewCadence: "Maandelijks",
    status: "Review nodig",
    owner: "Praktijkhouder",
    nextReviewDue: "Vandaag"
  }
];

export const knowledgeBase = [
  {
    id: "kb-001",
    category: "Communicatie",
    title: "Inhoudelijke info via clientportaal",
    content: "Gebruik het clientportaal voor zorginhoudelijke informatie. E-mail en sms blijven beperkt tot praktische afspraken.",
    status: "Actief",
    owner: "Praktijkhouder",
    version: 1,
    reviewDue: "Volgend kwartaal",
    history: []
  },
  {
    id: "kb-002",
    category: "Planning",
    title: "Annulatiebeleid",
    content: "Vermeld bij no-show risico altijd dat annuleren minstens 24 uur vooraf moet gebeuren, tenzij overmacht.",
    status: "Actief",
    owner: "Administratie",
    version: 1,
    reviewDue: "Einde maand",
    history: []
  },
  {
    id: "kb-003",
    category: "AI",
    title: "Professionele review verplicht",
    content: "AI-output is altijd concept. Een zorgverlener controleert inhoud, toon en dossiercontext voor opslag of verzending.",
    status: "Actief",
    owner: "Praktijkhouder",
    version: 1,
    reviewDue: "Maandelijks",
    history: []
  }
];

export const aiModels = [
  {
    id: "model-admin-safe",
    name: "PraktijkOS Admin Safe",
    provider: "OpenAI",
    useCase: "Administratieve concepten en portaalberichten",
    promptVersion: "admin-v1",
    riskLevel: "Laag",
    status: "Actief",
    defaultFor: ["intake", "billing"]
  },
  {
    id: "model-care-review",
    name: "PraktijkOS Care Review",
    provider: "OpenAI",
    useCase: "Sessienota's en doorverwijsbrieven met zorgverlener-review",
    promptVersion: "care-v1",
    riskLevel: "Medium",
    status: "Actief",
    defaultFor: ["note", "letter"]
  },
  {
    id: "model-research-preview",
    name: "PraktijkOS Research Preview",
    provider: "OpenAI",
    useCase: "Niet-productieve verkenning en prompttesten",
    promptVersion: "sandbox-v1",
    riskLevel: "Hoog",
    status: "Pauze",
    defaultFor: []
  }
];

export const aiModelEvaluations = [
  {
    id: "eval-001",
    modelId: "model-admin-safe",
    modelName: "PraktijkOS Admin Safe",
    score: "Goedgekeurd",
    status: "Actief voor administratie",
    reviewedAt: "Vandaag 08:45",
    reviewedBy: "Praktijkhouder",
    notes: "Geschikt voor intake- en facturatieconcepten met verplichte review."
  },
  {
    id: "eval-002",
    modelId: "model-care-review",
    modelName: "PraktijkOS Care Review",
    score: "Review nodig",
    status: "Alleen gebruiken met zorgverlenercontrole",
    reviewedAt: "Vandaag 08:50",
    reviewedBy: "Praktijkhouder",
    notes: "Output moet klinisch gecontroleerd worden voor opslag."
  }
];

export const voiceConsents = [
  {
    id: "voice-001",
    clientId: "cl-002",
    client: "Olivier Peeters",
    scope: "Sessie-audio naar conceptnota",
    status: "Actief",
    recordedAt: "Vandaag 09:50",
    recordedBy: "N. Dubois",
    expiresAt: "Einde traject"
  }
];

export const peppolPreparations = [];
export const paymentRequests = [];

export const integrationReadiness = [
  {
    id: "intg-itsme",
    name: "Itsme / eID login",
    category: "Identiteit",
    status: "Analyse",
    priority: "Hoog",
    owner: "Praktijkhouder",
    targetSegment: "Groepspraktijken met clientportaal",
    value: "Sterke clientauthenticatie voor portaaltoegang en gevoelige documenten.",
    decision: "Partnerselectie en technische discovery voorbereiden.",
    nextStep: "Bevestig doelgroep, toestemmingsflow en vendorvereisten.",
    reviewedAt: null,
    reviewedBy: null,
    controls: [
      { label: "OIDC/SAML ondersteuning bij vendor", status: "Open" },
      { label: "eIDAS en Belgische identiteitsdekking", status: "Open" },
      { label: "Fallback voor minder digitale clienten", status: "Open" }
    ],
    risks: ["Vendor onboarding kan lang duren", "Portaalflow moet toegankelijk blijven"]
  },
  {
    id: "intg-ehealth",
    name: "eHealth / CoBRHA",
    category: "Zorgnetwerk",
    status: "Discovery",
    priority: "Medium",
    owner: "Praktijkhouder",
    targetSegment: "Disciplines die eHealth-diensten nodig hebben",
    value: "Controleer zorgverlenercontext, organisatiegegevens en mogelijke aansluiting op Belgische zorgdiensten.",
    decision: "Niet standaard bouwen tot doelgroep en erkenningspad bevestigd zijn.",
    nextStep: "Map discipline, erkenningsnummer en toegangsvereisten per praktijk.",
    reviewedAt: null,
    reviewedBy: null,
    controls: [
      { label: "CoBRHA organisatie-identificatie", status: "Open" },
      { label: "Zorgverlenerrol en mandaten", status: "Open" },
      { label: "Minimale dataset voor audit en logging", status: "Open" }
    ],
    risks: ["Niet elke praktijk heeft dezelfde eHealth-nood", "Regelgeving en aansluiting verschillen per discipline"]
  },
  {
    id: "intg-consent",
    name: "Digitale toestemming",
    category: "Consent",
    status: "Voorbereid",
    priority: "Hoog",
    owner: "Administratie",
    targetSegment: "Alle praktijken met portaal, AI en documentdeling",
    value: "Maak toestemmingen expliciet voor portaalgebruik, AI-concepten, transcriptie en delen.",
    decision: "Bouwen als PraktijkOS-kernfunctie voor integraties live gaan.",
    nextStep: "Koppel consentlabels aan portaal, voice-to-note en dossierexports.",
    reviewedAt: null,
    reviewedBy: null,
    controls: [
      { label: "Doel en bewaartermijn zichtbaar", status: "Open" },
      { label: "Intrekken en herzien auditeerbaar", status: "Open" },
      { label: "Consentstatus zichtbaar in dossier", status: "Open" }
    ],
    risks: ["Te brede toestemming is juridisch zwak", "Team moet status makkelijk kunnen zien"]
  }
];

export const isoEvidencePacks = [
  {
    id: "iso-access",
    domain: "A.5 / A.8 Toegangsbeheer",
    label: "Dossiertoegang en rollen",
    status: "Open",
    owner: "Praktijkhouder",
    dueAt: "Deze maand",
    summary: "Bewijs dat rollen, uitzonderingen en reviews beheerst worden.",
    sources: ["Rollenmatrix", "Access review", "Auditlog"],
    evidence: [
      { label: "Actieve rollen en toegangsrechten", status: "Open" },
      { label: "Tijdelijke dossieruitzonderingen", status: "Open" },
      { label: "Reviewmoment en verantwoordelijke", status: "Open" }
    ],
    gaps: ["Formele periodieke access review moet gepland blijven"]
  },
  {
    id: "iso-ai",
    domain: "A.5 Beleid en leveranciers",
    label: "AI governance",
    status: "Open",
    owner: "Praktijkhouder",
    dueAt: "Deze maand",
    summary: "Bewijs dat AI-output conceptueel blijft, modellen gereviewd worden en kennisregels versiebeheer hebben.",
    sources: ["AI model registry", "Kennisbank", "AI auditlog"],
    evidence: [
      { label: "Modelprofielen met risicolabel", status: "Open" },
      { label: "Modelevaluaties en reviewnotities", status: "Open" },
      { label: "Goedgekeurde AI-output met auditspoor", status: "Open" }
    ],
    gaps: ["Leveranciersbeoordeling en DPIA moeten apart aangevuld worden"]
  },
  {
    id: "iso-retention",
    domain: "A.5 / A.8 Informatielevenscyclus",
    label: "Retentie en exports",
    status: "Open",
    owner: "Administratie",
    dueAt: "Volgende reviewronde",
    summary: "Bewijs dat bewaartermijnen, exports en cleanupacties traceerbaar zijn.",
    sources: ["Retentiebeleid", "Cleanup queue", "Exportlog"],
    evidence: [
      { label: "Actieve retentiebeleidsregels", status: "Open" },
      { label: "Auditexport met filter", status: "Open" },
      { label: "Cleanupacties en reviews", status: "Open" }
    ],
    gaps: ["Definitieve bewaartermijnen per discipline juridisch bevestigen"]
  }
];

export const saasInvoices = [
  {
    id: "saas-inv-001",
    tenantId: "tenant-de-linde",
    period: "Juli 2026",
    plan: "Pro",
    amount: 149,
    dueAt: "31/07/2026",
    status: "Open",
    issuedAt: "01/07/2026",
    paidAt: null
  },
  {
    id: "saas-inv-002",
    tenantId: "tenant-de-linde",
    period: "Juni 2026",
    plan: "Pro",
    amount: 149,
    dueAt: "30/06/2026",
    status: "Betaald",
    issuedAt: "01/06/2026",
    paidAt: "15/06/2026",
    receipt: {
      status: "Beschikbaar",
      reference: "RCPT-SAAS-INV-002",
      issuedAt: "15/06/2026",
      issuedBy: "PraktijkOS",
      channel: "Abonnementsfacturatie"
    }
  }
];

export const saasUsageLedger = [
  {
    id: "usage-001",
    tenantId: "tenant-de-linde",
    period: "Juli 2026",
    category: "Seats",
    metric: "Actieve teamleden",
    used: 3,
    limit: 8,
    status: "Binnen limiet",
    impact: "Geen upgrade nodig",
    recordedAt: "30/06/2026"
  },
  {
    id: "usage-002",
    tenantId: "tenant-de-linde",
    period: "Juli 2026",
    category: "Clienten",
    metric: "Actieve dossiers",
    used: 6,
    limit: 500,
    status: "Binnen limiet",
    impact: "Ruime marge",
    recordedAt: "30/06/2026"
  },
  {
    id: "usage-003",
    tenantId: "tenant-de-linde",
    period: "Juli 2026",
    category: "AI credits",
    metric: "Administratieve AI-acties",
    used: 184,
    limit: 2000,
    status: "Binnen limiet",
    impact: "Normaal verbruik",
    recordedAt: "30/06/2026"
  },
  {
    id: "usage-004",
    tenantId: "tenant-de-linde",
    period: "Juli 2026",
    category: "Betaling",
    metric: "Abonnementfactuur",
    used: 149,
    limit: 149,
    status: "Open",
    impact: "Betaalopvolging zichtbaar in abonnementsfacturatie",
    recordedAt: "01/07/2026"
  }
];

export const saasPlanChanges = [
  {
    id: "plan-change-001",
    tenantId: "tenant-de-linde",
    currentPlan: "Pro",
    requestedPlan: "Scale",
    effectiveAt: "01/08/2026",
    reason: "Meer teamleden en extra AI credits voorzien na zomeruitbreiding.",
    status: "Aangevraagd",
    requestedAt: "30/06/2026",
    requestedBy: "Praktijkhouder"
  }
];

export const saasOnboardingChecklist = [
  {
    id: "saas-onboard-001",
    label: "Teamleden en rollen nagekeken",
    owner: "Praktijkhouder",
    status: "Klaar",
    dueAt: "30/06/2026",
    completedAt: "30/06/2026",
    completedBy: "Praktijkhouder"
  },
  {
    id: "saas-onboard-002",
    label: "Facturatie en betaalmethode bevestigd",
    owner: "Administratie",
    status: "Open",
    dueAt: "03/07/2026",
    completedAt: null,
    completedBy: null
  },
  {
    id: "saas-onboard-003",
    label: "AI policy en modelgovernance gevalideerd",
    owner: "Praktijkhouder",
    status: "Open",
    dueAt: "05/07/2026",
    completedAt: null,
    completedBy: null
  },
  {
    id: "saas-onboard-004",
    label: "Clientportaal testuitnodiging verstuurd",
    owner: "Onthaal",
    status: "Open",
    dueAt: "05/07/2026",
    completedAt: null,
    completedBy: null
  }
];

export const saasFeatureEntitlements = [
  {
    id: "entitlement-ai-copilot",
    tenantId: "tenant-de-linde",
    feature: "AI administratieve copilot",
    plan: "Pro",
    status: "Actief",
    limitLabel: "2000 AI credits/maand",
    reason: "Binnen Pro-plan en AI policy gevalideerd.",
    updatedAt: "30/06/2026",
    updatedBy: "PraktijkOS"
  },
  {
    id: "entitlement-client-portal",
    tenantId: "tenant-de-linde",
    feature: "Clientportaal",
    plan: "Pro",
    status: "Actief",
    limitLabel: "Onbeperkte portaaluitnodigingen",
    reason: "Portaalflow ingeschakeld voor communicatie en intake.",
    updatedAt: "30/06/2026",
    updatedBy: "PraktijkOS"
  },
  {
    id: "entitlement-accounting",
    tenantId: "tenant-de-linde",
    feature: "Boekhouderpakket",
    plan: "Pro",
    status: "Actief",
    limitLabel: "CSV/JSON export",
    reason: "Beschikbaar voor Pro en hoger.",
    updatedAt: "30/06/2026",
    updatedBy: "PraktijkOS"
  },
  {
    id: "entitlement-advanced-integrations",
    tenantId: "tenant-de-linde",
    feature: "Geavanceerde Belgische integraties",
    plan: "Scale",
    status: "Gepauzeerd",
    limitLabel: "Peppol, eHealth en Itsme voorbereiding",
    reason: "Wacht op planwijziging naar Scale.",
    updatedAt: "30/06/2026",
    updatedBy: "PraktijkOS"
  }
];

export const saasAdminActivity = [
  {
    id: "saas-activity-001",
    tenantId: "tenant-de-linde",
    category: "Betaling",
    title: "Abonnementsfactuur juli 2026 staat open",
    detail: "Betaallink en opvolging zijn beschikbaar in facturatie.",
    status: "Nieuw",
    priority: "Hoog",
    createdAt: "01/07/2026",
    acknowledgedAt: null,
    acknowledgedBy: null
  },
  {
    id: "saas-activity-002",
    tenantId: "tenant-de-linde",
    category: "Onboarding",
    title: "AI-afspraken staan nog open",
    detail: "Valideer AI-beleid en modelafspraken voor live gebruik.",
    status: "Nieuw",
    priority: "Normaal",
    createdAt: "30/06/2026",
    acknowledgedAt: null,
    acknowledgedBy: null
  },
  {
    id: "saas-activity-003",
    tenantId: "tenant-de-linde",
    category: "Modules",
    title: "Geavanceerde Belgische integraties gepauzeerd",
    detail: "Deze module vereist het Scale-plan of expliciete activering.",
    status: "Gelezen",
    priority: "Normaal",
    createdAt: "30/06/2026",
    acknowledgedAt: "30/06/2026",
    acknowledgedBy: "Praktijkhouder"
  },
  {
    id: "saas-activity-004",
    tenantId: "tenant-de-linde",
    category: "Plan",
    title: "Planwijziging naar Scale aangevraagd",
    detail: "Aanvraag staat klaar voor opvolging door PraktijkOS.",
    status: "Nieuw",
    priority: "Normaal",
    createdAt: "30/06/2026",
    acknowledgedAt: null,
    acknowledgedBy: null
  }
];

export const saasOperatorNotifications = [
  {
    id: "operator-billing-open",
    tenantId: "tenant-de-linde",
    category: "Betaling",
    title: "Abonnementfactuur vraagt opvolging",
    detail: "Open abonnementsfactuur en betaalmethode moeten door klantopvolging opgevolgd worden.",
    source: "saasInvoices",
    sourceLabel: "Abonnementfacturen",
    priority: "Hoog",
    owner: "Klantopvolging",
    status: "Nieuw",
    createdAt: "01/07/2026",
    dueAt: "Vandaag",
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    resolvedBy: null
  },
  {
    id: "operator-onboarding-open",
    tenantId: "tenant-de-linde",
    category: "Onboarding",
    title: "Praktijkactivatie is nog niet rond",
    detail: "Open onboardingstappen blokkeren een volledig afgeronde klantomgeving.",
    source: "saasOnboardingChecklist",
    sourceLabel: "Onboarding",
    priority: "Normaal",
    owner: "Klantopvolging",
    status: "Nieuw",
    createdAt: "30/06/2026",
    dueAt: "Deze week",
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    resolvedBy: null
  }
];

export const saasSupportQueue = [
  {
    id: "support-001",
    tenantId: "tenant-de-linde",
    title: "Betaalmethode voor abonnement bevestigen",
    category: "Betaling",
    priority: "Hoog",
    status: "Open",
    owner: "PraktijkOS support",
    slaDueAt: "03/07/2026",
    createdAt: "01/07/2026",
    detail: "Administratie wil Bancontact als standaard betaalmethode bevestigen.",
    escalatedAt: null,
    closedAt: null
  },
  {
    id: "support-002",
    tenantId: "tenant-de-linde",
    title: "Scale-module voor Belgische integraties",
    category: "Modules",
    priority: "Normaal",
    status: "Geescaleerd",
    owner: "Klantopvolging",
    slaDueAt: "05/07/2026",
    createdAt: "30/06/2026",
    detail: "Planwijziging naar Scale moet gekoppeld worden aan de juiste integratiemodules.",
    escalatedAt: "30/06/2026",
    closedAt: null
  },
  {
    id: "support-003",
    tenantId: "tenant-de-linde",
    title: "Onboardingcall ingepland",
    category: "Onboarding",
    priority: "Laag",
    status: "Gesloten",
    owner: "Klantopvolging",
    slaDueAt: "28/06/2026",
    createdAt: "27/06/2026",
    detail: "Kickoffcall met praktijkhouder werd bevestigd.",
    escalatedAt: null,
    closedAt: "28/06/2026"
  }
];

export const saasLifecycleRequests = [
  {
    id: "lifecycle-001",
    tenantId: "tenant-de-linde",
    requestType: "Verlenging",
    currentPlan: "Pro",
    requestedPlan: "Scale",
    effectiveAt: "01/08/2026",
    reason: "Zomeruitbreiding met meer teamleden en integraties.",
    status: "In review",
    requestedAt: "30/06/2026",
    requestedBy: "Praktijkhouder",
    reviewedAt: null,
    reviewedBy: null
  },
  {
    id: "lifecycle-002",
    tenantId: "tenant-de-linde",
    requestType: "Opzegging",
    currentPlan: "Pro",
    requestedPlan: "Geen",
    effectiveAt: "31/12/2026",
    reason: "Voorbeeldscenario voor eindejaarsbeslissing.",
    status: "Concept",
    requestedAt: "30/06/2026",
    requestedBy: "Administratie",
    reviewedAt: null,
    reviewedBy: null
  }
];

export const saasContractDocuments = [
  {
    id: "contract-001",
    tenantId: "tenant-de-linde",
    title: "Data Processing Agreement",
    type: "DPA",
    version: "2026.1",
    status: "Gedeeld",
    owner: "PraktijkOS legal",
    effectiveAt: "01/07/2026",
    renewalAt: "01/07/2027",
    storageLocation: "PraktijkOS contractmap",
    sharedAt: "30/06/2026",
    sharedBy: "PraktijkOS",
    notes: "Verwerkersovereenkomst voor EU-hosting en AI-verwerking."
  },
  {
    id: "contract-002",
    tenantId: "tenant-de-linde",
    title: "Abonnementsvoorwaarden Pro",
    type: "Voorwaarden",
    version: "2026.1",
    status: "Klaar om te delen",
    owner: "Klantopvolging",
    effectiveAt: "01/07/2026",
    renewalAt: "31/07/2026",
    storageLocation: "PraktijkOS contractmap",
    sharedAt: null,
    sharedBy: null,
    notes: "Voorwaarden voor Pro-plan met maandelijkse verlenging."
  },
  {
    id: "contract-003",
    tenantId: "tenant-de-linde",
    title: "Orderformulier Scale upgrade",
    type: "Orderformulier",
    version: "Concept",
    status: "Concept",
    owner: "Klantopvolging",
    effectiveAt: "01/08/2026",
    renewalAt: "01/08/2027",
    storageLocation: "PraktijkOS contractmap",
    sharedAt: null,
    sharedBy: null,
    notes: "Voorbereid op basis van planwijzigingsaanvraag."
  }
];

export const saasImplementationMilestones = [
  {
    id: "milestone-001",
    tenantId: "tenant-de-linde",
    phase: "Kickoff",
    label: "Praktijkconfiguratie bevestigd",
    owner: "Praktijkhouder",
    status: "Klaar",
    dueAt: "30/06/2026",
    completedAt: "30/06/2026",
    completedBy: "Praktijkhouder",
    detail: "Basisinstellingen, taal, locaties en rollen zijn nagekeken."
  },
  {
    id: "milestone-002",
    tenantId: "tenant-de-linde",
    phase: "Data",
    label: "Dossiers en agenda voorbereid",
    owner: "Onthaal",
    status: "Open",
    dueAt: "04/07/2026",
    completedAt: null,
    completedBy: null,
    detail: "Importvoorbereiding en agenda-afspraken valideren."
  },
  {
    id: "milestone-003",
    tenantId: "tenant-de-linde",
    phase: "Portaal",
    label: "Clientportaal piloot getest",
    owner: "Administratie",
    status: "Open",
    dueAt: "06/07/2026",
    completedAt: null,
    completedBy: null,
    detail: "Testuitnodiging sturen en intakeflow controleren."
  },
  {
    id: "milestone-004",
    tenantId: "tenant-de-linde",
    phase: "AI",
    label: "AI-afspraken voor livegang",
    owner: "Praktijkhouder",
    status: "Open",
    dueAt: "08/07/2026",
    completedAt: null,
    completedBy: null,
    detail: "AI-beleid, modelregister en reviewflow bevestigen."
  }
];

export const saasSuccessActions = [
  {
    id: "success-001",
    tenantId: "tenant-de-linde",
    category: "Adoptie",
    title: "Portaaladoptie met onthaal opvolgen",
    owner: "Klantopvolging",
    priority: "Hoog",
    status: "Open",
    dueAt: "03/07/2026",
    detail: "Bespreek welke clientgroepen eerst portaaluitnodigingen krijgen en meet intakevolledigheid.",
    completedAt: null,
    completedBy: null
  },
  {
    id: "success-002",
    tenantId: "tenant-de-linde",
    category: "Uitbreiding",
    title: "Scale-up beslissing voorbereiden",
    owner: "Klantopvolging",
    priority: "Normaal",
    status: "Open",
    dueAt: "08/07/2026",
    detail: "Koppel verlenging, Belgische integraties en extra seats aan een concreet upgradevoorstel.",
    completedAt: null,
    completedBy: null
  },
  {
    id: "success-003",
    tenantId: "tenant-de-linde",
    category: "AI",
    title: "AI-afspraken afgerond",
    owner: "Praktijkhouder",
    priority: "Normaal",
    status: "Klaar",
    dueAt: "30/06/2026",
    detail: "Modelregister en reviewafspraken zijn bevestigd voor administratieve AI-acties.",
    completedAt: "30/06/2026",
    completedBy: "Praktijkhouder"
  }
];

export const saasRiskPlaybooks = [
  {
    id: "playbook-billing-risk",
    tenantId: "tenant-de-linde",
    category: "Betaling",
    title: "Betaalrisico opvolgen",
    trigger: "Open abonnementsfactuur of betaalstatus met actie nodig",
    severity: "warning",
    owner: "Klantopvolging",
    status: "Aanbevolen",
    recommendedAction: "Plan betaalmethodebevestiging en zet dunning klaar.",
    actionTitle: "Betaalrisico en betaalmethode opvolgen",
    actionDetail: "Controleer open abonnementsfacturen, bevestig Bancontact/Wero en stem de volgende betaalopvolging af.",
    lastRunAt: null,
    lastRunBy: null,
    runCount: 0
  },
  {
    id: "playbook-adoption-risk",
    tenantId: "tenant-de-linde",
    category: "Adoptie",
    title: "Adoptierisico herstellen",
    trigger: "Open onboarding, implementatiemijlpalen of lage AI-adoptie",
    severity: "warning",
    owner: "Klantopvolging",
    status: "Aanbevolen",
    recommendedAction: "Bundel onboarding, portaal en AI-acties in een opvolggesprek.",
    actionTitle: "Adoptiecall met praktijk voorbereiden",
    actionDetail: "Bespreek open onboardingstappen, portaalactivatie en AI-gebruik met praktijkhouder en onthaal.",
    lastRunAt: null,
    lastRunBy: null,
    runCount: 0
  },
  {
    id: "playbook-support-escalation",
    tenantId: "tenant-de-linde",
    category: "Support",
    title: "Escalatie terug op spoor zetten",
    trigger: "Geescaleerde supportvraag of hoog-prioritaire blokkade",
    severity: "danger",
    owner: "Klantopvolging",
    status: "Aanbevolen",
    recommendedAction: "Wijs eigenaar toe, bevestig SLA en stuur statusupdate.",
    actionTitle: "Escalatieplan uitvoeren",
    actionDetail: "Maak een duidelijke eigenaar/SLA-update voor de praktijk en koppel de blokkade aan verlenging of modulekeuze.",
    lastRunAt: null,
    lastRunBy: null,
    runCount: 0
  }
];

export const saasTenantCohorts = [
  {
    id: "cohort-001",
    tenantId: "tenant-de-linde",
    practiceName: "Groepspraktijk De Linde",
    segment: "Multidisciplinair",
    plan: "Scale",
    region: "Antwerpen",
    lifecycleStage: "Implementatie",
    healthScore: 72,
    mrr: 249,
    owner: "Klantopvolging",
    risk: "Adoptie",
    lastActiveAt: "Vandaag",
    qbrStatus: "Te plannen",
    qbrDueAt: "08/07/2026",
    qbrPlannedAt: null,
    qbrPlannedBy: null
  },
  {
    id: "cohort-002",
    tenantId: "tenant-kine-noord",
    practiceName: "Kine Noord",
    segment: "Kinesitherapie",
    plan: "Pro",
    region: "Brasschaat",
    lifecycleStage: "Live",
    healthScore: 91,
    mrr: 149,
    owner: "Klantopvolging",
    risk: "Laag",
    lastActiveAt: "Vandaag",
    qbrStatus: "Gepland",
    qbrDueAt: "15/07/2026",
    qbrPlannedAt: "28/06/2026",
    qbrPlannedBy: "Klantopvolging"
  },
  {
    id: "cohort-003",
    tenantId: "tenant-logopedie-zenne",
    practiceName: "Logopedie Zenne",
    segment: "Logopedie",
    plan: "Starter",
    region: "Vilvoorde",
    lifecycleStage: "Proefperiode",
    healthScore: 64,
    mrr: 79,
    owner: "Sales",
    risk: "Conversie",
    lastActiveAt: "Gisteren",
    qbrStatus: "Te plannen",
    qbrDueAt: "05/07/2026",
    qbrPlannedAt: null,
    qbrPlannedBy: null
  },
  {
    id: "cohort-004",
    tenantId: "tenant-psy-gent",
    practiceName: "Psychologen Gent",
    segment: "Psychologie",
    plan: "Enterprise",
    region: "Gent",
    lifecycleStage: "Uitbreiding",
    healthScore: 86,
    mrr: 499,
    owner: "Klantopvolging",
    risk: "Integraties",
    lastActiveAt: "Vandaag",
    qbrStatus: "Te plannen",
    qbrDueAt: "12/07/2026",
    qbrPlannedAt: null,
    qbrPlannedBy: null
  }
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
  },
  {
    id: "q-005",
    label: "Retentiecleanup uitvoeren",
    description: "Controleer AI-concepten, portaaltoegang en tijdelijke dossieruitzonderingen in het veiligheidscentrum.",
    owner: "Praktijkhouder",
    priority: "Hoog",
    status: "Open",
    dueAt: "Vandaag",
    category: "Retentie",
    action: "security"
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
