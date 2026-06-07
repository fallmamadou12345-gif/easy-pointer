# 🟠 Easy Pointer — Kéditou v1.0

Système de gestion des présences avec géofencing GPS, anti-fraude et reporting RH.

---

## 🚀 Déploiement sur Render (100% gratuit)

### Étape 1 — Pousser sur GitHub

```bash
git init
git add .
git commit -m "Initial commit — Easy Pointer v1.0"
git remote add origin https://github.com/VOTRE_COMPTE/easy-pointer.git
git push -u origin main
```

### Étape 2 — Créer le service sur Render

1. Aller sur **https://render.com** → Sign in
2. Cliquer **New +** → **Web Service**
3. Connecter votre repo GitHub `easy-pointer`
4. Render détecte automatiquement le `render.yaml`

**Ou configurer manuellement :**
| Champ | Valeur |
|-------|--------|
| **Name** | easy-pointer |
| **Region** | Frankfurt (EU) |
| **Branch** | main |
| **Build Command** | `npm run render:build` |
| **Start Command** | `npm run render:start` |
| **Plan** | Free |

### Étape 3 — Variables d'environnement

Dans Render → votre service → **Environment** :

| Variable | Valeur |
|----------|--------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | (cliquer "Generate") |
| `PORT` | `10000` |
| `DB_PATH` | `/opt/render/project/data/easy_pointer.db` |

### Étape 4 — Disque persistant (IMPORTANT)

Dans Render → **Disks** → **Add Disk** :
| Champ | Valeur |
|-------|--------|
| **Name** | easy-pointer-data |
| **Mount Path** | `/opt/render/project/data` |
| **Size** | 1 GB |

⚠️ Sans disque persistant, la base de données est réinitialisée à chaque redéploiement !

### Étape 5 — Déployer

Cliquer **Create Web Service** → le build démarre automatiquement (~3 minutes).

Votre URL : `https://easy-pointer.onrender.com`

---

## 🔐 Accès par défaut

| Compte | Identifiant | Mot de passe |
|--------|-------------|--------------|
| Administrateur | `admin` | `admin123` |
| Gestionnaire | `gestionnaire` | `gest123` |

**⚠️ Changer les mots de passe après le premier déploiement !**

---

## 📱 Fonctionnalités

### Tableau de bord Admin
- Vue temps réel des présences du jour
- KPIs : présents, sortis, absents, heures du mois

### Pointage
- Simulation QR bureau
- Correction manuelle des heures
- Horodatage automatique

### Planning
- Grille hebdomadaire par agent
- 6 types de shifts (Matin, Journée, Après-midi, Soir, Repos, Congé)
- Navigation semaine précédente/suivante

### Agents
- CRUD complet avec photo de profil
- Contrat CDI/CDD/Stage/Freelance
- Assignation multi-zones

### Zones GPS (Géofencing)
- Création de zones avec coordonnées GPS et rayon
- Assignation des agents par zone
- Activation/désactivation
- Anti-fraude : pointage bloqué hors-zone

### Rapports RH
- Rapport mensuel/annuel par agent
- Heures travaillées, supplémentaires, déficit, balance
- **Export CSV** compatible Excel (BOM UTF-8)

---

## 🛠️ Développement local

```bash
# 1. Installer les dépendances
npm run install:all

# 2. Lancer le backend
npm run dev:server   # http://localhost:3001

# 3. Lancer le frontend (nouveau terminal)
npm run dev:client   # http://localhost:5173
```

---

## 📁 Structure du projet

```
easy-pointer/
├── server/
│   ├── index.js          # Serveur Express
│   ├── database.js       # SQLite + tables + données initiales
│   ├── middleware/
│   │   └── auth.js       # JWT middleware
│   └── routes/
│       ├── auth.js       # Login, utilisateurs
│       ├── agents.js     # CRUD agents
│       ├── zones.js      # CRUD zones GPS
│       ├── pointages.js  # Pointage + géofencing + journal
│       ├── planning.js   # Planning shifts
│       └── rapports.js   # Calculs RH + export CSV
├── client/
│   ├── src/
│   │   ├── App.jsx       # Interface React complète
│   │   ├── api.js        # Couche API centralisée
│   │   └── index.css     # Styles globaux
│   └── package.json
├── render.yaml           # Config déploiement Render
├── package.json          # Scripts monorepo
└── .gitignore
```

---

## 🌍 Architecture technique

- **Backend** : Node.js + Express
- **Base de données** : SQLite (better-sqlite3) — légère, sans serveur
- **Auth** : JWT (JSON Web Tokens)
- **Frontend** : React 18 + Vite
- **Déploiement** : Render Free Tier
- **Anti-fraude GPS** : Formule Haversine pour calcul de distance

---

## 📈 Limites du plan gratuit Render

| Ressource | Limite |
|-----------|--------|
| CPU | 0.1 vCPU partagé |
| RAM | 512 MB |
| Disque | 1 GB |
| Bande passante | 100 GB/mois |
| **Cold start** | ~30 sec après 15 min d'inactivité |

Pour 20+ agents actifs : envisager le plan **Starter ($7/mois)** pour éviter les cold starts.

---

*Easy Pointer v1.0 — SY TRANSPORT / NDONGO FALL · Dakar, Sénégal*
