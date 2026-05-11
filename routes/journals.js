const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// Get all journals for user
router.get('/', auth, async (req, res) => {
  try {
    const { mood, favorite, search, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT * FROM journals WHERE user_id = $1';
    let params = [req.user.id];
    let paramCount = 1;

    if (mood) {
      paramCount++;
      query += ` AND mood = $${paramCount}`;
      params.push(mood);
    }
    if (favorite === 'true') {
      query += ' AND is_favorite = true';
    }
    if (search) {
      paramCount++;
      query += ` AND (title ILIKE $${paramCount} OR content ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC';
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(parseInt(offset));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get journals error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single journal
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM journals WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Journal not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create journal
router.post('/', auth, upload.array('files', 10), async (req, res) => {
  try {
    const { title, content, mood, emoji, font_style, bg_theme, is_private } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const filePaths = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

    const result = await pool.query(
      `INSERT INTO journals (user_id, title, content, mood, emoji, photos, font_style, bg_theme, is_private)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.user.id, title, content, mood || 'calm', emoji || '😊', filePaths, font_style || 'default', bg_theme || 'default', is_private || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create journal error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update journal
router.put('/:id', auth, upload.array('files', 10), async (req, res) => {
  try {
    const { title, content, mood, emoji, font_style, bg_theme, is_favorite, is_private, existingPhotos } = req.body;
    
    let filePaths = existingPhotos ? (typeof existingPhotos === 'string' ? [existingPhotos] : existingPhotos) : [];
    
    if (req.files && req.files.length > 0) {
      const newFilePaths = req.files.map(file => `/uploads/${file.filename}`);
      filePaths = [...filePaths, ...newFilePaths];
    }

    const result = await pool.query(
      `UPDATE journals SET 
        title = COALESCE($1, title),
        content = COALESCE($2, content),
        mood = COALESCE($3, mood),
        emoji = COALESCE($4, emoji),
        photos = $5,
        font_style = COALESCE($6, font_style),
        bg_theme = COALESCE($7, bg_theme),
        is_favorite = COALESCE($8, is_favorite),
        is_private = COALESCE($9, is_private),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10 AND user_id = $11 RETURNING *`,
      [title, content, mood, emoji, filePaths, font_style, bg_theme, is_favorite, is_private, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Journal not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update journal error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete journal
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM journals WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Journal not found' });
    }
    res.json({ message: 'Journal deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get journal stats
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const totalResult = await pool.query('SELECT COUNT(*) FROM journals WHERE user_id = $1', [req.user.id]);
    const favResult = await pool.query('SELECT COUNT(*) FROM journals WHERE user_id = $1 AND is_favorite = true', [req.user.id]);
    const moodResult = await pool.query(
      'SELECT mood, COUNT(*) as count FROM journals WHERE user_id = $1 GROUP BY mood ORDER BY count DESC',
      [req.user.id]
    );
    const recentResult = await pool.query(
      'SELECT * FROM journals WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
      [req.user.id]
    );

    res.json({
      total: parseInt(totalResult.rows[0].count),
      favorites: parseInt(favResult.rows[0].count),
      moodDistribution: moodResult.rows,
      recent: recentResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
