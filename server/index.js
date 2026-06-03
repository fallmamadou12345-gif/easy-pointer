const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const db = require('./database');

db.ready.then(() => {
  app.use('/api/auth',      require('./routes/auth'));
  app.use('/api/agents',    require('./routes/agents'));
  app.use('/api/zones',     require('./routes/zones'));
  app.use('/api/pointages', require('./routes/pointages'));
  app.use('/api/planning',  require('./routes/planning'));
  app.use('/api/rapports',  require('./routes/rapports'));
  app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  const clientBuild = path.join(__dirname, '../client/dist');
  if (fs.existsSync(clientBuild)) {
    app.use(express.static(clientBuild));

    // Route /agent → app mobile agent
    app.get('/agent', (req, res) => {
      const agentHtml = path.join(clientBuild, 'agent.html');
      if (fs.existsSync(agentHtml)) res.sendFile(agentHtml);
      else res.sendFile(path.join(clientBuild, 'index.html'));
    });
    app.get('/agent/*', (req, res) => {
      const agentHtml = path.join(clientBuild, 'agent.html');
      if (fs.existsSync(agentHtml)) res.sendFile(agentHtml);
      else res.sendFile(path.join(clientBuild, 'index.html'));
    });

    // Tout le reste → admin SPA
    app.get('*', (req, res) => res.sendFile(path.join(clientBuild, 'index.html')));
  } else {
    app.get('/', (req, res) => res.json({ message: 'Easy Pointer API v1.0 — build frontend first' }));
  }

  app.listen(PORT, () => {
    console.log(`✅ Easy Pointer démarré sur le port ${PORT}`);
    console.log(`   Admin  : http://localhost:${PORT}/`);
    console.log(`   Agent  : http://localhost:${PORT}/agent`);
  });
}).catch(err => { console.error('❌ Erreur DB:', err); process.exit(1); });
