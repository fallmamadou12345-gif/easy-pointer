const router = require('express').Router();
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

const HEURES_REF = 8;

function calcDuree(arrivee, depart) {
  if (!arrivee || !depart) return null;
  const [ah,am] = arrivee.slice(0,5).split(':').map(Number);
  const [dh,dm] = depart.slice(0,5).split(':').map(Number);
  return ((dh*60+dm) - (ah*60+am)) / 60;
}

function fmtH(h) {
  if (h === null || h === undefined) return '—';
  const neg=h<0,abs=Math.abs(h),hh=Math.floor(abs),mm=Math.round((abs-hh)*60);
  return `${neg?'-':''}${String(hh).padStart(2,'0')}h${String(mm).padStart(2,'0')}`;
}

// GET /api/rapports?period=mensuel&mois=2026-05&agent_id=
router.get('/', (req, res) => {
  const { period, mois, annee, agent_id } = req.query;

  let dateFilter = '';
  const params = [];

  if (period === 'mensuel' && mois) {
    dateFilter = "AND strftime('%Y-%m', p.date) = ?";
    params.push(mois);
  } else if (period === 'annuel' && annee) {
    dateFilter = "AND strftime('%Y', p.date) = ?";
    params.push(annee);
  } else if (mois) {
    dateFilter = "AND strftime('%Y-%m', p.date) = ?";
    params.push(mois);
  }

  let agentFilter = '';
  if (agent_id) { agentFilter = 'AND a.id = ?'; params.push(agent_id); }

  const rows = db.prepare(`
    SELECT a.id, a.nom, a.prenom, a.poste, a.contrat,
           p.date, p.arrivee, p.depart, p.zone_id, p.statut
    FROM agents a
    LEFT JOIN pointages p ON a.id = p.agent_id ${dateFilter}
    WHERE a.actif = 1 ${agentFilter}
    ORDER BY a.nom, p.date
  `).all(...params);

  // Grouper par agent
  const agentMap = {};
  rows.forEach(r => {
    if (!agentMap[r.id]) {
      agentMap[r.id] = { id:r.id, nom:r.nom, prenom:r.prenom, poste:r.poste, contrat:r.contrat, pointages:[] };
    }
    if (r.date) agentMap[r.id].pointages.push({ date:r.date, arrivee:r.arrivee, depart:r.depart, zone_id:r.zone_id, statut:r.statut });
  });

  const result = Object.values(agentMap).map(ag => {
    const joursPresents = ag.pointages.filter(p => p.arrivee).length;
    const totalH = ag.pointages.reduce((sum,p) => sum + (calcDuree(p.arrivee,p.depart)||0), 0);
    const refH = joursPresents * HEURES_REF;
    const supH = Math.max(0, totalH - refH);
    const defH = Math.max(0, refH - totalH);
    return {
      ...ag,
      joursPresents,
      absences: 0, // calculé côté client selon calendrier
      totalH: Math.round(totalH * 100) / 100,
      totalHFmt: fmtH(totalH),
      supH: Math.round(supH * 100) / 100,
      supHFmt: fmtH(supH),
      defH: Math.round(defH * 100) / 100,
      defHFmt: fmtH(defH),
      balance: Math.round((totalH - refH) * 100) / 100,
      balanceFmt: fmtH(totalH - refH),
    };
  });

  res.json(result);
});

// GET /api/rapports/csv — export CSV
router.get('/csv', (req, res) => {
  const { mois } = req.query;
  const dateFilter = mois ? "AND strftime('%Y-%m', p.date) = ?" : '';
  const params = mois ? [mois] : [];

  const rows = db.prepare(`
    SELECT a.nom, a.prenom, a.poste, a.contrat,
           p.date, p.arrivee, p.depart, p.statut,
           z.nom as zone_nom
    FROM agents a
    LEFT JOIN pointages p ON a.id = p.agent_id ${dateFilter}
    LEFT JOIN zones z ON p.zone_id = z.id
    WHERE a.actif = 1
    ORDER BY a.nom, p.date
  `).all(...params);

  const csv = ['Nom,Prenom,Poste,Contrat,Date,Arrivee,Depart,Zone,Statut'].concat(
    rows.map(r => `${r.nom},${r.prenom},${r.poste},${r.contrat},${r.date||''},${r.arrivee||''},${r.depart||''},${r.zone_nom||''},${r.statut||''}`)
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=rapport_${mois||'all'}.csv`);
  res.send('\uFEFF' + csv); // BOM UTF-8 pour Excel
});

module.exports = router;
