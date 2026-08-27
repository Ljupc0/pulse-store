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
- **Admin auth:** HTTP Basic Auth for the `/admin.html` routes
- **Customer auth:** email + password accounts, sessions via a signed JWT in an httpOnly cookie (`bcryptjs` + `jsonwebtoken`) — fully separate from the admin auth above

## Features

- Full Men / Women / Kids catalog, each with 5 subcategories (Shoes, Tops &
  Tees, Hoodies & Jackets, Shorts & Pants, Accessories) — a mega-menu on
  desktop, an accordion drawer on mobile, both built from one shared
  taxonomy served by the API (`GET /api/taxonomy`) so the menu, filters, and
  size picker never drift out of sync
- Shop page filters by gender + subcategory + live search, all reflected in
  the URL so results are shareable/bookmarkable (`shop.html`)
- A functional search box (header icon + overlay on desktop, inline on the
  mobile drawer) that jumps to filtered shop results
- Customer accounts: register, log in, log out, and an account page with
  full order history (`login.html`, `register.html`, `account.html`) —
  checkout links the order to the signed-in customer automatically; guest
  checkout still works with no account
- Marketing homepage with featured products pulled live from the API (`index.html`)
- Product detail page with a size selector sized to the product's category
  (shoe sizes, clothing sizes, or no picker at all for one-size accessories)
  and a quantity picker (`product.html`)
- Cart stored in the browser (`localStorage`) but **prices and stock are
  always re-validated on the server** at checkout — the client is never
  trusted with pricing
- Checkout flow that creates a real order, decrements stock, and prevents overselling
- Real newsletter signup, stored server-side (not a fake JS confirmation)
- Admin panel (`admin.html`): view & update order status, add/remove products (gender + subcategory dropdowns, not free text), view subscribers
- A real mobile navigation drawer (hamburger menu) — no dead nav links below 760px
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
public). Also set `JWT_SECRET` in `.env` to a long random string (the
example file has a placeholder) — it signs customer login sessions.

## API overview

| Method | Path                        | Description                                          | Protected      |
|--------|------------------------------|-------------------------------------------------------|----------------|
| GET    | `/api/taxonomy`              | Genders, subcategories, and size lists                 | no             |
| GET    | `/api/products`              | List products (`?gender=`, `?subcategory=`, `?search=`) | no             |
| GET    | `/api/products/:id`          | Single product                                          | no             |
| POST   | `/api/newsletter`            | Subscribe an email address                              | no             |
| POST   | `/api/auth/register`         | Create a customer account                               | no             |
| POST   | `/api/auth/login`            | Log in a customer                                       | no             |
| POST   | `/api/auth/logout`           | Log out (clears the session cookie)                     | no             |
| GET    | `/api/auth/me`                | Current logged-in customer, if any                      | no (401 if out)|
| GET    | `/api/account/orders`         | Order history for the logged-in customer                | customer login |
| POST   | `/api/checkout`               | Place an order (links to account if logged in)          | no             |
| GET    | `/api/orders`                 | List all orders                                          | admin          |
| PATCH  | `/api/orders/:id`              | Update order status                                      | admin          |
| GET    | `/api/subscribers`             | List newsletter subscribers                              | admin          |
| POST   | `/api/admin/products`         | Add a product (`gender` + `subcategory`, not free text)  | admin          |
| PATCH  | `/api/admin/products/:id`      | Edit a product                                           | admin          |
| DELETE | `/api/admin/products/:id`      | Remove (deactivate) a product                            | admin          |

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
5. Under **Environment**, add the variables from `.env.example`:
   - `ADMIN_USER` = a username of your choice
   - `ADMIN_PASSWORD` = a strong password (this protects `/admin.html`)
   - `JWT_SECRET` = a long random string (e.g. generate one with `openssl rand -hex 32`) — this signs customer login sessions
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
- Password reset / "forgot password" flow for customer accounts
- Per-size stock tracking (currently sizes are selectable but not stock-tracked individually)
- Discount codes
