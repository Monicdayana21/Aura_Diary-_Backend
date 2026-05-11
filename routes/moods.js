const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// Get all moods for user (with date range filter)
router.get('/', auth, async (req, res) => {
  try {
    const { startDate, endDate, limit = 30 } = req.query;
    let query = 'SELECT * FROM moods WHERE user_id = $1';
    let params = [req.user.id];
    let paramCount = 1;

    if (startDate) {
      paramCount++;
      query += ` AND date >= $${paramCount}`;
      params.push(startDate);
    }
    if (endDate) {
      paramCount++;
      query += ` AND date <= $${paramCount}`;
      params.push(endDate);
    }

    query += ' ORDER BY date DESC';
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Log mood for today (upsert)
router.post('/', auth, async (req, res) => {
  try {
    const { mood, emoji, note, energy_level, date } = req.body;
    if (!mood) {
      return res.status(400).json({ error: 'Mood is required' });
    }

    const moodDate = date || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `INSERT INTO moods (user_id, mood, emoji, note, energy_level, date)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, date) 
       DO UPDATE SET mood = $2, emoji = $3, note = $4, energy_level = $5
       RETURNING *`,
      [req.user.id, mood, emoji || '😊', note || '', energy_level || 5, moodDate]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Log mood error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete mood entry
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM moods WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mood entry not found' });
    }
    res.json({ message: 'Mood entry deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get mood analytics
router.get('/analytics/summary', auth, async (req, res) => {
  try {
    // Mood distribution
    const moodDist = await pool.query(
      'SELECT mood, COUNT(*) as count FROM moods WHERE user_id = $1 GROUP BY mood ORDER BY count DESC',
      [req.user.id]
    );

    // Weekly moods (last 7 days)
    const weeklyMoods = await pool.query(
      `SELECT date, mood, emoji, energy_level FROM moods 
       WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days'
       ORDER BY date ASC`,
      [req.user.id]
    );

    // Monthly moods (last 30 days)
    const monthlyMoods = await pool.query(
      `SELECT date, mood, emoji, energy_level FROM moods 
       WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days'
       ORDER BY date ASC`,
      [req.user.id]
    );

    // Average energy
    const avgEnergy = await pool.query(
      'SELECT AVG(energy_level) as avg_energy FROM moods WHERE user_id = $1',
      [req.user.id]
    );

    // Streak (consecutive days with mood logged)
    const streakResult = await pool.query(
      `SELECT date FROM moods WHERE user_id = $1 ORDER BY date DESC`,
      [req.user.id]
    );

    let streak = 0;
    if (streakResult.rows.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let checkDate = new Date(today);
      
      for (const row of streakResult.rows) {
        const moodDate = new Date(row.date);
        moodDate.setHours(0, 0, 0, 0);
        if (moodDate.getTime() === checkDate.getTime()) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else if (moodDate < checkDate) {
          break;
        }
      }
    }

    res.json({
      moodDistribution: moodDist.rows,
      weeklyMoods: weeklyMoods.rows,
      monthlyMoods: monthlyMoods.rows,
      avgEnergy: parseFloat(avgEnergy.rows[0].avg_energy) || 0,
      streak,
      totalEntries: moodDist.rows.reduce((sum, m) => sum + parseInt(m.count), 0)
    });
  } catch (err) {
    console.error('Mood analytics error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
