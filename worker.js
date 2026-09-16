import 'dotenv/config';
import { pool } from './db.js';

const STALE_LOCK_INTERVAL_SQL = 'INTERVAL 5 MINUTE';

async function fetchAndLockJob() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(`
      SELECT id, attempts, max_attempts
      FROM jobs
      WHERE (
        status = 'pending' 
        OR (status = 'processing' AND locked_at < NOW() - ${STALE_LOCK_INTERVAL_SQL})
      )
      AND attempts < max_attempts
      ORDER BY id ASC
      LIMIT 1
      FOR UPDATE
    `);

    if (rows.length === 0) {
      await connection.rollback();
      return null;
    }

    const job = rows[0];

    await connection.execute(`
      UPDATE jobs 
      SET status = 'processing', 
          locked_at = NOW(), 
          attempts = attempts + 1 
      WHERE id = ?
    `, [job.id]);

    await connection.commit();
    return job;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function processJob(job) {
  try {
    console.log(`[Worker] Claimed job #${job.id}, processing...`);
    await new Promise((resolve) => setTimeout(resolve, 4000));

    const resultData = JSON.stringify({ 
      status: 'success', 
      processedAt: new Date().toISOString() 
    });

    await pool.execute(`
      UPDATE jobs 
      SET status = 'completed', 
          result = ?, 
          locked_at = NULL 
      WHERE id = ?
    `, [resultData, job.id]);

    console.log(`[Worker] Job #${job.id} completed successfully.`);
  } catch (err) {
    const isExhausted = job.attempts + 1 >= job.max_attempts;
    const finalStatus = isExhausted ? 'failed' : 'pending';

    await pool.execute(`
      UPDATE jobs 
      SET status = ?, 
          error = ?, 
          locked_at = NULL 
      WHERE id = ?
    `, [finalStatus, err.message, job.id]);

    console.error(`[Worker] Job #${job.id} failed:`, err.message);
  }
}

async function startLoop() {
  console.log('[Worker] Service started and listening for jobs...');
  while (true) {
    try {
      const job = await fetchAndLockJob();
      if (job) {
        await processJob(job);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error('[Worker] Polling error:', error.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

startLoop().catch((err) => {
  console.error('[Worker] Fatal bootstrap error:', err);
});