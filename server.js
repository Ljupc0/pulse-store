// server.js — Express backend for the Pulse store.
// Run with: npm install, then copy .env.example to .env, then npm start

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const db = require('./db');
const { GENDERS, SUBCATEGORIES, SIZES } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-123';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
const IS_PROD = process.env.NODE_ENV === 'production';
const SESSION_COOKIE = 'pulse_session';

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Helpers ----------

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme !== 'Basic' || !encoded) {
    res.set('WWW-Authenticate', 'Basic realm="admin"');
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const [user, pass] = decoded.split(':');
  if (user === ADMIN_USER && pass === ADMIN_PASSWORD) return next();
  res.set('WWW-Authenticate', 'Basic realm="admin"');
  return res.status(401).json({ error: 'Invalid credentials.' });
}

// Reads the session cookie if present and attaches req.user — but never
// blocks the request. Used on public routes (like checkout) that behave
// differently for a logged-in customer without requiring login.
function attachUser(req, res, next) {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = { id: payload.sub, name: payload.name, email: payload.email };
    } catch (e) {
      // Expired/invalid token — treat as logged out rather than erroring.
    }
  }
  next();
}

// Blocks the request unless a valid session cookie is present.
function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in.' });
  next();
}

function signSession(user) {
  return jwt.sign({ sub: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function orderNumber() {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return 'PLS-' + Date.now().toString().slice(-6) + rand;
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.use(attachUser);

// ---------- Public: category taxonomy ----------
// Lets the frontend build the mega-menu and size pickers from one source of
// truth instead of hard-coding the list in every page.

app.get('/api/taxonomy', (req, res) => {
  res.json({ genders: GENDERS, subcategories: SUBCATEGORIES, sizes: SIZES });
});

// ---------- Public: products ----------

app.get('/api/products', (req, res) => {
  const { gender, subcategory, search } = req.query;
  let rows = db.prepare('SELECT * FROM products WHERE active = 1').all();
  if (gender) rows = rows.filter((p) => p.gender === gender);
  if (subcategory) rows = rows.filter((p) => p.subcategory === subcategory);
  if (search) {
    const q = String(search).toLowerCase();
    rows = rows.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }
  res.json(rows);
});

app.get('/api/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json(product);
});

// ---------- Public: newsletter ----------

app.post('/api/newsletter', (req, res) => {
  const { email } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  try {
    db.prepare('INSERT INTO subscribers (email) VALUES (?)').run(email.trim().toLowerCase());
  } catch (e) {
    // UNIQUE constraint — already subscribed. Treat as success either way.
  }
  res.status(201).json({ ok: true });
});

// ---------- Auth: register / login / logout / me ----------

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Enter your name.' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const cleanEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

  const hash = bcrypt.hashSync(String(password), 10);
  const result = db
    .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(name.trim(), cleanEmail, hash);

  const user = { id: result.lastInsertRowid, name: name.trim(), email: cleanEmail };
  setSessionCookie(res, signSession(user));
  res.status(201).json(user);
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || !password) return res.status(400).json({ error: 'Enter your email and password.' });

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim().toLowerCase());
  if (!row || !bcrypt.compareSync(String(password), row.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }

  const user = { id: row.id, name: row.name, email: row.email };
  setSessionCookie(res, signSession(user));
  res.json(user);
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not logged in.' });
  res.json(req.user);
});

// ---------- Account: order history for the logged-in customer ----------

app.get('/api/account/orders', requireUser, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  res.json(orders.map((o) => ({ ...o, items: items.all(o.id) })));
});

// ---------- Public: checkout ----------
// The client sends product ids + quantities ONLY. Prices, stock and totals
// are always recalculated from the database — never trust a price coming
// from the browser. If the shopper is logged in (session cookie present),
// the order is linked to their account; otherwise it's a guest checkout.

