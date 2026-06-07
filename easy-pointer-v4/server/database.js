const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// ── Chemin base de données ──────────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/easy_pointer.db');
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// ── Initialisation sql.js (SQLite pur JS, pas de compilation native) ────────
const initSqlJs = require('sql.js');

let db = null;
let saveInterval = null;

function saveDb() {
  if (!db) return;
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('Erreur sauvegarde DB:', e.message);
  }
}

async function initDatabase() {
  const SQL = await initSqlJs();

  // Charger la DB existante ou en créer une nouvelle
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('📂 Base de données chargée depuis', DB_PATH);
  } else {
    db = new SQL.Database();
    console.log('🆕 Nouvelle base de données créée');
  }

  // Sauvegarder automatiquement toutes les 30 secondes
  saveInterval = setInterval(saveDb, 30000);

  // Sauvegarder à la fermeture
  process.on('exit', saveDb);
  process.on('SIGINT', () => { saveDb(); process.exit(0); });
  process.on('SIGTERM', () => { saveDb(); process.exit(0); });

  createTables();
  seedData();
  saveDb();

  return db;
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'gestionnaire',
      nom TEXT,
      prenom TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      prenom TEXT,
      poste TEXT,
      role TEXT DEFAULT 'Agent',
      contrat TEXT DEFAULT 'CDI',
      horaire TEXT DEFAULT '08:00-16:00',
      tel TEXT,
      email TEXT,
      date_embauche TEXT,
      photo_base64 TEXT,
      actif INTEGER DEFAULT 1,
      zone_defaut TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS zones (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      ville TEXT,
      adresse TEXT,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      rayon INTEGER NOT NULL DEFAULT 150,
      couleur TEXT DEFAULT '#2563eb',
      actif INTEGER DEFAULT 1,
      cree_par TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_zones (
      agent_id TEXT NOT NULL,
      zone_id TEXT NOT NULL,
      est_defaut INTEGER DEFAULT 0,
      PRIMARY KEY (agent_id, zone_id)
    );

    CREATE TABLE IF NOT EXISTS pointages (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      date TEXT NOT NULL,
      arrivee TEXT,
      depart TEXT,
      zone_id TEXT,
      lat REAL,
      lon REAL,
      distance REAL,
      selfie INTEGER DEFAULT 0,
      statut TEXT DEFAULT 'valide',
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(agent_id, date)
    );

    CREATE TABLE IF NOT EXISTS journal_securite (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      lat REAL,
      lon REAL,
      zone_id TEXT,
      distance REAL,
      raison TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS planning (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      date TEXT NOT NULL,
      shift_id TEXT NOT NULL DEFAULT 'repos',
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(agent_id, date)
    );
  `);
  console.log('✅ Tables créées/vérifiées');
}

function seedData() {
  // Vérifier si admin existe
  const adminCheck = db.exec("SELECT id FROM users WHERE username = 'admin'");
  if (adminCheck.length === 0 || adminCheck[0].values.length === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    const hashGest = bcrypt.hashSync('gest123', 10);
    db.run('INSERT INTO users (id,username,password,role,nom,prenom) VALUES (?,?,?,?,?,?)',
      [uuidv4(), 'admin', hash, 'admin', 'Administrateur', 'Easy Pointer']);
    db.run('INSERT INTO users (id,username,password,role,nom,prenom) VALUES (?,?,?,?,?,?)',
      [uuidv4(), 'gestionnaire', hashGest, 'gestionnaire', 'Gestionnaire', 'RH']);
    console.log('👤 Comptes créés: admin/admin123 | gestionnaire/gest123');
  }

  const zonesCheck = db.exec('SELECT COUNT(*) as n FROM zones');
  const zonesCount = zonesCheck[0]?.values[0][0] || 0;

  if (zonesCount === 0) {
    const zones = [
      ['Z001','Bureau Principal','Dakar','Almadies, Dakar',14.7298,-17.4973,150,'#2563eb'],
      ['Z002','Antenne Mbour','Mbour','Centre-ville, Mbour',14.3850,-16.9645,200,'#7c3aed'],
      ['Z003','Site Plateau','Dakar','Plateau, Dakar',14.6937,-17.4441,100,'#059669'],
    ];
    zones.forEach(z => db.run(
      'INSERT INTO zones (id,nom,ville,adresse,lat,lon,rayon,couleur,cree_par) VALUES (?,?,?,?,?,?,?,?,?)',
      [...z, 'system']
    ));

    const agents = [
      ['A001','Aminja','Kouyaté','Responsable Terrain','CDI','08:00-16:00','+221770000001','Z001'],
      ['A002','Benjaminja','Diallo','Chargé de Clientèle','CDD','08:00-16:00','+221770000002','Z001'],
      ['A003','Naïka','Sow','Assistante Administrative','CDI','09:00-17:00','+221770000003','Z002'],
      ['A004','Hadija','Camara','Opératrice de Saisie','CDD','08:00-16:00','+221770000004','Z001'],
      ['A005','Nahedijanya','Fall','Chargée de Recouvrement','CDI','09:00-17:00','+221770000005','Z003'],
      ['A006','Grâce','Mendy','Téléconseillère','CDI','08:00-16:00','+221770000006','Z001'],
    ];
    agents.forEach(a => {
      db.run('INSERT INTO agents (id,nom,prenom,poste,contrat,horaire,tel,zone_defaut) VALUES (?,?,?,?,?,?,?,?)', a);
      db.run('INSERT INTO agent_zones (agent_id,zone_id,est_defaut) VALUES (?,?,1)', [a[0], a[7]]);
    });
    console.log('📍 Zones et agents initiaux créés');
  }
}

// ── API compatible avec l'ancienne interface better-sqlite3 ─────────────────
// On expose un objet "db" avec les mêmes méthodes .prepare().all() etc.
function makeDb() {
  return {
    _raw: null,

    setRaw(rawDb) { this._raw = rawDb; },

    // Exécuter une requête sans retour
    run(sql, params = []) {
      this._raw.run(sql, params);
      // Auto-save après modification
      clearTimeout(this._saveTimeout);
      this._saveTimeout = setTimeout(saveDb, 2000);
    },

    // Préparer une requête (retourne un objet avec .all(), .get(), .run())
    prepare(sql) {
      const self = this;
      return {
        sql,
        all(...args) {
          const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
          try {
            const result = self._raw.exec(sql, params);
            if (!result.length) return [];
            const { columns, values } = result[0];
            return values.map(row => {
              const obj = {};
              columns.forEach((col, i) => obj[col] = row[i]);
              return obj;
            });
          } catch (e) {
            console.error('DB query error:', sql, e.message);
            return [];
          }
        },
        get(...args) {
          const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
          try {
            const result = self._raw.exec(sql, params);
            if (!result.length || !result[0].values.length) return undefined;
            const { columns, values } = result[0];
            const obj = {};
            columns.forEach((col, i) => obj[col] = values[0][i]);
            return obj;
          } catch (e) {
            console.error('DB get error:', sql, e.message);
            return undefined;
          }
        },
        run(...args) {
          const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
          self._raw.run(sql, params);
          clearTimeout(self._saveTimeout);
          self._saveTimeout = setTimeout(saveDb, 2000);
        }
      };
    },

    // Transaction simple
    transaction(fn) {
      return () => {
        this._raw.run('BEGIN');
        try {
          fn();
          this._raw.run('COMMIT');
        } catch (e) {
          this._raw.run('ROLLBACK');
          throw e;
        }
      };
    },

    exec(sql) {
      return this._raw.exec(sql);
    },

    pragma() {}, // No-op pour compatibilité
  };
}

const dbProxy = makeDb();

// Initialisation asynchrone — on attend avant de démarrer le serveur
let initialized = false;
const initPromise = initDatabase().then(rawDb => {
  dbProxy.setRaw(rawDb);
  db = rawDb;
  initialized = true;
  console.log('✅ Base de données prête');
});

dbProxy.ready = initPromise;
module.exports = dbProxy;
