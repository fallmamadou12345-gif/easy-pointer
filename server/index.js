const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json({ limit: '15mb' }));

const db = require('./database');
db.ready.then(() => {
  app.use('/api/auth',      require('./routes/auth'));
  app.use('/api/agents',    require('./routes/agents'));
  app.use('/api/zones',     require('./routes/zones'));
  app.use('/api/pointages', require('./routes/pointages'));
  app.use('/api/planning',  require('./routes/planning'));
  app.use('/api/horaires', require('./routes/horaires'));
  app.use('/api/rapports',  require('./routes/rapports'));
  app.use('/api/horaires',  require('./routes/horaires'));
  app.get('/api/health', (req,res) => res.json({status:'ok',time:new Date().toISOString()}));

  const clientBuild = path.join(__dirname,'../client/dist');
  if (fs.existsSync(clientBuild)) {
    app.use(express.static(clientBuild));
    app.get('/agent', (req,res) => { const f=path.join(clientBuild,'agent.html'); fs.existsSync(f)?res.sendFile(f):res.sendFile(path.join(clientBuild,'index.html')); });
    app.get('/agent/*',(req,res) => { const f=path.join(clientBuild,'agent.html'); fs.existsSync(f)?res.sendFile(f):res.sendFile(path.join(clientBuild,'index.html')); });
    app.get('*',(req,res) => res.sendFile(path.join(clientBuild,'index.html')));
  }
  app.listen(PORT, () => { console.log(`✅ Easy Pointer :${PORT} | Admin:/ Agent:/agent`); });
}).catch(e => { console.error('DB error:',e); process.exit(1); });
