import { Router } from 'express';
import pool from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('admin', 'doctor', 'receptionist'));

router.get('/admissions-trend', async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS registrations
     FROM patients WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
     GROUP BY DATE(created_at) ORDER BY day`
  );
  res.json(rows);
});

router.get('/department-workload', async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT u.department, COUNT(a.id) AS appointment_count
     FROM users u
     LEFT JOIN appointments a ON a.doctor_id = u.id AND a.scheduled_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     WHERE u.role = 'doctor' AND u.is_active = 1
     GROUP BY u.id, u.department`
  );
  res.json(rows);
});

router.get('/resource-utilization', async (_req, res) => {
  const [beds] = await pool.query(
    `SELECT status, COUNT(*) AS cnt FROM icu_beds GROUP BY status`
  );
  const [inv] = await pool.query(
    `SELECT SUM(quantity) AS total_units, SUM(CASE WHEN quantity < reorder_threshold THEN 1 ELSE 0 END) AS low_items
     FROM inventory_items`
  );
  res.json({ icuBedsByStatus: beds, inventory: inv[0] });
});

router.get('/summary-stats', async (_req, res) => {
  const [[p]] = await pool.query('SELECT COUNT(*) AS c FROM patients');
  const [[a]] = await pool.query(
    `SELECT COUNT(*) AS c FROM appointments WHERE status = 'scheduled' AND scheduled_at >= CURDATE()`
  );
  const [[b]] = await pool.query(`SELECT COUNT(*) AS c FROM bills WHERE status = 'pending'`);
  const [[icu]] = await pool.query(`SELECT COUNT(*) AS c FROM icu_beds WHERE status = 'occupied'`);
  res.json({
    totalPatients: p.c,
    upcomingAppointments: a.c,
    pendingBills: b.c,
    occupiedIcuBeds: icu.c,
  });
});

export default router;
