const BASE = '/api';

function getToken() {
  return localStorage.getItem('ep_token');
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('ep_token');
    window.location.reload();
    return;
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

export const api = {
  // Auth
  login:  (u,p) => request('POST','/auth/login',{username:u,password:p}),
  me:     ()     => request('GET','/auth/me'),

  // Agents
  agents:       ()        => request('GET','/agents'),
  agent:        (id)      => request('GET',`/agents/${id}`),
  createAgent:  (data)    => request('POST','/agents',data),
  updateAgent:  (id,data) => request('PUT',`/agents/${id}`,data),
  deleteAgent:  (id)      => request('DELETE',`/agents/${id}`),

  // Zones
  zones:        ()        => request('GET','/zones'),
  zone:         (id)      => request('GET',`/zones/${id}`),
  createZone:   (data)    => request('POST','/zones',data),
  updateZone:   (id,data) => request('PUT',`/zones/${id}`,data),
  deleteZone:   (id)      => request('DELETE',`/zones/${id}`),
  toggleZone:   (id)      => request('PUT',`/zones/${id}/toggle`),

  // Pointages
  todayPointages: ()           => request('GET','/pointages/today'),
  pointages:      (q)          => request('GET',`/pointages?${new URLSearchParams(q)}`),
  scan:           (data)       => request('POST','/pointages/scan',data),
  updatePointage: (id,data)    => request('PUT',`/pointages/${id}`,data),
  journal:        (q)          => request('GET',`/pointages/journal?${new URLSearchParams(q||{})}`),

  // Planning
  planning:      (q)           => request('GET',`/planning?${new URLSearchParams(q)}`),
  setShift:      (data)        => request('POST','/planning',data),
  bulkShifts:    (updates)     => request('POST','/planning/bulk',{updates}),

  // Rapports
  rapport:       (q)           => request('GET',`/rapports?${new URLSearchParams(q)}`),
  exportCSV:     (mois)        => `${BASE}/rapports/csv?mois=${mois}&token=${getToken()}`,
};
