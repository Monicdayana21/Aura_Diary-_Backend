const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// Get all quotes
router.get('/', auth, async (req, res) => {
  try {
    const { category, favorite, search, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT * FROM quotes WHERE user_id = $1';
    let params = [req.user.id];
    let paramCount = 1;

    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }
    if (favorite === 'true') {
      query += ' AND is_favorite = true';
    }
    if (search) {
      paramCount++;
      query += ` AND (text ILIKE $${paramCount} OR author ILIKE $${paramCount})`;
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
    res.status(500).json({ error: 'Server error' });
  }
});

// Create quote
router.post('/', auth, async (req, res) => {
  try {
    const { text, author, category, bg_color } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Quote text is required' });
    }

    const result = await pool.query(
      `INSERT INTO quotes (user_id, text, author, category, bg_color)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, text, author || 'Unknown', category || 'motivation', bg_color || '#f8e8ff']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update quote
router.put('/:id', auth, async (req, res) => {
  try {
    const { text, author, category, is_favorite, bg_color } = req.body;
    const result = await pool.query(
      `UPDATE quotes SET 
        text = COALESCE($1, text),
        author = COALESCE($2, author),
        category = COALESCE($3, category),
        is_favorite = COALESCE($4, is_favorite),
        bg_color = COALESCE($5, bg_color)
      WHERE id = $6 AND user_id = $7 RETURNING *`,
      [text, author, category, is_favorite, bg_color, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete quote
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM quotes WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    res.json({ message: 'Quote deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get random quote
router.get('/random/one', auth, async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM quotes WHERE user_id = $1';
    let params = [req.user.id];

    if (category) {
      query += ' AND category = $2';
      params.push(category);
    }
    query += ' ORDER BY RANDOM() LIMIT 1';

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.json({ text: "Every day is a new beginning.", author: "Aura Diary", category: "motivation" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get categories with counts
router.get('/categories/all', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT category, COUNT(*) as count FROM quotes WHERE user_id = $1 GROUP BY category ORDER BY count DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
