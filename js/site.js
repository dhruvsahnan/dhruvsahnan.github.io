/* Renders the whole page from the JSON files in data/.
 *
 * You normally never need to edit this file. To add news, papers, talks etc.
 * edit the matching file in data/.
 */
(function () {
  'use strict';

  var DATA_DIR = 'data/';

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /** Escape text for safe use in HTML (element content and attributes). */
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Allow http(s), mailto, tel and relative URLs; block javascript:, data: etc. */
  function safeUrl(url) {
    var u = String(url == null ? '' : url).trim();
    if (!u) return '#';
    if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
    if (/^[a-z][a-z0-9+.\-]*:/i.test(u)) return '#'; // some other scheme
    return u; // relative path such as assets/cv.pdf
  }

  /**
   * Tiny, safe inline markup used by every text field in the JSON files:
   *   [label](https://example.com)   link (opens in a new tab)
   *   **bold**    *italic*           emphasis
   *   \n                             line break
   * Everything else is escaped, so stray < or & in your text is harmless.
   */
  function inline(text) {
    var s = esc(text);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_m, label, url) {
      // url is already HTML-escaped by esc(); only the scheme needs checking
      var href = safeUrl(url.replace(/&amp;/g, '&'));
      return '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + label + '</a>';
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    s = s.replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  /** Parse "2026", "2026-04" or "2026-04-19". Returns null if not a date. */
  function parseDate(d) {
    var m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(String(d == null ? '' : d).trim());
    if (!m) return null;
    var month = m[2] ? +m[2] : null;
    if (month !== null && (month < 1 || month > 12)) month = null;
    return { y: +m[1], m: month, d: m[3] ? +m[3] : null };
  }

  function dateKey(d) {
    var p = parseDate(d);
    return p ? p.y * 10000 + (p.m || 0) * 100 + (p.d || 0) : -1;
  }

  /** "Apr 2026" (or "2026" when no month is given). */
  function fmtDate(d) {
    var p = parseDate(d);
    if (!p) return String(d == null ? '' : d);
    return p.m ? MONTHS[p.m - 1] + ' ' + p.y : String(p.y);
  }

  /** "Apr '26" (or "2026" when no month is given). */
  function fmtShortDate(d) {
    var p = parseDate(d);
    if (!p) return String(d == null ? '' : d);
    return p.m ? MONTHS[p.m - 1] + " '" + String(p.y).slice(2) : String(p.y);
  }

  /** Newest first. Entries without a valid date go last. File order breaks ties. */
  function newestFirst(items) {
    return items
      .map(function (item, i) { return { item: item, i: i, k: dateKey(item.date) }; })
      .sort(function (a, b) { return b.k - a.k || a.i - b.i; })
      .map(function (x) { return x.item; });
  }

  function visibleItems(data) {
    return ((data && data.items) || []).filter(function (it) { return it && !it.hidden; });
  }

  function heading(title) {
    return title ? '<p class="header pt-3">' + inline(title) + '</p>' : '';
  }

  function linkTags(links) {
    return (links || []).map(function (l) {
      return '<a class="tag" href="' + esc(safeUrl(l.url)) + '" target="_blank" rel="noopener">' +
        esc(l.label) + '</a>';
    }).join(' ');
  }

  /* ------------------------------------------------------------------ *
   * Section renderers. Each gets the parsed JSON for its file + context.
   * ------------------------------------------------------------------ */

  function renderAbout(data) {
    var paras = (data.paragraphs || []).map(function (p) { return inline(p); });
    return heading(data.title || 'Hello!') + paras.join('<br><br>');
  }

  function renderNews(data) {
    var items = newestFirst(visibleItems(data));
    var shown = data.visible_count == null ? 8 : Math.max(0, +data.visible_count);

    function li(it) {
      var cls = it.highlight ? ' class="news-highlight"' : '';
      var emoji = it.emoji ? esc(it.emoji) + ' ' : '';
      var when = it.date_label || fmtDate(it.date);
      return '<li' + cls + '>' + emoji + '<b>' + esc(when) + ':</b> ' + inline(it.text) + '</li>';
    }

    var html = heading(data.title || 'News and Updates');
    html += '<ul>' + items.slice(0, shown).map(li).join('') + '</ul>';
    if (items.length > shown) {
      html += '<button type="button" class="news-more-btn" data-toggle-target="news-more" ' +
        'aria-expanded="false" aria-controls="news-more">Show more</button>' +
        '<div id="news-more" hidden><ul>' + items.slice(shown).map(li).join('') + '</ul></div>';
    }
    return html;
  }

  /** Strip footnote marks (*, dagger, ...) before comparing author names. */
  function normName(n) {
    return String(n).replace(/[*†‡#^]+$/, '').trim().toLowerCase();
  }

  /** One publication / tutorial card. */
  function paperHtml(p, selfNames) {
    var authors = (p.authors || []).map(function (a) {
      var isMe = selfNames.indexOf(normName(a)) !== -1;
      return isMe ? '<span class="thisauthor">' + esc(a) + '</span>' : esc(a);
    }).join(', ');
    if (p.authors_prefix) authors = esc(p.authors_prefix) + ' ' + authors;

    var venueShort = p.venue_short;
    if (!venueShort && p.status && p.status !== 'published') {
      venueShort = p.status_label || (p.status === 'preprint' ? 'Preprint' : 'Under Review');
    }
    var venue = '';
    if (venueShort) {
      var short = '<b>' + esc(venueShort) + '</b>';
      venue = p.venue_url
        ? '<a class="confshort" href="' + esc(safeUrl(p.venue_url)) + '" target="_blank" rel="noopener">' + short + '</a>'
        : '<span class="confshort">' + short + '</span>';
      if (p.venue) venue += ' | ' + esc(p.venue);
    } else if (p.venue) {
      venue = esc(p.venue);
    }

    var html = '<div class="row"><div class="col-lg-12"><p class="paper my-2 pl-2">';
    if (p.award) html += '<i class="fas fa-trophy"></i> <b>' + esc(p.award) + '</b><br>';
    html += '<span class="papertitle">' + esc(p.title) + '</span><br>';
    if (authors) html += authors + '<br>';
    if (p.note) html += '<span style="font-size:0.85em">' + inline(p.note) + '</span><br>';
    if (venue) html += '<span class="conf">' + venue + '</span><br>';
    html += linkTags(p.links);
    html += '</p></div></div>';
    return html;
  }

  function renderPublications(data, ctx) {
    var items = newestFirst(visibleItems(data));
    var published = items.filter(function (p) { return !p.status || p.status === 'published'; });
    var other = items.filter(function (p) { return p.status && p.status !== 'published'; });

    var html = heading(data.title || 'Publications');
    html += published.map(function (p) { return paperHtml(p, ctx.selfNames); }).join('');
    if (published.length && other.length) html += '<hr class="dotted-rule">';
    html += other.map(function (p) { return paperHtml(p, ctx.selfNames); }).join('');
    return html;
  }

  function renderTutorials(data, ctx) {
    var items = newestFirst(visibleItems(data));
    return heading(data.title || 'Organized Tutorials') +
      items.map(function (p) { return paperHtml(p, ctx.selfNames); }).join('');
  }

  function renderTalks(data) {
    var items = newestFirst(visibleItems(data));
    var html = heading(data.title || 'Invited Talks & Symposiums');
    items.forEach(function (t) {
      var when = t.date_label || fmtShortDate(t.date);
      var event = '';
      if (t.event) {
        var b = '<b>' + esc(t.event) + '</b>';
        event = t.event_url
          ? '<a class="confshort" href="' + esc(safeUrl(t.event_url)) + '" target="_blank" rel="noopener">' + b + '</a>'
          : '<span class="confshort">' + b + '</span>';
      }
      var tags = linkTags(t.links);
      var line = [event, tags].filter(Boolean).join(' &nbsp;|&nbsp; ');

      html += '<div class="row"><div class="col-lg-12"><p class="paper my-2 pl-2">' +
        '<span class="papertitle">' + (when ? esc(when) + ' &nbsp;|&nbsp; ' : '') + inline(t.title) + '</span><br>' +
        (line ? '<span class="conf">' + line + '</span>' : '') +
        '</p></div></div>';
    });
    return html;
  }

  /** Plain bullet list; items can be strings or {"text": "..."}. */
  function renderList(data, ctx, defaultTitle) {
    var items = ((data && data.items) || []).filter(function (it) { return it && !it.hidden; });
    return heading(data.title || defaultTitle) + '<ul>' + items.map(function (it) {
      return '<li>' + inline(typeof it === 'string' ? it : it.text) + '</li>';
    }).join('') + '</ul>';
  }

  /* ---- "Things" page: photo tiles with category filters ---- */

  var THING_PLACEHOLDER = 'images/things/placeholder.svg';

  function renderThings(data) {
    var items = visibleItems(data).filter(function (it) { return it.name; });

    // filter chips: "categories" fixes the order; any other category is appended
    var cats = (data.categories || []).slice();
    items.forEach(function (it) {
      if (it.category && cats.indexOf(it.category) === -1) cats.push(it.category);
    });

    function chip(label, value, active) {
      return '<button type="button" class="things-chip' + (active ? ' active' : '') +
        '" data-filter="' + esc(value) + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
        esc(label) + '</button>';
    }

    function tile(it) {
      var meta = [it.category, it.since ? 'since ' + it.since : ''].filter(Boolean).join(' · ');
      var inner =
        '<span class="thing-img' + (it.image_fit === 'cover' ? ' thing-img-cover' : '') + '"><img src="' + esc(safeUrl(it.image || THING_PLACEHOLDER)) + '" alt="' +
        esc(it.image_alt || it.name) + '" loading="lazy"></span>' +
        '<span class="thing-name">' + esc(it.name) + '</span>' +
        (it.note ? '<span class="thing-note">' + esc(it.note) + '</span>' : '') +
        (meta ? '<span class="thing-meta">' + esc(meta) + '</span>' : '');
      var card = it.url
        ? '<a class="thing-card" href="' + esc(safeUrl(it.url)) + '" target="_blank" rel="noopener">' + inner + '</a>'
        : '<div class="thing-card">' + inner + '</div>';
      return '<div class="col-6 col-lg-4 thing" data-category="' + esc(it.category || '') + '">' + card + '</div>';
    }

    var html = heading(data.title || 'Things');
    if (data.intro) html += '<p class="things-intro">' + inline(data.intro) + '</p>';
    if (cats.length > 1) {
      html += '<div class="things-filters" role="group" aria-label="Filter by category">' +
        chip('All', '', true) + cats.map(function (c) { return chip(c, c, false); }).join('') + '</div>';
    }
    html += '<div class="row things-grid">' + items.map(tile).join('') + '</div>';
    return html;
  }

  /** Wire up the chips and the missing-image fallback after the page is rendered. */
  function initThings(root) {
    var chips = root.querySelectorAll('.things-chip');
    var tiles = root.querySelectorAll('.thing');
    Array.prototype.forEach.call(chips, function (btn) {
      btn.addEventListener('click', function () {
        var want = btn.getAttribute('data-filter');
        Array.prototype.forEach.call(chips, function (c) {
          var on = c === btn;
          c.classList.toggle('active', on);
          c.setAttribute('aria-pressed', String(on));
        });
        Array.prototype.forEach.call(tiles, function (t) {
          var show = !want || t.getAttribute('data-category') === want;
          if (show) t.removeAttribute('hidden'); else t.setAttribute('hidden', '');
        });
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll('.thing-img img'), function (img) {
      img.addEventListener('error', function onErr() {
        img.removeEventListener('error', onErr);
        img.src = THING_PLACEHOLDER;
      });
    });
  }

  /* ---- "McDonald's" page: world map + list of countries ---- */

  var WORLD_MAP_URL = 'images/world-map.json';
  var mcCodes = [];   // unique ISO codes of visited countries (set by renderMcdonalds)
  var mcNames = {};   // code -> display name
  var regionNames = null;

  /** "IN" -> flag emoji. Returns '' for anything that is not two capital letters. */
  function flagEmoji(code) {
    if (!/^[A-Z]{2}$/.test(code)) return '';
    return String.fromCodePoint(0x1F1E6 + code.charCodeAt(0) - 65, 0x1F1E6 + code.charCodeAt(1) - 65);
  }

  /** "IN" -> "India" using the browser's built-in region names. */
  function countryName(code) {
    try {
      regionNames = regionNames || new Intl.DisplayNames(['en'], { type: 'region' });
      return regionNames.of(code) || code;
    } catch (e) {
      return code;
    }
  }

  function renderMcdonalds(data) {
    var items = newestFirst(visibleItems(data)).filter(function (it) {
      return /^[A-Za-z]{2}$/.test(String(it.country || '').trim());
    });
    items.forEach(function (it) { it.country = String(it.country).trim().toUpperCase(); });

    mcCodes = [];
    mcNames = {};
    items.forEach(function (it) {
      if (mcCodes.indexOf(it.country) === -1) mcCodes.push(it.country);
      if (!mcNames[it.country]) mcNames[it.country] = it.name || countryName(it.country);
    });
    var n = mcCodes.length;

    function card(it) {
      var when = it.date ? fmtDate(it.date) : '';
      return '<div class="col-6 col-lg-4 mc-tile"><div class="mc-tile-in">' +
        (it.badge ? '<span class="mc-badge" aria-hidden="true">' + esc(it.badge) + '</span>' : '') +
        '<span class="mc-flag" aria-hidden="true">' + esc(flagEmoji(it.country)) + '</span>' +
        '<span class="mc-name">' + esc(it.name || countryName(it.country)) +
          (it.when ? '<span class="mc-when"> | ' + inline(it.when) + '</span>' : '') + '</span>' +
        (it.order ? '<span class="mc-order"><i class="fas fa-hamburger" aria-hidden="true"></i> ' + esc(it.order) + '</span>' : '') +
        (it.note ? '<span class="mc-note">' + esc(it.note) + '</span>' : '') +
        (when ? '<span class="mc-date">' + esc(when) + '</span>' : '') +
        '</div></div>';
    }

    var html = heading(data.title || "McDonald's Around the World");
    if (data.intro) html += '<p class="things-intro">' + inline(data.intro) + '</p>';
    html += '<p class="mc-count"><span class="mc-count-num">' + n + '</span> ' +
      (n === 1 ? 'country' : 'countries') + ' visited</p>';
    html += '<div class="mc-map" id="mc-map" role="img" aria-label="World map with ' + n +
      (n === 1 ? ' country' : ' countries') + ' highlighted"></div>';
    html += n ? '<div class="row mc-list">' + items.map(card).join('') + '</div>'
              : '<p class="things-intro">No countries added yet.</p>';
    return html;
  }

  /** Fetch the pre-projected world outlines and draw the map into #mc-map. */
  function initMcdonalds(root) {
    var box = root.querySelector('#mc-map');
    if (!box) return;
    fetch(WORLD_MAP_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (map) {
        var visited = {};
        mcCodes.forEach(function (c) { visited[c] = true; });
        var base = [];
        var hit = [];
        Object.keys(map.paths).forEach(function (code) {
          if (visited[code]) {
            hit.push('<path class="mc-country mc-visited" d="' + esc(map.paths[code]) + '"><title>' +
              esc(mcNames[code] || code) + '</title></path>');
          } else {
            base.push('<path class="mc-country" d="' + esc(map.paths[code]) + '"></path>');
          }
        });

        // Far-flung pieces (French Guiana etc.) are drawn as plain land and never shaded
        Object.keys(map.overseas || {}).forEach(function (code) {
          base.push('<path class="mc-country" d="' + esc(map.overseas[code]) + '"></path>');
        });

        box.innerHTML = '<svg viewBox="' + esc(map.viewBox) + '" focusable="false" aria-hidden="true">' +
          base.join('') + hit.join('') + '</svg>';
      })
      .catch(function (e) {
        box.innerHTML = '<div class="data-error"><b>Could not load <code>' + esc(WORLD_MAP_URL) +
          '</code></b><br>' + esc(e.message) + '</div>';
      });
  }

  var SECTIONS = {
    about: { render: renderAbout },
    things: { render: renderThings },
    mcdonalds: { render: renderMcdonalds },
    news: { render: renderNews, noRuleBefore: true },
    publications: { render: renderPublications },
    tutorials: { render: renderTutorials },
    talks: { render: renderTalks },
    responsibilities: {
      render: function (d, c) { return renderList(d, c, 'Position of Responsibility'); }
    },
    teaching: {
      render: function (d, c) { return renderList(d, c, 'Teaching'); },
      noRuleBefore: true
    }
  };

  function renderSidebar(profile, page) {
    var name = profile.name || {};
    var html = '<p class="name"><span style="font-weight: 600;">' + esc(name.first || '') + ' ' + esc(name.last || '') + ' </span></p>';
    if (profile.photo) {
      html += '<img src="' + esc(safeUrl(profile.photo)) + '" alt="' +
        esc(((name.first || '') + ' ' + (name.last || '')).trim()) +
        '" class="profilepic mt-3 mb-2 rounded ml-2">';
    }
    html += '<div class="pt-5 menur"></div>';
    if (profile.email) html += esc(profile.email);
    html += '<hr>';
    var links = (profile.links || []).slice();
    if (page && page !== 'home') {
      links.unshift({ label: 'Home', url: 'index.html', icon: 'fas fa-home', same_tab: true });
    }
    links.forEach(function (l) {
      var icon = /^[\w\- ]+$/.test(l.icon || '') ? l.icon : 'fas fa-link';
      var target = l.same_tab ? '' : ' target="_blank" rel="noopener"';
      html += '<div><a class="menulink"' + target + ' href="' + esc(safeUrl(l.url)) + '">' +
        '<i class="' + icon + '"></i>&nbsp; ' + esc(l.label) + '</a></div>';
    });
    return html;
  }

  /* ------------------------------------------------------------------ *
   * Loading + error handling
   * ------------------------------------------------------------------ */

  function errorBox(file, message) {
    return '<div class="data-error"><b>Could not load <code>' + esc(DATA_DIR + file + '.json') +
      '</code></b><br>' + esc(message) + '</div>';
  }

  function loadJson(name) {
    return fetch(DATA_DIR + name + '.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' (file missing?)');
        return res.text();
      })
      .then(function (text) {
        try {
          return JSON.parse(text);
        } catch (e) {
          throw new Error('Invalid JSON: ' + e.message);
        }
      });
  }

  /** Resolves to {ok, data} or {ok:false, error} - never rejects. */
  function tryLoad(name) {
    return loadJson(name).then(
      function (data) { return { ok: true, data: data }; },
      function (err) { return { ok: false, error: err.message }; }
    );
  }

  function setMeta(site, fullName) {
    var title = site.title || fullName;
    if (title) document.title = title;
    if (site.description) {
      var meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', site.description);
    }
  }

  // Loads Google Tag Manager (GTM-...) or Google Analytics 4 (G-...) from site.json "analytics_id".
  // Skipped when the field is empty and when running on localhost, so local testing is not counted.
  function loadAnalytics(id) {
    if (!id || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
    id = String(id).trim();
    var s = document.createElement('script');
    s.async = true;
    window.dataLayer = window.dataLayer || [];
    if (/^GTM-[A-Z0-9]+$/.test(id)) {
      window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      s.src = 'https://www.googletagmanager.com/gtm.js?id=' + id;
    } else if (/^G-[A-Z0-9]+$/.test(id)) {
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', id);
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    } else {
      return;
    }
    document.head.appendChild(s);
  }

  function init() {
    var sidebarEl = document.getElementById('sidebar');
    var mainEl = document.getElementById('main');
    // index.html is the home page; other pages set <body data-page="name">
    var page = document.body.getAttribute('data-page') || 'home';

    if (location.protocol === 'file:') {
      mainEl.innerHTML = '<div class="data-error"><b>Open this site through a local web server.</b><br>' +
        'Browsers block loading JSON files from <code>file://</code>. From the site folder run ' +
        '<code>python3 -m http.server 8000</code> and open <code>http://localhost:8000</code>.</div>';
      return;
    }

    // Fetch profile.json in parallel with site.json so the sidebar can appear immediately.
    var profileP = tryLoad('profile');
    profileP.then(function (r) {
      if (r.ok) sidebarEl.innerHTML = renderSidebar(r.data, page);
    });

    tryLoad('site').then(function (siteRes) {
      if (!siteRes.ok) {
        mainEl.innerHTML = errorBox('site', siteRes.error);
        return;
      }
      var site = siteRes.data;
      loadAnalytics(site.analytics_id);
      var order = (page === 'home' ? (site.sections || []) : [page]).filter(function (s) { return SECTIONS[s]; });

      return Promise.all([profileP].concat(order.map(tryLoad))).then(function (results) {
        var profileRes = results[0];
        var profile = profileRes.ok ? profileRes.data : {};
        var fullName = ((profile.name && profile.name.first) || '') + ' ' +
          ((profile.name && profile.name.last) || '');

        var selfNames = (site.author_names && site.author_names.length ? site.author_names : [fullName.trim()])
          .map(normName);
        var ctx = { selfNames: selfNames };

        if (!profileRes.ok) sidebarEl.innerHTML = errorBox('profile', profileRes.error);
        setMeta(site, fullName.trim());

        var html = '';
        order.forEach(function (key, i) {
          var res = results[i + 1];
          var body;
          if (!res.ok) {
            body = errorBox(key, res.error);
          } else {
            try {
              body = SECTIONS[key].render(res.data, ctx);
            } catch (e) {
              body = errorBox(key, 'Unexpected data shape: ' + e.message);
            }
          }
          if (page !== 'home' && res.ok && res.data && res.data.title) {
            document.title = res.data.title + ' | ' + (site.title || fullName.trim());
          }
          if (i > 0 && !SECTIONS[key].noRuleBefore) html += '<hr>';
          html += '<section id="' + esc(key) + '">' + body + '</section>';
        });

        if (site.footer) {
          html += '<br><span class="site-footer"><i class="fa fa-external-link" aria-hidden="true"></i>&nbsp; ' +
            inline(site.footer) + '</span>';
        }
        mainEl.innerHTML = html;
        if (mainEl.querySelector('.things-grid')) initThings(mainEl);
        if (mainEl.querySelector('.mc-map')) initMcdonalds(mainEl);

        // "Show more" toggle for news
        Array.prototype.forEach.call(mainEl.querySelectorAll('[data-toggle-target]'), function (btn) {
          btn.addEventListener('click', function () {
            var target = document.getElementById(btn.getAttribute('data-toggle-target'));
            var open = target.hasAttribute('hidden');
            if (open) target.removeAttribute('hidden'); else target.setAttribute('hidden', '');
            btn.setAttribute('aria-expanded', String(open));
            btn.textContent = open ? 'Show less' : 'Show more';
          });
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
