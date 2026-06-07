const BASE = '/api';
function tok() { return localStorage.getItem('ep_token'); }
async function r(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (tok()) headers['Authorization'] = `Bearer ${tok()}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401) { localStorage.removeItem('ep_token'); window.location.reload(); return; }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}
export const api = {
  login: (u,p) => r('POST','/auth/login',{username:u,password:p}),
  me: () => r('GET','/auth/me'),
  agents: () => r('GET','/agents'),
  agent: (id) => r('GET',`/agents/${id}`),
  createAgent: (d) => r('POST','/agents',d),
  updateAgent: (id,d) => r('PUT',`/agents/${id}`,d),
  deleteAgent: (id) => r('DELETE',`/agents/${id}`),
  agentAbsences: (id) => r('GET',`/agents/${id}/absences`),
  addAbsence: (id,d) => r('POST',`/agents/${id}/absences`,d),
  agentConges: (id) => r('GET',`/agents/${id}/conges`),
  addConge: (id,d) => r('POST',`/agents/${id}/conges`,d),
  zones: () => r('GET','/zones'),
  createZone: (d) => r('POST','/zones',d),
  updateZone: (id,d) => r('PUT',`/zones/${id}`,d),
  deleteZone: (id) => r('DELETE',`/zones/${id}`),
  toggleZone: (id) => r('PUT',`/zones/${id}/toggle`),
  todayPointages: () => r('GET','/pointages/today'),
  pointages: (q) => r('GET',`/pointages?${new URLSearchParams(q)}`),
  scan: (d) => r('POST','/pointages/scan',d),
  updatePointage: (id,d) => r('PUT',`/pointages/${id}`,d),
  journal: (q) => r('GET',`/pointages/journal?${new URLSearchParams(q||{})}`),
  alertes: () => r('GET','/pointages/alertes'),
  planning: (q) => r('GET',`/planning?${new URLSearchParams(q)}`),
  setShift: (d) => r('POST','/planning',d),
  bulkShifts: (u) => r('POST','/planning/bulk',{updates:u}),
  rapport: (q) => r('GET',`/rapports?${new URLSearchParams(q)}`),
  rapportDashboard: () => r('GET','/rapports/dashboard'),
  exportCSV: (q) => `${BASE}/rapports/csv?${new URLSearchParams(q)}&_t=${tok()}`,
};

// Ajouts v2
Object.assign(api, {
  // Horaires
  horaires:          ()            => request('GET','/horaires'),
  horaire:           (id)          => request('GET',`/horaires/${id}`),
  createHoraire:     (data)        => request('POST','/horaires',data),
  updateHoraire:     (id,data)     => request('PUT',`/horaires/${id}`,data),
  deleteHoraire:     (id)          => request('DELETE',`/horaires/${id}`),
  appliquerHoraire:  (data)        => request('POST','/horaires/appliquer',data),
  horairePourAgent:  (aid,data)    => request('PUT',`/horaires/agent/${aid}`,data),

  // Rapports enrichis
  dashboard:         ()            => request('GET','/rapports/dashboard'),
  retardataires:     ()            => request('GET','/rapports/retardataires'),
  absences:          (q)           => request('GET',`/rapports/absences?${new URLSearchParams(q||{})}`),
  justifierAbsence:  (id,data)     => request('PUT',`/rapports/absences/${id}`,data),
  exportExcel:       (mois)        => `${BASE}/rapports/excel?mois=${mois}&token=${getToken()}`,
  exportCSV:         (mois)        => `${BASE}/rapports/csv?mois=${mois}&token=${getToken()}`,
});
