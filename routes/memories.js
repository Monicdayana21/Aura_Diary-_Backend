const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// ============ MEMORIES ============

// Get all memories
router.get('/', auth, async (req, res) => {
  try {
    const { year, month } = req.query;
    let query = 'SELECT * FROM memories WHERE user_id = $1';
    let params = [req.user.id];
    let paramCount = 1;

    if (year) {
      paramCount++;
      query += ` AND EXTRACT(YEAR FROM memory_date) = $${paramCount}`;
      params.push(parseInt(year));
    }
    if (month) {
      paramCount++;
      query += ` AND EXTRACT(MONTH FROM memory_date) = $${paramCount}`;
      params.push(parseInt(month));
    }

    query += ' ORDER BY memory_date DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create memory
router.post('/', auth, upload.array('files', 10), async (req, res) => {
  try {
    const { title, content, memory_date, tags } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const filePaths = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

    const result = await pool.query(
      `INSERT INTO memories (user_id, title, content, photos, memory_date, tags)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, title, content || '', filePaths, memory_date || new Date().toISOString().split('T')[0], tags || []]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create memory error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update memory
router.put('/:id', auth, upload.array('files', 10), async (req, res) => {
  try {
    const { title, content, memory_date, tags, existingPhotos } = req.body;
    
    let filePaths = existingPhotos ? (typeof existingPhotos === 'string' ? [existingPhotos] : existingPhotos) : [];
    
    if (req.files && req.files.length > 0) {
      const newFilePaths = req.files.map(file => `/uploads/${file.filename}`);
      filePaths = [...filePaths, ...newFilePaths];
    }

    const result = await pool.query(
      `UPDATE memories SET 
        title = COALESCE($1, title),
        content = COALESCE($2, content),
        photos = $3,
        memory_date = COALESCE($4, memory_date),
        tags = COALESCE($5, tags)
      WHERE id = $6 AND user_id = $7 RETURNING *`,
      [title, content, filePaths, memory_date, tags, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Memory not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update memory error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete memory
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM memories WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Memory not found' });
    }
    res.json({ message: 'Memory deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// "On this day" - memories from same date in past years
router.get('/on-this-day/today', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM memories WHERE user_id = $1 
       AND EXTRACT(MONTH FROM memory_date) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(DAY FROM memory_date) = EXTRACT(DAY FROM CURRENT_DATE)
       AND EXTRACT(YEAR FROM memory_date) < EXTRACT(YEAR FROM CURRENT_DATE)
       ORDER BY memory_date DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ MEMORY CAPSULES ============

// Get all capsules
router.get('/capsules', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, unlock_date, is_opened, created_at FROM memory_capsules WHERE user_id = $1 ORDER BY unlock_date ASC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create capsule
router.post('/capsules', auth, async (req, res) => {
  try {
    const { title, content, unlock_date } = req.body;
    if (!title || !content || !unlock_date) {
      return res.status(400).json({ error: 'Title, content, and unlock date are required' });
    }

    const result = await pool.query(
      `INSERT INTO memory_capsules (user_id, title, content, unlock_date)
       VALUES ($1, $2, $3, $4) RETURNING id, title, unlock_date, is_opened, created_at`,
      [req.user.id, title, content, unlock_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Open capsule (only if unlock date has passed)
router.put('/capsules/:id/open', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM memory_capsules WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Capsule not found' });
    }

    const capsule = result.rows[0];
    if (new Date(capsule.unlock_date) > new Date()) {
      return res.status(400).json({ error: 'This capsule is not ready to be opened yet!' });
    }

    await pool.query(
      'UPDATE memory_capsules SET is_opened = true WHERE id = $1',
      [req.params.id]
    );

    res.json({ ...capsule, is_opened: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete capsule
router.delete('/capsules/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM memory_capsules WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Capsule not found' });
    }
    res.json({ message: 'Capsule deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ DREAM TRACKER ============

// Get all dreams
router.get('/dreams', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM dream_tracker WHERE user_id = $1 ORDER BY date DESC LIMIT 50',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create dream entry
router.post('/dreams', auth, async (req, res) => {
  try {
    const { title, description, dream_type, mood, date, tags } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await pool.query(
      `INSERT INTO dream_tracker (user_id, title, description, dream_type, mood, date, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.id, title, description || '', dream_type || 'normal', mood || 'neutral', date || new Date().toISOString().split('T')[0], tags || []]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete dream entry
router.delete('/dreams/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM dream_tracker WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dream entry not found' });
    }
    res.json({ message: 'Dream entry deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
