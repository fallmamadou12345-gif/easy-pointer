// Route spéciale pour l'app mobile agents (login par PIN)
const router = require('express').Router();
const jwt = require('jsonwebtoken');
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'easy-pointer-secret-2024';

// POST /api/agent-app/login — login agent par ID + PIN
router.post('/login', (req, res) => {
  const { agent_id, pin } = req.body;
  if (!agent_id || !pin) return res.status(400).json({ error: 'agent_id et pin requis' });

  const agent = db.prepare('SELECT * FROM agents WHERE id=? AND actif=1').get(agent_id);
  if (!agent) return res.status(404).json({ error: 'Agent introuvable ou inactif' });

  // PIN démo : 1234 pour tous (en prod, stocker un hash dans la table agents)
  if (pin !== '1234') return res.status(401).json({ error: 'Code PIN incorrect' });

  const token = jwt.sign(
    { id: agent.id, nom: agent.nom, prenom: agent.prenom, poste: agent.poste,
      role: 'agent', agent_id: agent.id },
    JWT_SECRET, { expiresIn: '12h' }
  );
  res.json({ token, agent });
});

// GET /api/agent-app/me — profil complet de l'agent connecté
router.get('/me', authMiddleware, (req, res) => {
  const agent = db.prepare('SELECT * FROM agents WHERE id=?').get(req.user.agent_id || req.user.id);
  if (!agent) return res.status(404).json({ error: 'Agent introuvable' });
  const zones = db.prepare(`
    SELECT z.* FROM zones z JOIN agent_zones az ON z.id=az.zone_id WHERE az.agent_id=? AND z.actif=1
  `).all(agent.id);
  const zoneDefaut = db.prepare('SELECT z.* FROM zones z JOIN agent_zones az ON z.id=az.zone_id WHERE az.agent_id=? AND az.est_defaut=1').get(agent.id);
  res.json({ ...agent, zones, zoneDefaut });
});

// GET /api/agent-app/planning — planning de l'agent sur 4 semaines
router.get('/planning', authMiddleware, (req, res) => {
  const agentId = req.user.agent_id || req.user.id;
  const { date_debut, date_fin } = req.query;
  let sql = 'SELECT * FROM planning WHERE agent_id=?';
  const params = [agentId];
  if (date_debut) { sql += ' AND date>=?'; params.push(date_debut); }
  if (date_fin)   { sql += ' AND date<=?'; params.push(date_fin); }
  sql += ' ORDER BY date ASC';
  const rows = db.prepare(sql).all(...params);
  // Retourner comme objet date->shift_id
  const plan = {};
  rows.forEach(r => { plan[r.date] = r.shift_id; });
  res.json(plan);
});

// GET /api/agent-app/historique — pointages de l'agent
router.get('/historique', authMiddleware, (req, res) => {
  const agentId = req.user.agent_id || req.user.id;
  const rows = db.prepare(`
    SELECT p.*, z.nom as zone_nom, z.couleur as zone_couleur
    FROM pointages p LEFT JOIN zones z ON p.zone_id=z.id
    WHERE p.agent_id=? ORDER BY p.date DESC LIMIT 30
  `).all(agentId);
  res.json(rows);
});

// GET /api/agent-app/journal — journal sécurité de l'agent
router.get('/journal', authMiddleware, (req, res) => {
  const agentId = req.user.agent_id || req.user.id;
  const rows = db.prepare(`
    SELECT j.*, z.nom as zone_nom FROM journal_securite j LEFT JOIN zones z ON j.zone_id=z.id
    WHERE j.agent_id=? ORDER BY j.timestamp DESC LIMIT 20
  `).all(agentId);
  res.json(rows);
});

// POST /api/agent-app/scan — pointage depuis l'app mobile
router.post('/scan', authMiddleware, (req, res) => {
  // Réutiliser la logique du scan existant
  const { v4: uuidv4 } = require('uuid');
  const agentId = req.user.agent_id || req.user.id;
  const { lat, lon, selfie } = req.body;

  function haversine(lat1,lon1,lat2,lon2){
    const R=6371000,toRad=x=>x*Math.PI/180;
    const dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1);
    const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }

  const agentZones = db.prepare(`
    SELECT z.* FROM zones z JOIN agent_zones az ON z.id=az.zone_id WHERE az.agent_id=? AND z.actif=1
  `).all(agentId);

  let zoneValidee = null, distanceMin = Infinity;
  if (lat && lon) {
    for (const z of agentZones) {
      const dist = haversine(lat, lon, z.lat, z.lon);
      if (dist < distanceMin) distanceMin = dist;
      if (dist <= z.rayon) { zoneValidee = { ...z, distance: dist }; break; }
    }
  }

  if (lat && lon && agentZones.length > 0 && !zoneValidee) {
    db.prepare('INSERT INTO journal_securite (id,agent_id,timestamp,lat,lon,zone_id,distance,raison) VALUES (?,?,?,?,?,?,?,?)')
      .run(uuidv4(), agentId, new Date().toISOString(), lat, lon, agentZones[0]?.id||null, Math.round(distanceMin), 'Hors zone autorisée');
    return res.status(403).json({
      error: 'HORS_ZONE',
      message: `À ${Math.round(distanceMin)}m (max: ${agentZones[0]?.rayon}m)`,
      distance: Math.round(distanceMin),
    });
  }

  const today = new Date().toISOString().slice(0,10);
  const time = new Date().toTimeString().slice(0,8);
  const existing = db.prepare('SELECT * FROM pointages WHERE agent_id=? AND date=?').get(agentId, today);

  let action;
  if (!existing) {
    db.prepare('INSERT INTO pointages (id,agent_id,date,arrivee,zone_id,lat,lon,distance,selfie,statut) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(uuidv4(), agentId, today, time, zoneValidee?.id||null, lat||null, lon||null, Math.round(distanceMin)||null, selfie?1:0, 'valide');
    action = 'arrivee';
  } else if (!existing.depart) {
    db.prepare('UPDATE pointages SET depart=? WHERE agent_id=? AND date=?').run(time, agentId, today);
    action = 'depart';
  } else {
    action = 'already';
  }

  const updated = db.prepare('SELECT * FROM pointages WHERE agent_id=? AND date=?').get(agentId, today);
  res.json({ action, pointage: updated, zone: zoneValidee });
});

// PUT /api/agent-app/profile — mettre à jour son profil
router.put('/profile', authMiddleware, (req, res) => {
  const agentId = req.user.agent_id || req.user.id;
  const { nom, prenom, tel, email, photo_base64 } = req.body;
  db.prepare('UPDATE agents SET nom=?,prenom=?,tel=?,email=?,photo_base64=?,updated_at=? WHERE id=?')
    .run(nom, prenom||'', tel||'', email||'', photo_base64||null, new Date().toISOString(), agentId);
  res.json({ success: true });
});

module.exports = router;
