import express from 'express';
import 'dotenv/config';
import { pool } from './db.js';

const app = express();
app.use(express.json());

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '401 Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  if (token !== process.env.API_SECRET_TOKEN) {
    return res.status(401).json({ error: '401 Unauthorized' });
  }

  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Missing user identity' });
  }

  req.user = { id: userId };
  next();
};

app.post('/jobs', requireAuth, async (req, res) => {
  const { idempotencyKey } = req.body;
  const userId = req.user.id;

  if (!idempotencyKey) {
    return res.status(400).json({ error: 'idempotencyKey is required' });
  }

  try {
    const [existing] = await pool.execute(
      'SELECT id, status FROM jobs WHERE user_id = ? AND idempotency_key = ?',
      [userId, idempotencyKey]
    );

    if (existing.length > 0) {
      return res.status(200).json({
        jobId: existing[0].id,
        status: existing[0].status,
        message: 'Job already registered'
      });
    }

    const [result] = await pool.execute(
      'INSERT INTO jobs (user_id, idempotency_key, status) VALUES (?, ?, ?)',
      [userId, idempotencyKey, 'pending']
    );

    return res.status(202).json({
      jobId: result.insertId,
      status: 'pending'
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const [raceJob] = await pool.execute(
        'SELECT id, status FROM jobs WHERE user_id = ? AND idempotency_key = ?',
        [userId, idempotencyKey]
      );
      return res.status(200).json({
        jobId: raceJob[0].id,
        status: raceJob[0].status
      });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/jobs/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, status, result, error FROM jobs WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = rows[0];
    return res.status(200).json({
      jobId: job.id,
      status: job.status,
      result: job.result,
      error: job.error
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/', (req, res) => {
  res.json({
    message: "Background Job Service API is running!",
    endpoints: {
      submitJob: "POST /jobs",
      checkJob: "GET /jobs/:id"
    }
  });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
