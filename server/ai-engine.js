const workflowLabels = {
  intake: "Intake samenvatten",
  note: "Sessienota structureren",
  letter: "Doorverwijsbrief voorbereiden",
  billing: "Facturatiecheck maken"
};

function generateDraft({ workflow, input, knowledge = [] }) {
  const source = String(input || "").trim() || "Geen broninformatie opgegeven.";
  const auditDate = new Date().toLocaleDateString("nl-BE");
  const knowledgeSection = knowledge.length
    ? [
      "",
      "Praktijkkennis toegepast:",
      ...knowledge.slice(0, 5).map((item) => `- ${item.title || item.category}: ${item.content}`)
    ].join("\n")
    : "";
  const footer = [
    knowledgeSection,
    "",
    "Controlepunten:",
    "- Verifieer inhoud met het clientendossier.",
    "- Pas toon, context en details aan voor opslag of verzending.",
    "- Professionele review is verplicht voor goedkeuring.",
    "",
    `Audit: concept gegenereerd op ${auditDate}.`
  ].join("\n");

  if (workflow === "note") {
    return [
      "Sessienota concept",
      "",
      `Bron:\n${source}`,
      "",
      "S: Client rapporteert spanning, slaapklachten of functionele hinder.",
      "O: Context moet klinisch worden aangevuld door de zorgverlener.",
      "A: Verdere exploratie nodig rond hulpvraag, beschermende factoren en risico's.",
      "P: Intake afronden, doelen bepalen en opvolgactie plannen.",
      footer
    ].join("\n");
  }

  if (workflow === "letter") {
    return [
      "Doorverwijsbrief concept",
      "",
      `Bron:\n${source}`,
      "",
      "Geachte collega,",
      "",
      "Wij zagen client voor een eerste verkennend contact. De hulpvraag en context worden verder in kaart gebracht. Onderstaande tekst is een concept en vereist inhoudelijke validatie voor verzending.",
      "",
      "Met vriendelijke groeten,",
      footer
    ].join("\n");
  }

  if (workflow === "billing") {
    return [
      "Facturatiecheck concept",
      "",
      `Bron:\n${source}`,
      "",
      "Te controleren:",
      "1. Afspraakstatus bevestigd?",
      "2. Correct afspraaktype en tarief gekozen?",
      "3. Betaalmethode gekend?",
      "4. Peppol of particuliere factuur nodig?",
      "5. Openstaand saldo of herinnering aanwezig?",
      footer
    ].join("\n");
  }

  return [
    "Intakeconcept",
    "",
    `Hulpvraag:\n${source}`,
    "",
    "Voorlopige samenvatting:",
    "Client vraagt begeleiding rond de beschreven klachten. De intake is nog niet volledig gevalideerd, dus ontbrekende context moet eerst worden aangevuld.",
    "",
    "Voorgestelde acties:",
    "1. Intakeformulier vervolledigen.",
    "2. Eerste sessiedoel vastleggen.",
    "3. Beschikbaarheid en voorkeursmomenten controleren.",
    footer
  ].join("\n");
}

module.exports = {
  generateDraft,
  workflowLabels
};
