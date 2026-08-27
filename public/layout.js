// layout.js — shared header, footer, mega-menu, mobile menu, search overlay
// and auth-state UI for every Pulse page.
//
// Usage: put two empty mount points in the page body —
//   <div id="site-header"></div>   (usually right after <body>)
//   <div id="site-footer"></div>   (right before the closing </main> tag's
//                                   sibling, i.e. where the footer belongs)
// then include this file with <script src="layout.js"></script> AFTER
// cart.js. Pulse.mount() runs automatically on DOMContentLoaded.
//
// Other page scripts can read Pulse.taxonomyReady / Pulse.authReady
// (both Promises) to wait for the taxonomy + login state before rendering
// anything that depends on them (size pickers, "signed in as" notes, etc).

var Pulse = (function () {
  var GENDER_LABELS = { men: 'Men', women: 'Women', kids: 'Kids' };
  var state = {
    auth: null, // null = signed out, otherwise {id, name, email}
    taxonomy: { genders: ['men', 'women', 'kids'], subcategories: [], sizes: {} },
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function genderLabel(g) { return GENDER_LABELS[g] || (g ? g[0].toUpperCase() + g.slice(1) : ''); }

  function subcatLabel(key) {
    var found = state.taxonomy.subcategories.find(function (s) { return s.key === key; });
    return found ? found.label : (key ? key[0].toUpperCase() + key.slice(1) : '');
  }

  // Used by every product listing/detail page to render a consistent
  // "Men · Shoes" style category line from a raw product row.
  function formatCategory(p) {
    if (!p) return '';
    return genderLabel(p.gender) + ' · ' + subcatLabel(p.subcategory);
  }

  function sizesFor(sizeType) {
    return (state.taxonomy.sizes && state.taxonomy.sizes[sizeType]) || ['One Size'];
  }

  // ---------------- icons ----------------
  function iconSearch() {
    return '<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }
  function iconClose() {
    return '<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M5 5l14 14M19 5 5 19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }
  function iconUser() {
    return '<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><circle cx="12" cy="8" r="3.6" stroke="currentColor" stroke-width="2"/><path d="M4.5 20c1.6-3.8 4.6-5.8 7.5-5.8s5.9 2 7.5 5.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }
  function iconCart() {
    return '<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M3 4h2l2.2 11.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L20.5 8H6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="21" r="1.4" fill="currentColor"/><circle cx="17" cy="21" r="1.4" fill="currentColor"/></svg>';
  }
  function iconChevron() {
    return '<svg viewBox="0 0 24 24" fill="none" width="14" height="14" class="chev"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  // ---------------- header markup ----------------
  function megaColumns() {
    var subs = state.taxonomy.subcategories;
    return state.taxonomy.genders.map(function (g) {
      return (
        '<div class="mega-item">' +
          '<a href="shop.html?gender=' + g + '" class="mega-trigger">' + genderLabel(g) + iconChevron() + '</a>' +
          '<div class="mega-panel">' +
            '<div class="mega-panel-inner">' +
              subs.map(function (s) {
                return '<a href="shop.html?gender=' + g + '&subcategory=' + s.key + '">' + s.label + '</a>';
              }).join('') +
              '<a class="mega-viewall" href="shop.html?gender=' + g + '">Shop all ' + genderLabel(g) + ' →</a>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function mobileAccordion() {
    var subs = state.taxonomy.subcategories;
    return state.taxonomy.genders.map(function (g) {
      return (
        '<div class="mm-accordion" data-gender="' + g + '">' +
          '<button type="button" class="mm-accordion-head">' + genderLabel(g) + iconChevron() + '</button>' +
          '<div class="mm-accordion-body">' +
            subs.map(function (s) {
              return '<a href="shop.html?gender=' + g + '&subcategory=' + s.key + '">' + s.label + '</a>';
            }).join('') +
            '<a class="mega-viewall" href="shop.html?gender=' + g + '">Shop all ' + genderLabel(g) + ' →</a>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function accountMenuMarkup() {
    if (state.auth) {
      var first = (state.auth.name || '').split(' ')[0] || state.auth.email;
      return (
        '<div class="account-item">' +
          '<button type="button" class="icon-btn account-trigger" id="accountTrigger" aria-haspopup="true" aria-expanded="false">' +
            iconUser() + '<span class="account-firstname">' + esc(first) + '</span>' +
          '</button>' +
          '<div class="account-panel" id="accountPanel">' +
            '<a href="account.html">My account</a>' +
            '<button type="button" id="logoutBtn">Log out</button>' +
          '</div>' +
        '</div>'
      );
    }
    return (
      '<div class="account-item">' +
        '<a class="icon-btn" href="login.html" aria-label="Log in">' + iconUser() + '<span class="account-firstname">Log in</span></a>' +
      '</div>'
    );
  }

  function headerMarkup() {
    return (
      '<header class="site" id="siteHeaderEl">' +
        '<div class="site-row">' +
          '<button type="button" class="hamburger" id="hamburgerBtn" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>' +
          '<a class="brand" href="index.html">' +
            '<span class="mark"><svg viewBox="0 0 24 24" fill="none"><polyline points="2,13 7,13 9,7 13,19 15,13 22,13" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
            'Pulse' +
          '</a>' +
          '<nav class="links" id="megaNav">' +
            megaColumns() +
            '<a href="shop.html" class="plain-link">Shop All</a>' +
            '<a href="admin.html" class="plain-link admin-link">Admin</a>' +
          '</nav>' +
          '<div class="header-actions">' +
            '<button type="button" class="icon-btn" id="searchBtn" aria-label="Search">' + iconSearch() + '</button>' +
            '<div id="accountMenuMount">' + accountMenuMarkup() + '</div>' +
            '<a class="cart-link" href="cart.html" aria-label="Cart">' + iconCart() + '<span class="cart-count" data-cart-count>0</span></a>' +
          '</div>' +
        '</div>' +
        '<div class="search-overlay" id="searchOverlay">' +
          '<div class="wrap search-overlay-inner">' +
            '<form id="searchForm">' +
              '<input type="search" id="searchOverlayInput" placeholder="Search products…" autocomplete="off">' +
              '<button type="submit" class="btn btn-accent">Search</button>' +
            '</form>' +
            '<button type="button" class="icon-btn" id="searchCloseBtn" aria-label="Close search">' + iconClose() + '</button>' +
          '</div>' +
        '</div>' +
      '</header>'
    );
  }

  // Deliberately rendered OUTSIDE <header> (as a sibling, not a child): the
  // header has `backdrop-filter` for its frosted-glass sticky effect, and
  // backdrop-filter establishes a containing block for `position: fixed`
  // descendants — which would trap this fixed-position drawer inside the
  // header's small box instead of the viewport. Keeping it as a sibling
  // avoids that trap entirely.
  function mobileMenuMarkup() {
    return (
      '<div class="mobile-menu" id="mobileMenu">' +
        '<div class="mobile-menu-inner">' +
          '<div class="mm-row">' +
            '<button type="button" class="icon-btn" id="mobileCloseBtn" aria-label="Close menu">' + iconClose() + '</button>' +
          '</div>' +
          '<form id="mobileSearchForm" class="mm-search"><input type="search" id="mobileSearchInput" placeholder="Search products…" autocomplete="off"><button type="submit" class="btn btn-outline">Go</button></form>' +
          mobileAccordion() +
          '<a class="plain-link" href="shop.html">Shop All</a>' +
          '<div id="mobileAccountMount">' + mobileAccountMarkup() + '</div>' +
          '<a class="plain-link admin-link" href="admin.html">Admin</a>' +
        '</div>' +
      '</div>'
    );
  }

  function mobileAccountMarkup() {
    if (state.auth) {
      return '<a class="plain-link" href="account.html">My account</a><button type="button" class="plain-link mm-logout" id="mobileLogoutBtn">Log out</button>';
    }
    return '<a class="plain-link" href="login.html">Log in</a><a class="plain-link" href="register.html">Create account</a>';
  }

  function footerMarkup() {
    return (
      '<footer class="site-footer">' +
        'Full-stack demo store for a fictional athletic brand — Node.js + Express + SQLite backend, plain HTML/CSS/JS frontend.<br>' +
        'Run locally with <code>npm install && npm start</code>. See <code>README.md</code> for deployment.' +
      '</footer>'
    );
  }

  // ---------------- wiring ----------------
  function closeAllOverlays() {
    document.body.classList.remove('search-open', 'menu-open');
    var acc = document.getElementById('accountPanel');
    if (acc) acc.classList.remove('open');
    var trig = document.getElementById('accountTrigger');
    if (trig) trig.setAttribute('aria-expanded', 'false');
  }

  function wireHeader() {
    var hamburgerBtn = document.getElementById('hamburgerBtn');
    var mobileCloseBtn = document.getElementById('mobileCloseBtn');
    var searchBtn = document.getElementById('searchBtn');
    var searchCloseBtn = document.getElementById('searchCloseBtn');
    var searchForm = document.getElementById('searchForm');
    var mobileSearchForm = document.getElementById('mobileSearchForm');

    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', function () {
        var open = document.body.classList.toggle('menu-open');
        hamburgerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
    if (mobileCloseBtn) mobileCloseBtn.addEventListener('click', closeAllOverlays);

    if (searchBtn) {
      searchBtn.addEventListener('click', function () {
        document.body.classList.add('search-open');
        var input = document.getElementById('searchOverlayInput');
        if (input) setTimeout(function () { input.focus(); }, 60);
      });
    }
    if (searchCloseBtn) searchCloseBtn.addEventListener('click', closeAllOverlays);

    if (searchForm) {
      searchForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var q = document.getElementById('searchOverlayInput').value.trim();
        window.location.href = 'shop.html' + (q ? '?search=' + encodeURIComponent(q) : '');
      });
    }
    if (mobileSearchForm) {
      mobileSearchForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var q = document.getElementById('mobileSearchInput').value.trim();
        window.location.href = 'shop.html' + (q ? '?search=' + encodeURIComponent(q) : '');
      });
    }

    document.querySelectorAll('.mm-accordion-head').forEach(function (head) {
      head.addEventListener('click', function () {
        head.closest('.mm-accordion').classList.toggle('open');
      });
    });

    var accountTrigger = document.getElementById('accountTrigger');
    var accountPanel = document.getElementById('accountPanel');
    if (accountTrigger && accountPanel) {
      accountTrigger.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = accountPanel.classList.toggle('open');
        accountTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', function (e) {
        if (!accountPanel.contains(e.target) && e.target !== accountTrigger) {
          accountPanel.classList.remove('open');
          accountTrigger.setAttribute('aria-expanded', 'false');
        }
      });
    }
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
    var mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
    if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', doLogout);

    // Escape closes any open overlay.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAllOverlays();
    });
  }

  function doLogout() {
    fetch('/api/auth/logout', { method: 'POST' }).then(function () {
      window.location.href = 'index.html';
    });
  }

  function mount() {
    var headerMount = document.getElementById('site-header');
    var footerMount = document.getElementById('site-footer');
    if (headerMount) {
      headerMount.outerHTML = headerMarkup();
      // headerMarkup() replaced the mount div with <header id="siteHeaderEl">;
      // insert the mobile drawer right after it, as a sibling (see the note
      // on mobileMenuMarkup() for why it can't live inside the header).
      var headerEl = document.getElementById('siteHeaderEl');
      if (headerEl) headerEl.insertAdjacentHTML('afterend', mobileMenuMarkup());
    }
    if (footerMount) footerMount.outerHTML = footerMarkup();
    wireHeader();
    if (window.Cart && typeof Cart.updateBadge === 'function') Cart.updateBadge();

    // Highlight the current gender in the desktop nav, if applicable.
    var params = new URLSearchParams(location.search);
    var gender = params.get('gender');
    if (gender) {
      document.querySelectorAll('.mega-item').forEach(function (item) {
        var trigger = item.querySelector('.mega-trigger');
        if (trigger && trigger.getAttribute('href') === 'shop.html?gender=' + gender) {
          trigger.classList.add('active');
        }
      });
    }
  }

  var taxonomyReady = fetch('/api/taxonomy')
    .then(function (r) { return r.json(); })
    .then(function (data) { state.taxonomy = data; return data; })
    .catch(function () { return state.taxonomy; });

  var authReady = fetch('/api/auth/me')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (user) { state.auth = user || null; return state.auth; })
    .catch(function () { return null; });

  Promise.all([taxonomyReady, authReady]).then(function () {
    var headerEl = document.getElementById('siteHeaderEl');
    if (headerEl) {
      // Header (and the mobile drawer, its sibling) were already mounted
      // with defaults — refresh both now that we have the real taxonomy +
      // auth state.
      var mobileMenuEl = document.getElementById('mobileMenu');
      headerEl.outerHTML = headerMarkup();
      if (mobileMenuEl) mobileMenuEl.outerHTML = mobileMenuMarkup();
      wireHeader();
      if (window.Cart && typeof Cart.updateBadge === 'function') Cart.updateBadge();
    }
  });

  document.addEventListener('DOMContentLoaded', mount);

  return {
    get auth() { return state.auth; },
    get taxonomy() { return state.taxonomy; },
    taxonomyReady: taxonomyReady,
    authReady: authReady,
    genderLabel: genderLabel,
    subcatLabel: subcatLabel,
    formatCategory: formatCategory,
    sizesFor: sizesFor,
    logout: doLogout,
    esc: esc,
  };
})();
