const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──
app.use(cors());
app.use(express.json());

// ── Base de données ──
const db = require('./database');

// ── Routes API ──
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/agents',  require('./routes/agents'));
app.use('/api/zones',   require('./routes/zones'));
app.use('/api/pointages', require('./routes/pointages'));
app.use('/api/planning', require('./routes/planning'));
app.use('/api/rapports', require('./routes/rapports'));

// ── Servir le frontend React compilé ──
const clientBuild = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientBuild)) {
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
} else {
  app.get('/', (req, res) => res.json({ message: 'Easy Pointer API v1.0 - Frontend not built yet' }));
}

app.listen(PORT, () => {
  console.log(`✅ Easy Pointer démarré sur le port ${PORT}`);
  console.log(`   Mode: ${process.env.NODE_ENV || 'development'}`);
});
