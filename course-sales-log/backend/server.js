require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { handleFilterError } = require('./lib/filters');

const app = express();

// Only trust X-Forwarded-For when a proxy that overwrites it is actually in
// front. This app listens directly on :4000, so trusting it unconditionally
// would let any client set its own req.ip and walk straight past the login
// throttle by sending a different X-Forwarded-For on each attempt.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
}
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true, // the dashboard session rides on a cookie
}));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use(require('./routes/auth'));
app.use(require('./routes/users'));
app.use(require('./routes/roles'));
app.use(require('./routes/config'));
app.use(require('./routes/sales'));
app.use(require('./routes/dashboard'));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // A bad query param is the caller's mistake, not a server fault.
  if (handleFilterError(err, res)) return;
  console.error('[error]', err.message);
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
