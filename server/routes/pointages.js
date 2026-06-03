const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Haversine
function haversine(lat1,lon1,lat2,lon2) {
  const R=6371000, toRad=x=>x*Math.PI/180;
  const dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// GET /api/pointages — liste avec filtres
router.get('/', (req, res) => {
  const { agent_id, date_debut, date_fin, date } = req.query;
  let sql = 'SELECT p.*, a.nom, a.prenom, a.poste FROM pointages p JOIN agents a ON p.agent_id = a.id WHERE 1=1';
  const params = [];
  if (agent_id) { sql += ' AND p.agent_id = ?'; params.push(agent_id); }
  if (date)      { sql += ' AND p.date = ?'; params.push(date); }
  if (date_debut){ sql += ' AND p.date >= ?'; params.push(date_debut); }
  if (date_fin)  { sql += ' AND p.date <= ?'; params.push(date_fin); }
  sql += ' ORDER BY p.date DESC, p.arrivee DESC';
  res.json(db.prepare(sql).all(...params));
});

// GET /api/pointages/today — tous les agents pour aujourd'hui
router.get('/today', (req, res) => {
  const today = new Date().toISOString().slice(0,10);
  const rows = db.prepare(`
    SELECT p.*, a.nom, a.prenom, a.poste, a.photo_base64,
           z.nom as zone_nom, z.couleur as zone_couleur
    FROM pointages p
    JOIN agents a ON p.agent_id = a.id
    LEFT JOIN zones z ON p.zone_id = z.id
    WHERE p.date = ?
    ORDER BY p.arrivee ASC
  `).all(today);

  // Aussi les agents sans pointage
  const allAgents = db.prepare('SELECT id,nom,prenom,poste FROM agents WHERE actif=1').all();
  const pointeIds = new Set(rows.map(r => r.agent_id));
  const absents = allAgents.filter(a => !pointeIds.has(a.id));

  res.json({ pointages: rows, absents, date: today });
});

// POST /api/pointages/scan — scan QR avec vérification GPS
router.post('/scan', (req, res) => {
  const { agent_id, lat, lon, selfie } = req.body;
  if (!agent_id) return res.status(400).json({ error: 'agent_id requis' });

  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND actif = 1').get(agent_id);
  if (!agent) return res.status(404).json({ error: 'Agent introuvable ou inactif' });

  // Vérifier les zones autorisées
  const agentZones = db.prepare(`
    SELECT z.* FROM zones z
    JOIN agent_zones az ON z.id = az.zone_id
    WHERE az.agent_id = ? AND z.actif = 1
  `).all(agent_id);

  let zoneValidee = null;
  let distanceMin = Infinity;

  if (lat && lon) {
    for (const z of agentZones) {
      const dist = haversine(lat, lon, z.lat, z.lon);
      if (dist < distanceMin) { distanceMin = dist; }
      if (dist <= z.rayon) { zoneValidee = { ...z, distance: dist }; break; }
    }
  }

  // Si GPS fourni et hors zone → BLOQUER
  if (lat && lon && agentZones.length > 0 && !zoneValidee) {
    const logId = uuidv4();
    db.prepare(`INSERT INTO journal_securite (id,agent_id,timestamp,lat,lon,zone_id,distance,raison)
      VALUES (?,?,?,?,?,?,?,?)`)
      .run(logId, agent_id, new Date().toISOString(), lat, lon,
           agentZones[0]?.id || null, Math.round(distanceMin), 'Hors zone autorisée');

    return res.status(403).json({
      error: 'HORS_ZONE',
      message: `Vous êtes à ${Math.round(distanceMin)}m de la zone la plus proche (max autorisé : ${agentZones[0]?.rayon}m)`,
      distance: Math.round(distanceMin),
      rayon: agentZones[0]?.rayon,
    });
  }

  // Enregistrer le pointage
  const today = new Date().toISOString().slice(0,10);
  const time = new Date().toTimeString().slice(0,8);
  const existing = db.prepare('SELECT * FROM pointages WHERE agent_id = ? AND date = ?').get(agent_id, today);

  let action, pointage;
  if (!existing) {
    const id = uuidv4();
    db.prepare(`INSERT INTO pointages (id,agent_id,date,arrivee,zone_id,lat,lon,distance,selfie,statut)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(id, agent_id, today, time, zoneValidee?.id || null,
           lat || null, lon || null, Math.round(distanceMin) || null, selfie ? 1 : 0, 'valide');
    action = 'arrivee';
    pointage = db.prepare('SELECT * FROM pointages WHERE id = ?').get(id);
  } else if (!existing.depart) {
    db.prepare('UPDATE pointages SET depart=?, zone_id=COALESCE(?,zone_id) WHERE agent_id=? AND date=?')
      .run(time, zoneValidee?.id || null, agent_id, today);
    action = 'depart';
    pointage = { ...existing, depart: time };
  } else {
    action = 'already';
    pointage = existing;
  }

  res.json({ action, agent: { nom: agent.nom, prenom: agent.prenom }, pointage, zone: zoneValidee });
});

// PUT /api/pointages/:id — correction manuelle
router.put('/:id', (req, res) => {
  const { arrivee, depart, note } = req.body;
  db.prepare('UPDATE pointages SET arrivee=?,depart=?,note=?,statut="manuel" WHERE id=?')
    .run(arrivee||null, depart||null, note||null, req.params.id);
  res.json({ success: true });
});

// GET /api/pointages/journal — journal sécurité
router.get('/journal', (req, res) => {
  const { agent_id, limit } = req.query;
  let sql = `SELECT j.*, a.nom, a.prenom, z.nom as zone_nom
             FROM journal_securite j
             JOIN agents a ON j.agent_id = a.id
             LEFT JOIN zones z ON j.zone_id = z.id
             WHERE 1=1`;
  const params = [];
  if (agent_id) { sql += ' AND j.agent_id = ?'; params.push(agent_id); }
  sql += ' ORDER BY j.timestamp DESC';
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)); }
  res.json(db.prepare(sql).all(...params));
});

module.exports = router;
