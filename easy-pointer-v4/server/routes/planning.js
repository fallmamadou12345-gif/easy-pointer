const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

// GET public — app agent peut lire son planning
router.get('/', (req, res) => {
  const { date_debut, date_fin, agent_id } = req.query;
  let sql = 'SELECT * FROM planning WHERE 1=1';
  const p = [];
  if (agent_id)  { sql += ' AND agent_id=?'; p.push(agent_id); }
  if (date_debut){ sql += ' AND date>=?'; p.push(date_debut); }
  if (date_fin)  { sql += ' AND date<=?'; p.push(date_fin); }
  res.json(db.prepare(sql).all(...p));
});

// POST/PUT protégés — admin seulement
router.post('/', authMiddleware, (req, res) => {
  const { agent_id, date, shift_id, note } = req.body;
  if (!agent_id || !date) return res.status(400).json({ error: 'agent_id et date requis' });
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM planning WHERE agent_id=? AND date=?').get(agent_id, date);
  if (existing) {
    db.prepare('UPDATE planning SET shift_id=?,note=?,updated_at=? WHERE agent_id=? AND date=?')
      .run(shift_id||'repos', note||null, now, agent_id, date);
  } else {
    db.prepare('INSERT INTO planning (id,agent_id,date,shift_id,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
      .run(uuidv4(), agent_id, date, shift_id||'repos', note||null, now, now);
  }
  res.json({ success: true });
});

router.post('/bulk', authMiddleware, (req, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates doit être un tableau' });
  const now = new Date().toISOString();
  updates.forEach(u => {
    const ex = db.prepare('SELECT id FROM planning WHERE agent_id=? AND date=?').get(u.agent_id, u.date);
    if (ex) {
      db.prepare('UPDATE planning SET shift_id=?,updated_at=? WHERE agent_id=? AND date=?')
        .run(u.shift_id||'repos', now, u.agent_id, u.date);
    } else {
      db.prepare('INSERT INTO planning (id,agent_id,date,shift_id,created_at,updated_at) VALUES (?,?,?,?,?,?)')
        .run(uuidv4(), u.agent_id, u.date, u.shift_id||'repos', now, now);
    }
  });
  res.json({ success: true, count: updates.length });
});

module.exports = router;
