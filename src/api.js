async function request(path, options = {}) {
  const response = await fetch(path, {
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

export async function createClient(payload) {
  return request("/api/clients", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createAppointment(payload) {
  return request("/api/appointments", {
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

export async function approveDraft(draftId) {
  return request(`/api/ai/drafts/${draftId}/approve`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function generateBillingProposals() {
  return request("/api/billing/proposals", {
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
