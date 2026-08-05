import { createServer } from 'http';
import next from 'next';
import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './backend/routes/authRoutes.js';
import logsRoutes from './backend/routes/logsRoutes.js';
import userRoutes from './backend/routes/userRoutes.js';
import employeeRoutes from './backend/routes/employeeRoutes.js';
import registrarRoutes from './backend/routes/registrarRoutes.js';

dotenv.config();

const port = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  const server = express();
  server.use(express.json());

  server.use('/api/auth', authRoutes);
  server.use('/api/logs', logsRoutes);
  server.use('/api/users', userRoutes);
  server.use('/api/employees', employeeRoutes);
  server.use('/api/registrars', registrarRoutes);

  server.get('/api', (req, res) => {
    res.json({ message: 'Likenew Laundry API is running!' });
  });

  // Global API error handler
  server.use('/api', (err, req, res, next) => {
    console.error('🔥 Global Error Logged:', err.stack);
    res.status(500).json({ message: 'A server error occurred', error: err.message });
  });

  server.all(/.*/, (req, res) => handle(req, res));

  createServer(server).listen(port, () => {
    console.log(`🚀 Ready on port ${port} (${dev ? 'development' : 'production'})`);
  });
});