app.post('/api/checkout', (req, res) => {
  const { items, customer } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Your cart is empty.' });
  }
  if (!customer || !customer.name || !customer.email || !customer.address) {
    return res.status(400).json({ error: 'Name, email and address are required.' });
  }

  const getProduct = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1');
  const resolved = [];
  let total = 0;

  for (const item of items) {
    const product = getProduct.get(item.product_id);
    const qty = Math.max(1, Math.min(20, Number(item.qty) || 1));
    const size = item.size ? String(item.size).slice(0, 10) : null;
    if (!product) return res.status(400).json({ error: `Product #${item.product_id} no longer exists.` });
    if (product.stock < qty) return res.status(409).json({ error: `${product.name} only has ${product.stock} left in stock.` });
    resolved.push({ product, qty, size });
    total += product.price_cents * qty;
  }

  const userId = req.user ? req.user.id : null;

  const placeOrder = db.transaction(() => {
    const number = orderNumber();
    const insertOrder = db.prepare(`
      INSERT INTO orders (order_number, user_id, customer_name, customer_email, customer_address, total_cents)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const orderResult = insertOrder.run(number, userId, customer.name.trim(), customer.email.trim(), customer.address.trim(), total);
    const orderId = orderResult.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, qty, size)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const decrementStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

    for (const { product, qty, size } of resolved) {
      insertItem.run(orderId, product.id, product.name, product.price_cents, qty, size);
      decrementStock.run(qty, product.id);
    }

    return { orderId, number };
  });

  const { orderId, number } = placeOrder();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  res.status(201).json({ ...order, order_number: number });
});

// ---------- Admin: orders ----------

app.get('/api/orders', requireAdmin, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  const withItems = orders.map((o) => ({ ...o, items: items.all(o.id) }));
  res.json(withItems);
});

app.patch('/api/orders/:id', requireAdmin, (req, res) => {
  const { status } = req.body || {};
  const allowed = ['paid', 'shipped', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const result = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Order not found.' });
  res.json({ ok: true });
});

// ---------- Admin: subscribers ----------

app.get('/api/subscribers', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM subscribers ORDER BY id DESC').all();
  res.json(rows);
});

// ---------- Admin: products (add / edit / remove) ----------

function validGenderSubcategory(gender, subcategory) {
  if (!GENDERS.includes(gender)) return false;
  return SUBCATEGORIES.some((s) => s.key === subcategory);
}

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const { name, gender, subcategory, price_cents, stock, description, badge, accent } = req.body || {};
  if (!name || !validGenderSubcategory(gender, subcategory) || !price_cents) {
    return res.status(400).json({ error: 'name, a valid gender, subcategory and price_cents are required.' });
  }
  const sizeType = (SUBCATEGORIES.find((s) => s.key === subcategory) || {}).sizeType || 'clothing';
  const insert = db.prepare(`
    INSERT INTO products (name, gender, subcategory, size_type, price_cents, stock, description, badge, accent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = insert.run(name, gender, subcategory, sizeType, price_cents, stock || 0, description || '', badge || null, accent || '#d7ff3f');
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(product);
});

app.patch('/api/admin/products/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  const merged = { ...existing, ...req.body };
  if (req.body.subcategory && req.body.subcategory !== existing.subcategory) {
    merged.size_type = (SUBCATEGORIES.find((s) => s.key === merged.subcategory) || {}).sizeType || existing.size_type;
  }
  db.prepare(`
    UPDATE products SET name=?, gender=?, subcategory=?, size_type=?, price_cents=?, stock=?, description=?, badge=?, accent=?, active=?
    WHERE id=?
  `).run(merged.name, merged.gender, merged.subcategory, merged.size_type, merged.price_cents, merged.stock, merged.description, merged.badge, merged.accent, merged.active, req.params.id);
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id));
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  // Soft delete: keep the row (past orders reference it) but hide it from the storefront.
  const result = db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Product not found.' });
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Pulse store API running on http://localhost:${PORT}`);
});
