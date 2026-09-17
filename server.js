const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const path = require('path');
const { createClient } = require('@tursodatabase/serverless/compat');

const JWT_SECRET = 'change_moi_en_production_avec_une_vraie_cle_secrete';
const EMAIL_USER = 'yenohyenoh209@gmail.com';
const EMAIL_PASS = 'nbcg xeen earl irta';

const db = createClient({
  url: 'libsql://yh-yhrespon77.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk2MTQyNTgsImlkIjoiMDFhMGFkM2EtMDAwMS03NGE3LWFjMmMtZDIzZDQzNzQwZDJmIiwia2lkIjoicTIzMHlLZ1lJRlYtakt2czZPTmttNkpMdk1PTGt1TzFQcm5wamdka3c4VSIsInJpZCI6ImNhY2YzZWU1LTM3ZWMtNGY5My05N2ZkLTQwMGVhODIwOGFhYyJ9.XCpmnB8zB0r_F7YHoUoJIcOHVhCCKAzWo9F2vUY45eGorwJuaV4QI--1DqhF-eOzq3djWsfnW0dYv5OjmIwMAg',
});

async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      verified INTEGER DEFAULT 0,
      verify_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

async function sendVerificationEmail(to, code) {
  await transporter.sendMail({
    from: `"Mon App" <${EMAIL_USER}>`,
    to,
    subject: 'Vérifie ton adresse email',
    html: `<p>Ton code de vérification est : <b>${code}</b></p>`,
  });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Token manquant' });

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const code = generateCode();

  try {
    await db.execute({
      sql: 'INSERT INTO users (email, password, verify_code) VALUES (?, ?, ?)',
      args: [email, hashedPassword, code],
    });

    await sendVerificationEmail(email, code);
    res.json({ message: 'Compte créé. Vérifie ton email pour le code.' });
  } catch (err) {
    res.status(400).json({ error: 'Cet email existe déjà ou erreur serveur' });
  }
});

app.post('/api/verify', async (req, res) => {
  const { email, code } = req.body;

  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE email = ? AND verify_code = ?',
    args: [email, code],
  });

  if (result.rows.length === 0) {
    return res.status(400).json({ error: 'Code invalide' });
  }

  const user = result.rows[0];
  await db.execute({
    sql: 'UPDATE users SET verified = 1, verify_code = NULL WHERE id = ?',
    args: [user.id],
  });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET);
  res.json({ token, message: 'Email vérifié !' });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE email = ?',
    args: [email],
  });

  const user = result.rows[0];
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  if (!user.verified) {
    return res.status(403).json({ error: 'Email non vérifié' });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET);
  res.json({ token });
});

app.get('/api/me', authMiddleware, async (req, res) => {
  const result = await db.execute({
    sql: 'SELECT id, email, verified, created_at FROM users WHERE id = ?',
    args: [req.userId],
  });
  res.json(result.rows[0]);
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const result = await db.execute({
    sql: 'SELECT id, email, verified, created_at FROM users WHERE id = ?',
    args: [req.userId],
  });
  res.json(result.rows[0] || null);
});

app.get('/api/v2/me', authMiddleware, async (req, res) => {
  const result = await db.execute({
    sql: 'SELECT id, email, verified, created_at FROM users WHERE id = ?',
    args: [req.userId],
  });
  res.json(result.rows[0] || null);
});

app.post('/api/v2/check', authMiddleware, async (req, res) => {
  res.json({
    input: req.body,
    result: 'not_implemented',
    message: 'Définis ici ta propre logique de vérification.',
  });
});

app.post('/api/v2/bulk-check', authMiddleware, async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  res.json({
    results: items.map((item) => ({ input: item, result: 'not_implemented' })),
  });
});

app.post('/api/v2/appeal-submit', authMiddleware, async (req, res) => {
  res.json({ message: 'Requête reçue.', data: req.body });
});

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
initDb().then(() => {
  app.listen(PORT, () => console.log(`Takamura Elite lancé sur http://localhost:${PORT}`));
});
