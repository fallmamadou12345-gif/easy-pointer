const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Chemin DB : variable d'env sur Render (disque persistant), sinon local
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/easy_pointer.db');

// Créer le dossier si nécessaire
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(DB_PATH);

// Performances SQLite
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Création des tables ──────────────────────────────────────────────────────
db.exec(`
  -- Utilisateurs (admins, gestionnaires)
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'gestionnaire', -- admin | gestionnaire
    nom         TEXT,
    prenom      TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  -- Agents
  CREATE TABLE IF NOT EXISTS agents (
    id              TEXT PRIMARY KEY,
    nom             TEXT NOT NULL,
    prenom          TEXT,
    poste           TEXT,
    role            TEXT DEFAULT 'Agent',
    contrat         TEXT DEFAULT 'CDI',
    horaire         TEXT DEFAULT '08:00-16:00',
    tel             TEXT,
    email           TEXT,
    date_embauche   TEXT,
    photo_base64    TEXT,
    actif           INTEGER DEFAULT 1,
    zone_defaut     TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
  );

  -- Zones de pointage
  CREATE TABLE IF NOT EXISTS zones (
    id            TEXT PRIMARY KEY,
    nom           TEXT NOT NULL,
    ville         TEXT,
    adresse       TEXT,
    lat           REAL NOT NULL,
    lon           REAL NOT NULL,
    rayon         INTEGER NOT NULL DEFAULT 150,
    couleur       TEXT DEFAULT '#2563eb',
    actif         INTEGER DEFAULT 1,
    cree_par      TEXT,
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
  );

  -- Association agents <-> zones (multi-zones possible)
  CREATE TABLE IF NOT EXISTS agent_zones (
    agent_id    TEXT NOT NULL,
    zone_id     TEXT NOT NULL,
    est_defaut  INTEGER DEFAULT 0,
    PRIMARY KEY (agent_id, zone_id),
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (zone_id)  REFERENCES zones(id)  ON DELETE CASCADE
  );

  -- Pointages
  CREATE TABLE IF NOT EXISTS pointages (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    date        TEXT NOT NULL,
    arrivee     TEXT,
    depart      TEXT,
    zone_id     TEXT,
    lat         REAL,
    lon         REAL,
    distance    REAL,
    selfie      INTEGER DEFAULT 0,
    statut      TEXT DEFAULT 'valide', -- valide | bloque | manuel
    note        TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (agent_id) REFERENCES agents(id),
    UNIQUE(agent_id, date)
  );

  -- Tentatives bloquées (journal sécurité)
  CREATE TABLE IF NOT EXISTS journal_securite (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    timestamp   TEXT NOT NULL,
    lat         REAL,
    lon         REAL,
    zone_id     TEXT,
    distance    REAL,
    raison      TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  -- Planning hebdomadaire
  CREATE TABLE IF NOT EXISTS planning (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    date        TEXT NOT NULL,
    shift_id    TEXT NOT NULL DEFAULT 'repos',
    note        TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now')),
    UNIQUE(agent_id, date),
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
  );
`);

// ── Données initiales ────────────────────────────────────────────────────────
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Admin par défaut
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (id, username, password, role, nom, prenom) VALUES (?,?,?,?,?,?)')
    .run(uuidv4(), 'admin', hash, 'admin', 'Administrateur', 'Easy Pointer');

  const hashGest = bcrypt.hashSync('gest123', 10);
  db.prepare('INSERT INTO users (id, username, password, role, nom, prenom) VALUES (?,?,?,?,?,?)')
    .run(uuidv4(), 'gestionnaire', hashGest, 'gestionnaire', 'Gestionnaire', 'RH');

  console.log('👤 Comptes par défaut créés: admin/admin123 | gestionnaire/gest123');
}

// Zones initiales
const zonesExist = db.prepare('SELECT COUNT(*) as n FROM zones').get();
if (zonesExist.n === 0) {
  const zones = [
    { id:'Z001', nom:'Bureau Principal', ville:'Dakar', adresse:'Almadies, Dakar', lat:14.7298, lon:-17.4973, rayon:150, couleur:'#2563eb' },
    { id:'Z002', nom:'Antenne Mbour',    ville:'Mbour', adresse:'Centre-ville, Mbour', lat:14.3850, lon:-16.9645, rayon:200, couleur:'#7c3aed' },
    { id:'Z003', nom:'Site Plateau',     ville:'Dakar', adresse:'Plateau, Dakar', lat:14.6937, lon:-17.4441, rayon:100, couleur:'#059669' },
  ];
  const insZone = db.prepare('INSERT INTO zones (id,nom,ville,adresse,lat,lon,rayon,couleur,cree_par) VALUES (?,?,?,?,?,?,?,?,?)');
  zones.forEach(z => insZone.run(z.id, z.nom, z.ville, z.adresse, z.lat, z.lon, z.rayon, z.couleur, 'system'));

  // Agents initiaux
  const agents = [
    { id:'A001', nom:'Aminja',      prenom:'Kouyaté',  poste:'Responsable Terrain',     contrat:'CDI', horaire:'08:00-16:00', tel:'+221770000001', zone:'Z001' },
    { id:'A002', nom:'Benjaminja',  prenom:'Diallo',   poste:'Chargé de Clientèle',     contrat:'CDD', horaire:'08:00-16:00', tel:'+221770000002', zone:'Z001' },
    { id:'A003', nom:'Naïka',       prenom:'Sow',      poste:'Assistante Administrative',contrat:'CDI', horaire:'09:00-17:00', tel:'+221770000003', zone:'Z002' },
    { id:'A004', nom:'Hadija',      prenom:'Camara',   poste:'Opératrice de Saisie',    contrat:'CDD', horaire:'08:00-16:00', tel:'+221770000004', zone:'Z001' },
    { id:'A005', nom:'Nahedijanya', prenom:'Fall',     poste:'Chargée de Recouvrement', contrat:'CDI', horaire:'09:00-17:00', tel:'+221770000005', zone:'Z003' },
    { id:'A006', nom:'Grâce',       prenom:'Mendy',    poste:'Téléconseillère',          contrat:'CDI', horaire:'08:00-16:00', tel:'+221770000006', zone:'Z001' },
  ];
  const insAgent = db.prepare('INSERT INTO agents (id,nom,prenom,poste,contrat,horaire,tel,zone_defaut) VALUES (?,?,?,?,?,?,?,?)');
  const insAZ = db.prepare('INSERT INTO agent_zones (agent_id,zone_id,est_defaut) VALUES (?,?,1)');
  agents.forEach(a => {
    insAgent.run(a.id, a.nom, a.prenom, a.poste, a.contrat, a.horaire, a.tel, a.zone);
    insAZ.run(a.id, a.zone);
  });

  console.log('📍 Zones et agents initiaux créés');
}

module.exports = db;
