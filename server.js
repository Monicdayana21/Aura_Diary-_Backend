const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const initDB = require('./initDB');
const authRoutes = require('./routes/auth');
const journalRoutes = require('./routes/journals');
const moodRoutes = require('./routes/moods');
const quoteRoutes = require('./routes/quotes');
const boardRoutes = require('./routes/boards');
const memoryRoutes = require('./routes/memories');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
const isVercel = process.env.VERCEL === '1';
app.use('/uploads', express.static(isVercel ? '/tmp' : path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/journals', journalRoutes);
app.use('/api/moods', moodRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/memories', memoryRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '✨ Aura Diary API is running' });
});

// Dashboard stats
const auth = require('./middleware/auth');
const pool = require('./db');

app.get('/api/dashboard', auth, async (req, res) => {
  try {
    const journals = await pool.query('SELECT COUNT(*) FROM journals WHERE user_id = $1', [req.user.id]);
    const moods = await pool.query('SELECT COUNT(*) FROM moods WHERE user_id = $1', [req.user.id]);
    const quotes = await pool.query('SELECT COUNT(*) FROM quotes WHERE user_id = $1', [req.user.id]);
    const visionBoards = await pool.query('SELECT COUNT(*) FROM vision_boards WHERE user_id = $1', [req.user.id]);
    const moodBoards = await pool.query('SELECT COUNT(*) FROM mood_boards WHERE user_id = $1', [req.user.id]);
    const memories = await pool.query('SELECT COUNT(*) FROM memories WHERE user_id = $1', [req.user.id]);

    const recentJournals = await pool.query(
      'SELECT id, title, mood, emoji, created_at FROM journals WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
      [req.user.id]
    );

    const todayMood = await pool.query(
      'SELECT * FROM moods WHERE user_id = $1 AND date = CURRENT_DATE',
      [req.user.id]
    );

    const randomQuote = await pool.query(
      'SELECT * FROM quotes WHERE user_id = $1 ORDER BY RANDOM() LIMIT 1',
      [req.user.id]
    );

    // Mood streak
    const streakResult = await pool.query(
      'SELECT date FROM moods WHERE user_id = $1 ORDER BY date DESC',
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
      stats: {
        journals: parseInt(journals.rows[0].count),
        moods: parseInt(moods.rows[0].count),
        quotes: parseInt(quotes.rows[0].count),
        visionBoards: parseInt(visionBoards.rows[0].count),
        moodBoards: parseInt(moodBoards.rows[0].count),
        memories: parseInt(memories.rows[0].count),
        streak
      },
      recentJournals: recentJournals.rows,
      todayMood: todayMood.rows[0] || null,
      dailyQuote: randomQuote.rows[0] || { text: "Every day is a fresh start.", author: "Aura Diary" }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Initialize DB and start server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🌸 Aura Diary server running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}\n`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
