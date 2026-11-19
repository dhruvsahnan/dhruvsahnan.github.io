/* Renders the whole page from the JSON files in data/.
 *
 * You normally never need to edit this file. To add news, papers, talks etc.
 * edit the matching file in data/ (see data/README.md for every field).
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

  var SECTIONS = {
    about: { render: renderAbout },
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

  function renderSidebar(profile) {
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
    (profile.links || []).forEach(function (l) {
      var icon = /^[\w\- ]+$/.test(l.icon || '') ? l.icon : 'fas fa-link';
      html += '<div><a class="menulink" target="_blank" rel="noopener" href="' + esc(safeUrl(l.url)) + '">' +
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
    return fetch(DATA_DIR + name + '.json', { cache: 'no-cache' })
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

  function init() {
    var sidebarEl = document.getElementById('sidebar');
    var mainEl = document.getElementById('main');

    if (location.protocol === 'file:') {
      mainEl.innerHTML = '<div class="data-error"><b>Open this site through a local web server.</b><br>' +
        'Browsers block loading JSON files from <code>file://</code>. From the site folder run ' +
        '<code>python3 -m http.server 8000</code> and open <code>http://localhost:8000</code>.</div>';
      return;
    }

    tryLoad('site').then(function (siteRes) {
      if (!siteRes.ok) {
        mainEl.innerHTML = errorBox('site', siteRes.error);
        return;
      }
      var site = siteRes.data;
      var order = (site.sections || []).filter(function (s) { return SECTIONS[s]; });

      return Promise.all([tryLoad('profile')].concat(order.map(tryLoad))).then(function (results) {
        var profileRes = results[0];
        var profile = profileRes.ok ? profileRes.data : {};
        var fullName = ((profile.name && profile.name.first) || '') + ' ' +
          ((profile.name && profile.name.last) || '');

        var selfNames = (site.author_names && site.author_names.length ? site.author_names : [fullName.trim()])
          .map(normName);
        var ctx = { selfNames: selfNames };

        sidebarEl.innerHTML = profileRes.ok ? renderSidebar(profile) : errorBox('profile', profileRes.error);
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
          if (i > 0 && !SECTIONS[key].noRuleBefore) html += '<hr>';
          html += '<section id="' + esc(key) + '">' + body + '</section>';
        });

        if (site.footer) {
          html += '<br><span class="site-footer"><i class="fa fa-external-link" aria-hidden="true"></i>&nbsp; ' +
            inline(site.footer) + '</span>';
        }
        mainEl.innerHTML = html;

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
