const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

function haversine(lat1,lon1,lat2,lon2){
  const R=6371000,toRad=x=>x*Math.PI/180;
  const a=Math.sin(toRad(lat2-lat1)/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(toRad(lon2-lon1)/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// ── Routes PUBLIQUES (app agent) ──────────────────────────────────────────────

// GET today — accessible sans auth pour l'app agent
router.get('/today', (req, res) => {
  const today = new Date().toISOString().slice(0,10);
  const pointages = db.prepare(`
    SELECT p.*,a.nom,a.prenom,a.poste,z.nom as zone_nom,z.couleur as zone_couleur
    FROM pointages p JOIN agents a ON p.agent_id=a.id LEFT JOIN zones z ON p.zone_id=z.id
    WHERE p.date=? ORDER BY p.arrivee ASC
  `).all(today);
  const allAgents = db.prepare('SELECT id,nom,prenom,poste FROM agents WHERE actif=1').all();
  const pointeIds = new Set(pointages.map(p=>p.agent_id));
  const absents = allAgents.filter(a=>!pointeIds.has(a.id));
  res.json({ pointages, absents, date: today });
});

// POST scan — accessible sans auth (agent_id identifie l'agent)
router.post('/scan', (req, res) => {
  const { agent_id, lat, lon, selfie } = req.body;
  if (!agent_id) return res.status(400).json({ error: 'agent_id requis' });
  const agent = db.prepare('SELECT * FROM agents WHERE id=? AND actif=1').get(agent_id);
  if (!agent) return res.status(404).json({ error: 'Agent introuvable ou inactif' });

  const agentZones = db.prepare(`
    SELECT z.* FROM zones z JOIN agent_zones az ON z.id=az.zone_id WHERE az.agent_id=? AND z.actif=1
  `).all(agent_id);

  let zoneValidee=null, distanceMin=Infinity;
  if (lat && lon && agentZones.length > 0) {
    for (const z of agentZones) {
      const dist = haversine(lat, lon, z.lat, z.lon);
      if (dist < distanceMin) distanceMin = dist;
      if (dist <= z.rayon) { zoneValidee = { ...z, distance: dist }; break; }
    }
    if (!zoneValidee) {
      db.prepare('INSERT INTO journal_securite (id,agent_id,timestamp,lat,lon,zone_id,distance,raison) VALUES (?,?,?,?,?,?,?,?)')
        .run(uuidv4(), agent_id, new Date().toISOString(), lat, lon, agentZones[0]?.id||null, Math.round(distanceMin), 'Hors zone autorisée');
      return res.status(403).json({
        error: 'HORS_ZONE',
        message: `Vous êtes à ${Math.round(distanceMin)}m de la zone (max: ${agentZones[0]?.rayon}m)`,
        distance: Math.round(distanceMin), rayon: agentZones[0]?.rayon,
      });
    }
  }

  const today = new Date().toISOString().slice(0,10);
  const time = new Date().toTimeString().slice(0,8);
  const existing = db.prepare('SELECT * FROM pointages WHERE agent_id=? AND date=?').get(agent_id, today);

  let action;
  if (!existing) {
    db.prepare('INSERT INTO pointages (id,agent_id,date,arrivee,zone_id,lat,lon,distance,selfie,statut) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(uuidv4(), agent_id, today, time, zoneValidee?.id||null, lat||null, lon||null, distanceMin<Infinity?Math.round(distanceMin):null, selfie?1:0, 'valide');
    action = 'arrivee';
  } else if (!existing.depart) {
    db.prepare('UPDATE pointages SET depart=? WHERE agent_id=? AND date=?').run(time, agent_id, today);
    action = 'depart';
  } else {
    action = 'already';
  }

  const updated = db.prepare('SELECT * FROM pointages WHERE agent_id=? AND date=?').get(agent_id, today);
  res.json({ action, agent: { nom: agent.nom, prenom: agent.prenom }, pointage: updated, zone: zoneValidee });
});

// ── Routes PROTÉGÉES (admin) ──────────────────────────────────────────────────
router.get('/', authMiddleware, (req, res) => {
  const { agent_id, date_debut, date_fin, date } = req.query;
  let sql = 'SELECT p.*,a.nom,a.prenom FROM pointages p JOIN agents a ON p.agent_id=a.id WHERE 1=1';
  const params = [];
  if (agent_id)  { sql += ' AND p.agent_id=?'; params.push(agent_id); }
  if (date)      { sql += ' AND p.date=?'; params.push(date); }
  if (date_debut){ sql += ' AND p.date>=?'; params.push(date_debut); }
  if (date_fin)  { sql += ' AND p.date<=?'; params.push(date_fin); }
  sql += ' ORDER BY p.date DESC';
  res.json(db.prepare(sql).all(...params));
});

router.put('/:id', authMiddleware, (req, res) => {
  const { arrivee, depart, note } = req.body;
  db.prepare('UPDATE pointages SET arrivee=?,depart=?,note=?,statut="manuel" WHERE id=?')
    .run(arrivee||null, depart||null, note||null, req.params.id);
  res.json({ success: true });
});

router.get('/journal', authMiddleware, (req, res) => {
  const { agent_id, limit } = req.query;
  let sql = 'SELECT j.*,a.nom,a.prenom,z.nom as zone_nom FROM journal_securite j JOIN agents a ON j.agent_id=a.id LEFT JOIN zones z ON j.zone_id=z.id WHERE 1=1';
  const params = [];
  if (agent_id) { sql += ' AND j.agent_id=?'; params.push(agent_id); }
  sql += ' ORDER BY j.timestamp DESC';
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)); }
  res.json(db.prepare(sql).all(...params));
});

module.exports = router;
