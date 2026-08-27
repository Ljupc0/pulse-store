// db.js — SQLite setup and seed data for the Pulse store.
// better-sqlite3 is used because it's synchronous and very easy to reason
// about in a small project like this.

const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'store.db'));
db.pragma('journal_mode = WAL');

// If an older copy of this database exists (from before the Men/Women/Kids
// catalog + accounts rework), its `products` table won't have a `gender`
// column yet. Rather than writing a real migration for a demo store with no
// live customer data, just drop the old shape and let the block below
// recreate everything on the new schema.
const hasGenderColumn = db
  .prepare("SELECT COUNT(*) AS c FROM pragma_table_info('products') WHERE name = 'gender'")
  .get().c > 0;
if (!hasGenderColumn) {
  db.exec(`
    DROP TABLE IF EXISTS order_items;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS products;
  `);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    gender TEXT NOT NULL,
    subcategory TEXT NOT NULL,
    size_type TEXT NOT NULL DEFAULT 'clothing',
    price_cents INTEGER NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    badge TEXT,
    accent TEXT NOT NULL DEFAULT '#d7ff3f',
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    user_id INTEGER,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'paid',
    total_cents INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
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

// ---------- Category taxonomy ----------
// Shared shape used by the server (validation) and can be mirrored by the
// frontend. Every gender has the same five subcategories so the mega-menu
// is symmetrical; size_type decides which size picker a product gets.
const GENDERS = ['men', 'women', 'kids'];
const SUBCATEGORIES = [
  { key: 'shoes', label: 'Shoes', sizeType: 'shoe' },
  { key: 'tops', label: 'Tops & Tees', sizeType: 'clothing' },
  { key: 'outerwear', label: 'Hoodies & Jackets', sizeType: 'clothing' },
  { key: 'bottoms', label: 'Shorts & Pants', sizeType: 'clothing' },
  { key: 'accessories', label: 'Accessories', sizeType: 'onesize' },
];
const SIZES = {
  shoe: ['7', '8', '9', '10', '11', '12', '13'],
  clothing: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  onesize: ['One Size'],
};

const count = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO products (name, gender, subcategory, size_type, price_cents, stock, description, badge, accent)
    VALUES (@name, @gender, @subcategory, @size_type, @price_cents, @stock, @description, @badge, @accent)
  `);
  const seed = db.transaction((rows) => rows.forEach((r) => insert.run(r)));

  seed([
    // ---------------- MEN ----------------
    { name: 'Pulse Runner 3', gender: 'men', subcategory: 'shoes', size_type: 'shoe', price_cents: 12900, stock: 48, description: 'Our lightest daily trainer — engineered mesh upper, responsive foam midsole, and an outsole tuned for road miles.', badge: 'Best seller', accent: '#d7ff3f' },
    { name: 'Velocity Racer', gender: 'men', subcategory: 'shoes', size_type: 'shoe', price_cents: 13900, stock: 22, description: 'A carbon-plated race-day shoe built for tempo runs and PRs. Not for the faint of heart.', badge: 'New', accent: '#ff4d2e' },
    { name: 'Apex High-Top', gender: 'men', subcategory: 'shoes', size_type: 'shoe', price_cents: 14900, stock: 18, description: 'High-top support with a responsive cushion stack built for cuts, jumps and hard stops.', badge: null, accent: '#3a3f2e' },
    { name: 'Momentum Tee', gender: 'men', subcategory: 'tops', size_type: 'clothing', price_cents: 3400, stock: 60, description: 'A featherweight training tee in moisture-wicking knit — built to disappear on a long run.', badge: 'Best seller', accent: '#d7ff3f' },
    { name: 'Split-Tempo Long Sleeve', gender: 'men', subcategory: 'tops', size_type: 'clothing', price_cents: 4400, stock: 34, description: 'Brushed interior long sleeve for cold starts, with thumbhole cuffs and a dropped hem.', badge: null, accent: '#9d9da3' },
    { name: 'Groundwork Hoodie', gender: 'men', subcategory: 'outerwear', size_type: 'clothing', price_cents: 6900, stock: 40, description: 'Heavyweight fleece hoodie for the walk to and from the gym — kangaroo pocket, ribbed cuffs.', badge: 'Best seller', accent: '#1c1c1e' },
    { name: 'Shield Run Jacket', gender: 'men', subcategory: 'outerwear', size_type: 'clothing', price_cents: 8900, stock: 26, description: 'Wind and water-resistant shell with pit zips and a packable hood, built for changing weather.', badge: 'New', accent: '#3a3f2e' },
    { name: 'Interval Short 7"', gender: 'men', subcategory: 'bottoms', size_type: 'clothing', price_cents: 3900, stock: 50, description: 'A 7-inch training short with a liner and zip pocket, cut for range of motion.', badge: null, accent: '#ff4d2e' },
    { name: 'Tempo Jogger', gender: 'men', subcategory: 'bottoms', size_type: 'clothing', price_cents: 5900, stock: 38, description: 'Tapered fleece jogger with a brushed interior — as at home on the couch as on the track.', badge: null, accent: '#58585d' },
    { name: 'Grip Low Socks (3-Pack)', gender: 'men', subcategory: 'accessories', size_type: 'onesize', price_cents: 1800, stock: 90, description: 'Cushioned low-cut socks with arch support and a no-slip heel — three pairs, one price.', badge: null, accent: '#d7ff3f' },
    { name: 'Trainer Duffel', gender: 'men', subcategory: 'accessories', size_type: 'onesize', price_cents: 5400, stock: 24, description: 'A 35L gym duffel with a vented shoe compartment and a padded strap.', badge: 'New', accent: '#1c1c1e' },

    // ---------------- WOMEN ----------------
    { name: 'Pulse Runner 3 W', gender: 'women', subcategory: 'shoes', size_type: 'shoe', price_cents: 12900, stock: 44, description: 'The Runner 3 on a women\'s-specific last, with the same engineered mesh upper and road-tuned outsole.', badge: 'Best seller', accent: '#d7ff3f' },
    { name: 'Flexbase Trainer W', gender: 'women', subcategory: 'shoes', size_type: 'shoe', price_cents: 9900, stock: 52, description: 'A light, flexible training shoe built for HIIT, circuits and studio classes.', badge: null, accent: '#ff4d2e' },
    { name: 'Skyline Hoops W', gender: 'women', subcategory: 'shoes', size_type: 'shoe', price_cents: 15900, stock: 14, description: 'Our signature court shoe, built with pros and tested on real hardwood.', badge: 'New', accent: '#1c1c1e' },
    { name: 'Featherline Tank', gender: 'women', subcategory: 'tops', size_type: 'clothing', price_cents: 3200, stock: 55, description: 'A cropped, moisture-wicking tank with a racerback cut for full range of motion.', badge: 'Best seller', accent: '#d7ff3f' },
    { name: 'Studio Long Sleeve', gender: 'women', subcategory: 'tops', size_type: 'clothing', price_cents: 4200, stock: 36, description: 'A soft, brushed long sleeve with thumbholes — built for cold-weather warm-ups.', badge: null, accent: '#9d9da3' },
    { name: 'Groundwork Hoodie W', gender: 'women', subcategory: 'outerwear', size_type: 'clothing', price_cents: 6900, stock: 42, description: 'Heavyweight fleece hoodie with a relaxed fit and ribbed cuffs, matched to the men\'s silhouette.', badge: 'Best seller', accent: '#1c1c1e' },
    { name: 'Aero Wind Vest', gender: 'women', subcategory: 'outerwear', size_type: 'clothing', price_cents: 7400, stock: 30, description: 'A packable wind vest for layering on cold-start runs, with reflective trim for low light.', badge: 'New', accent: '#3a3f2e' },
    { name: 'Studio Legging', gender: 'women', subcategory: 'bottoms', size_type: 'clothing', price_cents: 6400, stock: 46, description: 'A high-rise, four-way-stretch legging with a hidden waistband pocket.', badge: 'Best seller', accent: '#ff4d2e' },
    { name: 'Interval Short 5" W', gender: 'women', subcategory: 'bottoms', size_type: 'clothing', price_cents: 3900, stock: 48, description: 'A lined 5-inch training short with a zip pocket, cut for lateral movement.', badge: null, accent: '#58585d' },
    { name: 'Grip Low Socks W (3-Pack)', gender: 'women', subcategory: 'accessories', size_type: 'onesize', price_cents: 1800, stock: 85, description: 'Cushioned low-cut socks with arch support and a no-slip heel — three pairs, one price.', badge: null, accent: '#d7ff3f' },
    { name: 'Studio Tote', gender: 'women', subcategory: 'accessories', size_type: 'onesize', price_cents: 4400, stock: 28, description: 'A structured gym tote with a wet-gear pocket and a padded laptop sleeve.', badge: null, accent: '#9d9da3' },

    // ---------------- KIDS ----------------
    { name: 'Pulse Runner Jr', gender: 'kids', subcategory: 'shoes', size_type: 'shoe', price_cents: 7900, stock: 40, description: 'The Runner 3, scaled down — same cushioned ride, sized for growing feet.', badge: 'Best seller', accent: '#d7ff3f' },
    { name: 'Court Cadet High-Top', gender: 'kids', subcategory: 'shoes', size_type: 'shoe', price_cents: 8900, stock: 20, description: 'A durable high-top for the playground and the court, with a reinforced toe.', badge: 'New', accent: '#1c1c1e' },
    { name: 'Recess Slip-On', gender: 'kids', subcategory: 'shoes', size_type: 'shoe', price_cents: 5900, stock: 34, description: 'A no-laces slip-on for the mornings you\'re already running late.', badge: null, accent: '#ff4d2e' },
    { name: 'Little Trainer Tee', gender: 'kids', subcategory: 'tops', size_type: 'clothing', price_cents: 2400, stock: 60, description: 'A soft, durable tee that survives recess, gym class, and everything after.', badge: 'Best seller', accent: '#d7ff3f' },
    { name: 'Cadet Long Sleeve', gender: 'kids', subcategory: 'tops', size_type: 'clothing', price_cents: 2900, stock: 38, description: 'A brushed-cotton long sleeve for cool mornings at the field.', badge: null, accent: '#9d9da3' },
    { name: 'Junior Groundwork Hoodie', gender: 'kids', subcategory: 'outerwear', size_type: 'clothing', price_cents: 4400, stock: 36, description: 'The Groundwork Hoodie, kid-sized — same heavyweight fleece and kangaroo pocket.', badge: 'Best seller', accent: '#1c1c1e' },
    { name: 'Rain Runner Jacket Jr', gender: 'kids', subcategory: 'outerwear', size_type: 'clothing', price_cents: 4900, stock: 24, description: 'A packable, water-resistant shell for unpredictable recess weather.', badge: 'New', accent: '#3a3f2e' },
    { name: 'Playground Short', gender: 'kids', subcategory: 'bottoms', size_type: 'clothing', price_cents: 2400, stock: 50, description: 'A durable, stretch-woven short built for cartwheels and everything after.', badge: null, accent: '#ff4d2e' },
    { name: 'Jr Tempo Jogger', gender: 'kids', subcategory: 'bottoms', size_type: 'clothing', price_cents: 3400, stock: 32, description: 'A tapered fleece jogger, sized down from the adult Tempo Jogger.', badge: null, accent: '#58585d' },
    { name: 'Kids Grip Socks (3-Pack)', gender: 'kids', subcategory: 'accessories', size_type: 'onesize', price_cents: 1400, stock: 70, description: 'Cushioned socks sized for smaller feet, with the same no-slip heel.', badge: null, accent: '#d7ff3f' },
    { name: 'Little Trainer Backpack', gender: 'kids', subcategory: 'accessories', size_type: 'onesize', price_cents: 3400, stock: 26, description: 'A right-sized backpack for school and practice, with a water-bottle pocket.', badge: 'New', accent: '#1c1c1e' },
  ]);
}

module.exports = db;
module.exports.GENDERS = GENDERS;
module.exports.SUBCATEGORIES = SUBCATEGORIES;
module.exports.SIZES = SIZES;
