const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'easy-pointer-secret-2024';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Identifiants requis' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, nom: user.nom, prenom: user.prenom },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, user: { id: user.id, username: user.username, role: user.role, nom: user.nom, prenom: user.prenom } });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

// GET /api/auth/users — admin seulement
router.get('/users', authMiddleware, adminOnly, (req, res) => {
  const users = db.prepare('SELECT id,username,role,nom,prenom,created_at FROM users').all();
  res.json(users);
});

// POST /api/auth/users — créer un utilisateur
router.post('/users', authMiddleware, adminOnly, (req, res) => {
  const { username, password, role, nom, prenom } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username et password requis' });
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'Nom d\'utilisateur déjà utilisé' });
  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id,username,password,role,nom,prenom) VALUES (?,?,?,?,?,?)')
    .run(id, username, hash, role || 'gestionnaire', nom || '', prenom || '');
  res.json({ success: true, id });
});

// PUT /api/auth/password — changer son propre mot de passe
router.put('/password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ success: true });
});

module.exports = router;
