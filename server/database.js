const path = require('path');
const fs   = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/easy_pointer.db');
const dbDir   = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const initSqlJs = require('sql.js');
let db = null;

function saveDb() {
  if (!db) return;
  try { fs.writeFileSync(DB_PATH, Buffer.from(db.export())); } catch(e) {}
}

async function initDatabase() {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();

  setInterval(saveDb, 30000);
  process.on('exit', saveDb);
  process.on('SIGINT',  () => { saveDb(); process.exit(0); });
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
      nom TEXT, prenom TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS horaires_types (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      heure_debut TEXT NOT NULL DEFAULT '08:00',
      heure_fin TEXT NOT NULL DEFAULT '16:00',
      tolerance_retard INTEGER NOT NULL DEFAULT 15,
      pause_midi INTEGER DEFAULT 0,
      jours_travail TEXT DEFAULT '1,2,3,4,5',
      couleur TEXT DEFAULT '#2563eb',
      actif INTEGER DEFAULT 1,
      created_by TEXT,
      pin_hash TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      prenom TEXT,
      poste TEXT,
      role TEXT DEFAULT 'Agent',
      contrat TEXT DEFAULT 'CDI',
      tel TEXT, email TEXT,
      date_embauche TEXT,
      photo_base64 TEXT,
      actif INTEGER DEFAULT 1,
      zone_defaut TEXT,
      horaire_type_id TEXT,
      heure_debut TEXT DEFAULT '08:00',
      heure_fin TEXT DEFAULT '16:00',
      tolerance_retard INTEGER DEFAULT 15,
      jours_travail TEXT DEFAULT '1,2,3,4,5',
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
      lat REAL, lon REAL, distance REAL,
      selfie INTEGER DEFAULT 0,
      statut TEXT DEFAULT 'valide',
      retard_minutes INTEGER DEFAULT 0,
      depart_anticipe_minutes INTEGER DEFAULT 0,
      heures_sup_minutes INTEGER DEFAULT 0,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(agent_id, date)
    );

    CREATE TABLE IF NOT EXISTS absences (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      date TEXT NOT NULL,
      type TEXT DEFAULT 'absence',
      justifie INTEGER DEFAULT 0,
      motif TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(agent_id, date)
    );

    CREATE TABLE IF NOT EXISTS journal_securite (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      lat REAL, lon REAL,
      zone_id TEXT, distance REAL,
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

    CREATE TABLE IF NOT EXISTS demandes_inscription (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      poste TEXT,
      tel TEXT,
      email TEXT,
      contrat TEXT DEFAULT 'CDI',
      pin_hash TEXT NOT NULL,
      message TEXT,
      statut TEXT NOT NULL DEFAULT 'en_attente',
      agent_id TEXT,
      note_admin TEXT,
      traite_le TEXT,
      traite_par TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    console.log('✅ Tables créées/vérifiées');
}

function seedData() {
  const adminCheck = db.exec("SELECT id FROM users WHERE username='admin'");
  if (!adminCheck.length || !adminCheck[0].values.length) {
    db.run('INSERT INTO users (id,username,password,role,nom,prenom) VALUES (?,?,?,?,?,?)',
      [uuidv4(),'admin',bcrypt.hashSync('admin123',10),'admin','Administrateur','Easy Pointer']);
    db.run('INSERT INTO users (id,username,password,role,nom,prenom) VALUES (?,?,?,?,?,?)',
      [uuidv4(),'gestionnaire',bcrypt.hashSync('gest123',10),'gestionnaire','Gestionnaire','RH']);
    console.log('👤 Comptes: admin/admin123 | gestionnaire/gest123');
  }

  const ht = db.exec('SELECT COUNT(*) as n FROM horaires_types');
  if (!ht.length || ht[0].values[0][0] === 0) {
    const types = [
      ['HT001','Journée standard','08:00','16:00',15,0,'1,2,3,4,5','#2563eb'],
      ['HT002','Matinée','06:00','14:00',15,0,'1,2,3,4,5','#d97706'],
      ['HT003','Après-midi','10:00','18:00',15,0,'1,2,3,4,5','#7c3aed'],
      ['HT004','Soir','14:00','22:00',15,0,'1,2,3,4,5','#ea580c'],
      ['HT005','Demi-journée matin','08:00','12:00',10,0,'1,2,3,4,5','#059669'],
    ];
    types.forEach(t => db.run(
      'INSERT INTO horaires_types (id,nom,heure_debut,heure_fin,tolerance_retard,pause_midi,jours_travail,couleur) VALUES (?,?,?,?,?,?,?,?)',
      t
    ));
    console.log('🕐 Modèles horaires créés');
  }

  const zonesCheck = db.exec('SELECT COUNT(*) as n FROM zones');
  if (!zonesCheck.length || zonesCheck[0].values[0][0] === 0) {
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
      ['A001','Aminja','Kouyaté','Responsable Terrain','CDI','HT001','08:00','16:00',15,'1,2,3,4,5','Z001'],
      ['A002','Benjaminja','Diallo','Chargé Clientèle','CDD','HT001','08:00','16:00',15,'1,2,3,4,5','Z001'],
      ['A003','Naïka','Sow','Assistante Admin','CDI','HT003','10:00','18:00',15,'1,2,3,4,5','Z002'],
      ['A004','Hadija','Camara','Opératrice Saisie','CDD','HT001','08:00','16:00',15,'1,2,3,4,5','Z001'],
      ['A005','Nahedijanya','Fall','Chargée Recouvrement','CDI','HT001','09:00','17:00',15,'1,2,3,4,5','Z003'],
      ['A006','Grâce','Mendy','Téléconseillère','CDI','HT002','06:00','14:00',15,'1,2,3,4,5','Z001'],
    ];
    agents.forEach(a => {
      db.run('INSERT INTO agents (id,nom,prenom,poste,contrat,horaire_type_id,heure_debut,heure_fin,tolerance_retard,jours_travail,zone_defaut) VALUES (?,?,?,?,?,?,?,?,?,?,?)', a);
      db.run('INSERT INTO agent_zones (agent_id,zone_id,est_defaut) VALUES (?,?,1)', [a[0], a[10]]);
    });
    // Pointages demo sur 30 jours
    const now = new Date();
    agents.forEach(a => {
      for (let i = 1; i <= 28; i++) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const dow = d.getDay();
        if (dow === 0 || dow === 6) continue; // weekend
        const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const rand = Math.random();
        if (rand < 0.08) continue; // 8% absent
        const retard = rand < 0.18 ? Math.floor(Math.random()*45)+5 : 0;
        const arrH = 8 + Math.floor(retard/60), arrM = retard % 60;
        const arrivee = `${String(arrH).padStart(2,'0')}:${String(arrM).padStart(2,'0')}:00`;
        const supMin = rand > 0.85 ? Math.floor(Math.random()*60)+15 : 0;
        const depMin = 16*60 + supMin - Math.floor(Math.random()*10);
        const depart = `${String(Math.floor(depMin/60)).padStart(2,'0')}:${String(depMin%60).padStart(2,'0')}:00`;
        const depAnticipe = rand < 0.1 && retard===0 ? Math.floor(Math.random()*30)+5 : 0;
        try {
          db.run('INSERT OR IGNORE INTO pointages (id,agent_id,date,arrivee,depart,zone_id,statut,retard_minutes,heures_sup_minutes,depart_anticipe_minutes) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [uuidv4(), a[0], ds, arrivee, depart, a[10], 'valide', retard, supMin, depAnticipe]);
        } catch(e) {}
      }
    });
    console.log('📍 Données démo créées (zones, agents, pointages)');
  }
}

// ── Proxy compatible better-sqlite3 ──────────────────────────────────────────
let saveTimer = null;
const dbProxy = {
  _raw: null,
  ready: null,
  run(sql, params=[]) {
    this._raw.run(sql, params);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDb, 2000);
  },
  prepare(sql) {
    const self = this;
    return {
      all(...args) {
        const p = args.length===1&&Array.isArray(args[0]) ? args[0] : args;
        try {
          const r = self._raw.exec(sql, p.length?p:undefined);
          if (!r.length) return [];
          return r[0].values.map(row => {
            const obj={}; r[0].columns.forEach((c,i)=>obj[c]=row[i]); return obj;
          });
        } catch(e) { console.error('DB.all error:',sql.slice(0,60),e.message); return []; }
      },
      get(...args) {
        const p = args.length===1&&Array.isArray(args[0]) ? args[0] : args;
        try {
          const r = self._raw.exec(sql, p.length?p:undefined);
          if (!r.length||!r[0].values.length) return undefined;
          const obj={}; r[0].columns.forEach((c,i)=>obj[c]=r[0].values[0][i]); return obj;
        } catch(e) { return undefined; }
      },
      run(...args) {
        const p = args.length===1&&Array.isArray(args[0]) ? args[0] : args;
        self._raw.run(sql, p.length?p:undefined);
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveDb, 2000);
      }
    };
  },
  exec(sql) { return this._raw.exec(sql); },
  pragma() {},
};

dbProxy.ready = initDatabase().then(raw => {
  dbProxy._raw = raw;
  db = raw;
  console.log('✅ DB prête');
});
module.exports = dbProxy;
