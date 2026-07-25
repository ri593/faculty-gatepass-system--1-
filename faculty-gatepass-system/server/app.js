const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const facultyRoutes = require('./routes/facultyRoutes');
const hodRoutes = require('./routes/hodRoutes');
const deanRoutes = require('./routes/deanRoutes');
const registrarRoutes = require('./routes/registrarRoutes');
const securityRoutes = require('./routes/securityRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

// Behind a reverse proxy (Render/Heroku/Nginx) in production so req.ip / rate
// limiting see the real client address instead of the proxy's.
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow QR/PDF <img>/<a> from the client origin
}));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const allowedOrigins = (process.env.CLIENT_ORIGIN || '*')
  .split(',')
  .map((o) => o.trim());
app.use(cors({
  origin: allowedOrigins.includes('*') ? true : allowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Generous global limit against abuse; login has its own tighter limit below.
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again shortly.' },
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait a few minutes and try again.' },
});
app.use('/api/auth/login', loginLimiter);

// Serve generated QR codes and PDF passes (e.g. GET /uploads/qrcodes/GP-1001.png)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Serve frontend
app.use(express.static(path.join(__dirname, '../client')));

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'faculty-gatepass-api', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/hod', hodRoutes);
app.use('/api/dean', deanRoutes);
app.use('/api/registrar', registrarRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/admin', adminRoutes);

// Serve frontend files
app.use(express.static(path.join(__dirname, '../client')));

// Frontend routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/app.html'));
});

// Error handlers (keep these last)
app.use(notFound);
app.use(errorHandler);

module.exports = app;
