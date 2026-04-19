require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth.routes');
const studentRoutes = require('./routes/student.routes');
const academicRoutes = require('./routes/academic.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const parentRoutes = require('./routes/parent.routes');
const notificationRoutes = require('./routes/notification.routes');
const chemistryLabRoutes = require('./routes/chemistry-lab.routes');
const { refreshLocalCacheFromFirebase } = require('./utils/data-store');
const { processAllNotificationQueues } = require('./services/notification.service');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store');
  }
}));
app.use('/storage/chemistry-lab/svg', express.static(path.join(__dirname, 'storage', 'chemistry-lab', 'svg'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store');
  }
}));

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/academics', academicRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chemistry-lab', chemistryLabRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'safio-phase1' });
});

async function startServer() {
  await refreshLocalCacheFromFirebase();

  processAllNotificationQueues().catch((error) => {
    console.warn('[SAFIO] Echec traitement initial notifications:', error.message || error);
  });

  setInterval(() => {
    processAllNotificationQueues().catch((error) => {
      console.warn('[SAFIO] Echec traitement automatique notifications:', error.message || error);
    });
  }, 60 * 1000);

  app.listen(PORT, () => {
    console.log(`SAFIO server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('[SAFIO] Demarrage impossible:', error.message || error);
  process.exit(1);
});
