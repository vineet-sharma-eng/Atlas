// backend/index.js
const express = require('express');
const dotenv = require('dotenv');

const financeRoutes = require('./routes/finance');

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'Atlas running' });
});

app.use('/finance', financeRoutes);

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
});
