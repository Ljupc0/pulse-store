// db.js — SQLite setup and seed data for the Pulse store.
// better-sqlite3 is used because it's synchronous and very easy to reason
// about in a small project like this.

const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'store.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    badge TEXT,
    accent TEXT NOT NULL DEFAULT '#d7ff3f',
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'paid',
    total_cents INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    qty INTEGER NOT NULL,
    size TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const count = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO products (name, category, price_cents, stock, description, badge, accent)
    VALUES (@name, @category, @price_cents, @stock, @description, @badge, @accent)
  `);
  const seed = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
  seed([
    { name: 'Pulse Runner 3', category: 'Running', price_cents: 12900, stock: 48, description: 'Our lightest daily trainer — engineered mesh upper, responsive foam midsole, and an outsole tuned for road miles.', badge: 'Best seller', accent: '#d7ff3f' },
    { name: 'Velocity Racer', category: 'Running', price_cents: 13900, stock: 22, description: 'A carbon-plated race-day shoe built for tempo runs and PRs. Not for the faint of heart.', badge: 'New', accent: '#d7ff3f' },
    { name: 'Runner 3 Low', category: 'Running', price_cents: 11900, stock: 35, description: 'The Runner 3, tuned lower to the ground for a more grounded ride.', badge: null, accent: '#a9d61e' },
    { name: 'Momentum Trainer', category: 'Training', price_cents: 10900, stock: 40, description: 'A stable, grippy trainer built for lateral movement, lifting days, and everything in between.', badge: null, accent: '#ff4d2e' },
    { name: 'Ironclad Cross-Trainer', category: 'Training', price_cents: 11900, stock: 30, description: 'Reinforced heel cage and a flat, stable base for heavy lifts and interval work.', badge: 'New', accent: '#ff6a45' },
    { name: 'Flexbase Trainer', category: 'Training', price_cents: 9900, stock: 55, description: 'A lighter, more flexible training shoe for HIIT, circuits and studio classes.', badge: null, accent: '#ff4d2e' },
    { name: 'Apex High-Top', category: 'Basketball', price_cents: 14900, stock: 18, description: 'High-top support with a responsive cushion stack built for cuts, jumps and hard stops.', badge: 'New', accent: '#3a3f2e' },
    { name: 'Skyline Hoops', category: 'Basketball', price_cents: 15900, stock: 14, description: 'Our signature court shoe — built with pros, tested on real hardwood.', badge: 'Best seller', accent: '#1c1c1e' },
    { name: 'Recovery Slide', category: 'Recovery', price_cents: 5900, stock: 70, description: 'Contoured foam footbed for the walk from the locker room to the car — and everywhere after.', badge: null, accent: '#9d9da3' },
    { name: 'Restore Foam Slide', category: 'Recovery', price_cents: 4900, stock: 65, description: 'Ultra-soft dual-density foam slide designed for post-training recovery.', badge: null, accent: '#c7c7cd' },
  ]);
}

module.exports = db;
