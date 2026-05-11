const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// ============ VISION BOARDS ============

// Get all vision boards
router.get('/vision', auth, async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM vision_boards WHERE user_id = $1';
    let params = [req.user.id];

    if (category) {
      query += ' AND category = $2';
      params.push(category);
    }
    query += ' ORDER BY updated_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single vision board
router.get('/vision/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM vision_boards WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vision board not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create vision board
router.post('/vision', auth, upload.array('files', 10), async (req, res) => {
  try {
    const { title, description, category, items } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    let cover_image = '';
    if (req.files && req.files.length > 0) {
      cover_image = `/uploads/${req.files[0].filename}`;
    }

    const result = await pool.query(
      `INSERT INTO vision_boards (user_id, title, description, category, items, cover_image)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, title, description || '', category || 'general', JSON.stringify(items || []), cover_image]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create vision board error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update vision board
router.put('/vision/:id', auth, upload.array('files', 10), async (req, res) => {
  try {
    const { title, description, category, items, cover_image: existingCover } = req.body;
    
    let cover_image = existingCover;
    if (req.files && req.files.length > 0) {
      cover_image = `/uploads/${req.files[0].filename}`;
    }

    const result = await pool.query(
      `UPDATE vision_boards SET 
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        category = COALESCE($3, category),
        items = COALESCE($4, items),
        cover_image = COALESCE($5, cover_image),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND user_id = $7 RETURNING *`,
      [title, description, category, items ? JSON.stringify(items) : null, cover_image, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vision board not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update vision board error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete vision board
router.delete('/vision/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM vision_boards WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vision board not found' });
    }
    res.json({ message: 'Vision board deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ MOOD BOARDS ============

// Get all mood boards
router.get('/mood', auth, async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM mood_boards WHERE user_id = $1';
    let params = [req.user.id];

    if (category) {
      query += ' AND category = $2';
      params.push(category);
    }
    query += ' ORDER BY updated_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create mood board
router.post('/mood', auth, upload.array('files', 15), async (req, res) => {
  try {
    const { title, category, images: existingImages } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    let images = existingImages ? (typeof existingImages === 'string' ? JSON.parse(existingImages) : existingImages) : [];
    
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => ({ url: `/uploads/${file.filename}`, caption: '' }));
      images = [...images, ...newImages];
    }

    const cover_image = images.length > 0 ? images[0].url : '';

    const result = await pool.query(
      `INSERT INTO mood_boards (user_id, title, category, images, cover_image)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, title, category || 'general', JSON.stringify(images), cover_image]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create mood board error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update mood board
router.put('/mood/:id', auth, upload.array('files', 15), async (req, res) => {
  try {
    const { title, category, images: existingImages } = req.body;
    
    let images = existingImages ? (typeof existingImages === 'string' ? JSON.parse(existingImages) : existingImages) : [];
    
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => ({ url: `/uploads/${file.filename}`, caption: '' }));
      images = [...images, ...newImages];
    }

    const cover_image = images.length > 0 ? images[0].url : '';

    const result = await pool.query(
      `UPDATE mood_boards SET 
        title = COALESCE($1, title),
        category = COALESCE($2, category),
        images = COALESCE($3, images),
        cover_image = COALESCE($4, cover_image),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND user_id = $6 RETURNING *`,
      [title, category, JSON.stringify(images), cover_image, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mood board not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update mood board error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete mood board
router.delete('/mood/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM mood_boards WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mood board not found' });
    }
    res.json({ message: 'Mood board deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
