async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with ${response.status}`);
  }

  return response.json();
}

export async function fetchApiState() {
  return request("/api/state");
}

export async function fetchSession() {
  return request("/api/auth/session");
}

export async function login(payload) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function logout() {
  return request("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function createClient(payload) {
  return request("/api/clients", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createAccessOverride(clientId, payload) {
  return request(`/api/clients/${clientId}/access-overrides`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function exportClient(clientId) {
  return request(`/api/clients/${clientId}/export`);
}

export async function createAppointment(payload) {
  return request("/api/appointments", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateAppointment(appointmentId, payload) {
  return request(`/api/appointments/${appointmentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function scheduleWaitlistEntry(waitlistId, payload) {
  return request(`/api/waitlist/${waitlistId}/schedule`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createDraft(payload) {
  return request("/api/ai/drafts", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function generateAiDraft(payload) {
  return request("/api/ai/generate", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function approveDraft(draftId, payload = {}) {
  return request(`/api/ai/drafts/${draftId}/approve`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function generateBillingProposals() {
  return request("/api/billing/proposals", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function exportBillingPackage(payload = {}) {
  return request("/api/billing/export", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createInvoice(payload) {
  return request("/api/invoices", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateInvoice(invoiceId, payload) {
  return request(`/api/invoices/${invoiceId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function sendInvoiceReminder(invoiceId) {
  return request(`/api/invoices/${invoiceId}/reminder`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function completeTask(taskId) {
  return request(`/api/tasks/${taskId}/complete`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function completeDayCloseCheck(itemId) {
  return request(`/api/day-close/${itemId}/complete`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function previewImport(payload) {
  return request("/api/import/preview", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function applyImport(previewId) {
  return request(`/api/import/${previewId}/apply`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function rollbackImport(previewId) {
  return request(`/api/import/${previewId}/rollback`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function updatePractice(payload) {
  return request("/api/practice", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function createTeamMember(payload) {
  return request("/api/team", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createIntake(payload) {
  return request("/api/intakes", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createMessage(payload) {
  return request("/api/messages", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateMessage(messageId, payload) {
  return request(`/api/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function createPortalInvite(payload) {
  return request("/api/portal/invites", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updatePortalInvite(inviteId, payload) {
  return request(`/api/portal/invites/${inviteId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function createNote(payload) {
  return request("/api/notes", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createDocument(payload) {
  return request("/api/documents", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateDocument(documentId, payload) {
  return request(`/api/documents/${documentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}
