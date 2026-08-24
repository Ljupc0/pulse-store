// cart.js — small shared helpers used by every page: cart storage, money
// formatting, and the hand-drawn shoe SVG used in place of product photos.
//
// The cart itself only stores {product_id, qty, size} in localStorage;
// prices are always re-read from the API so the cart never trusts stale or
// tampered local prices.

var Cart = {
  KEY: 'pulse_cart_v1',

  read: function () {
    try {
      var raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  write: function (items) {
    try { localStorage.setItem(this.KEY, JSON.stringify(items)); } catch (e) {}
    this.updateBadge();
  },

  add: function (productId, qty, size) {
    qty = qty || 1;
    var items = this.read();
    var existing = items.find(function (i) { return i.product_id === productId && i.size === size; });
    if (existing) existing.qty += qty;
    else items.push({ product_id: productId, qty: qty, size: size || null });
    this.write(items);
  },

  setQty: function (productId, size, qty) {
    var items = this.read();
    items = items
      .map(function (i) { return (i.product_id === productId && i.size === size) ? { product_id: productId, qty: qty, size: size } : i; })
      .filter(function (i) { return i.qty > 0; });
    this.write(items);
  },

  remove: function (productId, size) {
    this.write(this.read().filter(function (i) { return !(i.product_id === productId && i.size === size); }));
  },

  clear: function () { this.write([]); },

  count: function () { return this.read().reduce(function (s, i) { return s + i.qty; }, 0); },

  updateBadge: function () {
    var el = document.querySelector('[data-cart-count]');
    if (el) el.textContent = this.count();
  }
};

document.addEventListener('DOMContentLoaded', function () { Cart.updateBadge(); });

function money(cents) {
  return '$' + (cents / 100).toFixed(2);
}

// Hand-drawn shoe illustration, tinted per-product. Mirrors the artwork
// used on the marketing landing page so the brand feels consistent between
// the two.
function shoeSvg(color) {
  return '<svg viewBox="0 0 400 260" fill="none">' +
    '<path d="M20 190 C40 150 70 120 130 108 C150 104 170 100 185 84 C196 72 210 66 226 66 C244 66 256 78 268 94 C282 112 300 122 322 126 C348 131 368 146 376 168 C382 184 378 200 362 206 L52 206 C32 206 18 200 20 190 Z" fill="var(--ink)"/>' +
    '<path d="M40 196 L370 196 L374 214 C374 220 368 224 360 224 L56 224 C44 224 36 218 36 210 Z" fill="var(--ink)" opacity="0.75"/>' +
    '<path d="M150 100 C168 118 190 128 214 128" stroke="' + color + '" stroke-width="8" stroke-linecap="round" fill="none"/>' +
    '<polyline points="140,196 160,196 170,178 182,210 192,196 210,196" stroke="' + color + '" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';
}

function mediaBg(accent) {
  return 'background:color-mix(in srgb, ' + accent + ' 16%, var(--bg-alt));';
}
