/* Blog engine — posts are markdown files in /posts, listed in /posts.json.
   To add a post: create posts/<slug>.md with frontmatter, then add "<slug>" to posts.json. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var feed = $('feedView'), article = $('articleView'), head = $('blogHead');

  var posts = [];

  /* ── markdown ── */
  function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function inline(s) {
    return esc(s)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*|#[^\s)]*)\)/g,
        '<a href="$2" rel="noopener">$1</a>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }
  function render(body) {
    return (body || '').split(/\n{2,}/).map(function (b) {
      var t = b.trim();
      if (!t) return '';
      if (t.indexOf('### ') === 0) return '<h3>' + inline(t.slice(4)) + '</h3>';
      if (t.indexOf('## ') === 0) return '<h2>' + inline(t.slice(3)) + '</h2>';
      if (t.indexOf('> ') === 0) return '<blockquote>' + inline(t.replace(/^>\s?/gm, '')) + '</blockquote>';
      if (/^-\s/.test(t)) {
        var items = t.split('\n').filter(function (l) { return /^-\s/.test(l.trim()); })
          .map(function (l) { return '<li>' + inline(l.trim().slice(2)) + '</li>'; }).join('');
        return '<ul>' + items + '</ul>';
      }
      return '<p>' + inline(t).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }
  function parse(raw, slug) {
    var meta = { slug: slug, title: slug, date: '', excerpt: '', tags: [] };
    var body = raw;
    var m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (m) {
      body = m[2];
      m[1].split('\n').forEach(function (line) {
        var i = line.indexOf(':');
        if (i < 0) return;
        var k = line.slice(0, i).trim();
        var v = line.slice(i + 1).trim();
        if (k === 'tags') {
          meta.tags = v.replace(/^\[|\]$/g, '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        } else if (k in meta) {
          meta[k] = v.replace(/^["']|["']$/g, '');
        }
      });
    }
    meta.body = body.trim();
    return meta;
  }

  /* ── helpers ── */
  function fmtDate(iso) {
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
  }
  function readTime(body) {
    var words = (body || '').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 220)) + ' MIN READ';
  }

  /* ── views ── */
  function show(view) {
    feed.style.display = view === 'feed' ? 'block' : 'none';
    head.style.display = view === 'feed' ? 'block' : 'none';
    article.classList.toggle('is-on', view === 'article');
    window.scrollTo(0, 0);
  }

  function renderFeed() {
    var host = $('postList');
    host.innerHTML = '';
    $('emptyState').style.display = posts.length ? 'none' : 'block';
    $('feedCount').textContent = posts.length
      ? posts.length + (posts.length === 1 ? ' post' : ' posts') : '';

    posts.forEach(function (p, i) {
      var row = document.createElement('a');
      row.className = 'post-row';
      row.href = '#post/' + p.slug;
      row.innerHTML =
        '<div class="post-num">' + String(i + 1).padStart(2, '0') + '</div>' +
        '<div>' +
          '<div class="post-date">' + fmtDate(p.date) + '</div>' +
          '<div class="post-title">' + esc(p.title) + '</div>' +
          '<p class="post-excerpt">' + esc(p.excerpt) + '</p>' +
          '<div class="post-tags">' + p.tags.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' +
        '</div>' +
        '<div class="post-meta-right"><span class="post-read">' + readTime(p.body) + '</span></div>';
      host.appendChild(row);
    });
  }

  function openArticle(slug) {
    var p = posts.find(function (x) { return x.slug === slug; });
    if (!p) { location.hash = ''; return; }
    document.title = p.title + ' — Samarth Madhivanan';
    $('articleTitle').textContent = p.title;
    $('articleMeta').textContent = fmtDate(p.date) + '  ·  ' + readTime(p.body) +
      (p.tags.length ? '  ·  ' + p.tags.join(' / ') : '');
    $('articleBody').innerHTML = render(p.body);
    show('article');
  }

  function route() {
    var h = location.hash;
    if (h.indexOf('#post/') === 0) return openArticle(h.slice(6));
    document.title = 'Blog — Samarth Madhivanan';
    renderFeed();
    show('feed');
  }

  /* ── load ── */
  $('backLink').addEventListener('click', function (e) { e.preventDefault(); location.hash = ''; });
  window.addEventListener('hashchange', route);

  fetch('posts.json')
    .then(function (r) { return r.json(); })
    .then(function (slugs) {
      return Promise.all(slugs.map(function (slug) {
        return fetch('posts/' + slug + '.md')
          .then(function (r) { return r.ok ? r.text() : null; })
          .then(function (txt) { return txt ? parse(txt, slug) : null; });
      }));
    })
    .then(function (list) {
      posts = list.filter(Boolean).sort(function (a, b) {
        return (b.date || '').localeCompare(a.date || '');
      });
      route();
    })
    .catch(function () {
      posts = [];
      route();
    });
})();
