// backend/index.js
const express = require('express');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: false });

const financeRoutes = require('./routes/finance');
const gymRoutes = require('./routes/gym');
const { startCronJobs } = require('./services/scheduler/cron');

const app = express();
const port = Number(process.env.PORT) || 5001;
const frontendDistPath = path.resolve(__dirname, '..', 'frontend', 'dist');
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'Atlas running' });
});

app.use('/finance', financeRoutes);
app.use('/gym', gymRoutes);

if (isProduction) {
  app.use(express.static(frontendDistPath));

  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/finance') || req.path.startsWith('/gym') || req.path === '/health') {
      return next();
    }

    return res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error(err);

  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal server error',
  });
});

app.listen(port, () => {
  console.log(`Atlas backend running on port ${port}`);
  startCronJobs();
});
