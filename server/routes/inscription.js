/**
 * Routes d'inscription agent (sans auth)
 * POST /api/inscription         — demande d'inscription publique
 * GET  /api/inscription         — liste des demandes (gestionnaire)
 * PUT  /api/inscription/:id     — approuver / rejeter (gestionnaire)
 * DELETE /api/inscription/:id   — supprimer une demande (admin)
 */

const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const db       = require('../database');
const { authMiddleware } = require('../middleware/auth');

function uid() { return 'INS' + String(Date.now()).slice(-8) + Math.random().toString(36).slice(2,5).toUpperCase(); }
function agId() { return 'AG'  + String(Date.now()).slice(-7) + Math.random().toString(36).slice(2,4).toUpperCase(); }

// ── POST /api/inscription — demande publique ──────────────────────────────────
router.post('/', (req, res) => {
  const { nom, prenom, poste, tel, email, contrat, pin, message } = req.body;
  if (!nom || !prenom) return res.status(400).json({ error: 'Nom et prénom requis' });
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin))
    return res.status(400).json({ error: 'Le code PIN doit être exactement 4 chiffres' });

  // Vérifier qu'il n'y a pas déjà une demande en attente avec le même nom+téléphone
  const exist = db.prepare(`
    SELECT id FROM demandes_inscription
    WHERE LOWER(nom)=LOWER(?) AND LOWER(prenom)=LOWER(?) AND statut='en_attente'
  `).get(nom.trim(), prenom.trim());
  if (exist) return res.status(409).json({ error: 'Une demande est déjà en attente pour ce nom.' });

  const id        = uid();
  const pin_hash  = bcrypt.hashSync(pin, 10);
  const now       = new Date().toISOString();

  db.prepare(`
    INSERT INTO demandes_inscription (id,nom,prenom,poste,tel,email,contrat,pin_hash,message,statut,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, nom.trim(), prenom.trim(), poste||'', tel||'', email||'', contrat||'CDI', pin_hash, message||'', 'en_attente', now);

  res.json({ success: true, id, message: 'Demande envoyée. En attente de validation par le gestionnaire.' });
});

// ── GET /api/inscription — liste (gestionnaire) ───────────────────────────────
router.get('/', authMiddleware, (req, res) => {
  const { statut } = req.query;
  let sql = 'SELECT * FROM demandes_inscription';
  const p = [];
  if (statut) { sql += ' WHERE statut=?'; p.push(statut); }
  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...p);
  res.json(rows);
});

// ── GET /api/inscription/count — badge compteur (gestionnaire) ────────────────
router.get('/count', authMiddleware, (req, res) => {
  const n = db.prepare("SELECT COUNT(*) as n FROM demandes_inscription WHERE statut='en_attente'").get()?.n || 0;
  res.json({ count: n });
});

// ── PUT /api/inscription/:id — approuver ou rejeter ───────────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  const { action, heure_debut, heure_fin, tolerance_retard, zone_defaut, zones, note_admin } = req.body;
  if (!['approuver','rejeter'].includes(action))
    return res.status(400).json({ error: 'action doit être approuver ou rejeter' });

  const demande = db.prepare('SELECT * FROM demandes_inscription WHERE id=?').get(req.params.id);
  if (!demande) return res.status(404).json({ error: 'Demande introuvable' });
  if (demande.statut !== 'en_attente')
    return res.status(409).json({ error: `Demande déjà ${demande.statut}` });

  const now = new Date().toISOString();

  if (action === 'rejeter') {
    db.prepare(`UPDATE demandes_inscription SET statut='rejete',note_admin=?,traite_le=?,traite_par=? WHERE id=?`)
      .run(note_admin||'', now, req.user?.nom||'admin', req.params.id);
    return res.json({ success: true, message: 'Demande rejetée' });
  }

  // ── Approbation → créer l'agent ────────────────────────────────────────────
  const agentId = agId();
  db.prepare(`
    INSERT INTO agents (id,nom,prenom,poste,contrat,tel,email,
      heure_debut,heure_fin,tolerance_retard,jours_travail,zone_defaut,actif,pin_hash,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,datetime('now'))
  `).run(
    agentId, demande.nom, demande.prenom, demande.poste||'', demande.contrat||'CDI',
    demande.tel||'', demande.email||'',
    heure_debut||'08:00', heure_fin||'16:00', tolerance_retard||15,
    '1,2,3,4,5', zone_defaut||'',
    demande.pin_hash   // réutiliser le hash du PIN saisi à l'inscription
  );

  // Assigner les zones
  if (Array.isArray(zones) && zones.length) {
    zones.forEach(zid =>
      db.prepare('INSERT OR IGNORE INTO agent_zones (agent_id,zone_id,est_defaut) VALUES (?,?,?)')
        .run(agentId, zid, zid===zone_defaut?1:0)
    );
  }

  // Mettre à jour la demande
  db.prepare(`UPDATE demandes_inscription SET statut='approuve',agent_id=?,note_admin=?,traite_le=?,traite_par=? WHERE id=?`)
    .run(agentId, note_admin||'', now, req.user?.nom||'admin', req.params.id);

  res.json({ success: true, agent_id: agentId, message: `Agent ${demande.nom} créé avec succès` });
});

// ── DELETE /api/inscription/:id ───────────────────────────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM demandes_inscription WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
