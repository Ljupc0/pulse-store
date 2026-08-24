# Pulse Store — Full-Stack Athletic E-Commerce

A complete online store for **Pulse**, a fictional athletic performance
brand: product catalog with category filters and search, product detail
pages with a size selector, a real shopping cart, checkout, a real
newsletter signup, and a password-protected admin panel for managing
products, orders, and subscribers. This is the full-stack sibling of the
static [Pulse landing page](../pulse-athletics-landing) — same brand, same
visual identity, now with a real backend behind it.

Built to show the full range of a full-stack build — not just a static
storefront mockup.

## Tech stack

- **Backend:** Node.js, Express, better-sqlite3 (file-based SQL database, no external DB server needed)
- **Frontend:** plain HTML/CSS/JavaScript (no framework — easy to read, easy to hand off)
- **Auth:** HTTP Basic Auth for the admin routes

## Features

- Product catalog with category filters + live search (`shop.html`)
- Marketing homepage with featured products pulled live from the API (`index.html`)
- Product detail page with a size selector and quantity picker (`product.html`)
- Cart stored in the browser (`localStorage`) but **prices and stock are
  always re-validated on the server** at checkout — the client is never
  trusted with pricing
- Checkout flow that creates a real order, decrements stock, and prevents overselling
- Real newsletter signup, stored server-side (not a fake JS confirmation)
- Admin panel (`admin.html`): view & update order status, add/remove products, view subscribers
- Full light/dark mode support

## Run it locally

```bash
npm install
cp .env.example .env
# optionally change ADMIN_USER / ADMIN_PASSWORD in .env
npm start
```

Open `http://localhost:3000` for the storefront and
`http://localhost:3000/admin.html` for the admin panel (default login:
`admin` / `change-me-123` — change this in `.env` before deploying anywhere
public).

## API overview

| Method | Path                        | Description                              | Protected |
|--------|------------------------------|-------------------------------------------|-----------|
| GET    | `/api/products`             | List products (`?category=`, `?search=`)   | no        |
| GET    | `/api/products/:id`         | Single product                             | no        |
| POST   | `/api/newsletter`            | Subscribe an email address                 | no        |
| POST   | `/api/checkout`              | Place an order                             | no        |
| GET    | `/api/orders`                | List all orders                            | yes       |
| PATCH  | `/api/orders/:id`             | Update order status                        | yes       |
| GET    | `/api/subscribers`            | List newsletter subscribers                | yes       |
| POST   | `/api/admin/products`        | Add a product                              | yes       |
| PATCH  | `/api/admin/products/:id`     | Edit a product                             | yes       |
| DELETE | `/api/admin/products/:id`     | Remove (deactivate) a product              | yes       |

## Deploying for free (Render.com)

This project has a backend, so it needs a Node host rather than static
hosting (GitHub Pages won't run it). Render's free tier is the easiest
option for a beginner:

1. Push this folder to a GitHub repo (e.g. `pulse-store`).
2. Go to [render.com](https://render.com) and sign up (free — GitHub login works).
3. Click **New → Web Service**, connect your GitHub account, and pick the `pulse-store` repo.
4. Fill in:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Instance type:** Free
5. Under **Environment**, add the two variables from `.env.example`:
   - `ADMIN_USER` = a username of your choice
   - `ADMIN_PASSWORD` = a strong password (this protects `/admin.html`)
6. Click **Create Web Service**. The first deploy takes a few minutes.
7. Once it's live, Render gives you a URL like `https://pulse-store.onrender.com` —
   that's your real, working store.

**Note on the free tier:** Render's free web services "sleep" after 15
minutes of no traffic and take ~30–50 seconds to wake up on the next
visit. That's normal and fine for a portfolio demo — just give it a moment
to spin up the first time you (or a client) load it after a while.

Railway.app works too, with a very similar flow, and also auto-detects
Node.js projects.

The database file (`store.db`) is created automatically on first run and
persists on Render's disk between requests, but a redeploy on the free
tier can reset it — that's expected for a demo store, not a production
concern here.

## Ideas for extending it (good talking points in a client pitch)

- Real payments via Stripe Checkout
- Order confirmation emails (Resend, SendGrid)
- Product images (currently hand-drawn SVG placeholders, by design — swap in real photography)
- Customer accounts & order history
- Per-size stock tracking (currently sizes are selectable but not stock-tracked individually)
- Discount codes
