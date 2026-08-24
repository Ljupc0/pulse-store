// server.js — Express backend for the Pulse store.
// Run with: npm install, then copy .env.example to .env, then npm start

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-123';

app.use(cors());
app.use(express.json());
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

function orderNumber() {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return 'PLS-' + Date.now().toString().slice(-6) + rand;
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---------- Public: products ----------

app.get('/api/products', (req, res) => {
  const { category, search } = req.query;
  let rows = db.prepare('SELECT * FROM products WHERE active = 1').all();
  if (category) rows = rows.filter((p) => p.category === category);
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

// ---------- Public: checkout ----------
// The client sends product ids + quantities ONLY. Prices, stock and totals
// are always recalculated from the database — never trust a price coming
// from the browser.

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

  const placeOrder = db.transaction(() => {
    const number = orderNumber();
    const insertOrder = db.prepare(`
      INSERT INTO orders (order_number, customer_name, customer_email, customer_address, total_cents)
      VALUES (?, ?, ?, ?, ?)
    `);
    const orderResult = insertOrder.run(number, customer.name.trim(), customer.email.trim(), customer.address.trim(), total);
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

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const { name, category, price_cents, stock, description, badge, accent } = req.body || {};
  if (!name || !category || !price_cents) {
    return res.status(400).json({ error: 'name, category and price_cents are required.' });
  }
  const insert = db.prepare(`
    INSERT INTO products (name, category, price_cents, stock, description, badge, accent)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = insert.run(name, category, price_cents, stock || 0, description || '', badge || null, accent || '#d7ff3f');
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(product);
});

app.patch('/api/admin/products/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  const merged = { ...existing, ...req.body };
  db.prepare(`
    UPDATE products SET name=?, category=?, price_cents=?, stock=?, description=?, badge=?, accent=?, active=?
    WHERE id=?
  `).run(merged.name, merged.category, merged.price_cents, merged.stock, merged.description, merged.badge, merged.accent, merged.active, req.params.id);
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
