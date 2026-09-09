/* Blog engine — posts persist in this browser's localStorage.
   Admin passphrase is set on first unlock and stored locally.
   Export JSON to move posts between devices (or hand them over to be baked in). */
(function () {
  const POSTS_KEY = 'sm_blog_posts_v2';
  const PASS_KEY  = 'sm_blog_pass_v1';
  const SESSION_KEY = 'sm_blog_admin_session';

  const SEED = [];

  const $ = function (id) { return document.getElementById(id); };
  const feed = $('feedView'), article = $('articleView'), editor = $('editorView'), gate = $('gateView');
  const head = $('blogHead'), adminBar = $('adminBar');

  let posts = load();
  let editingId = null;

  function load() {
    try {
      const raw = localStorage.getItem(POSTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    localStorage.setItem(POSTS_KEY, JSON.stringify(SEED));
    return SEED.slice();
  }
  function save() {
    localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
  }
  function isAdmin() {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  }

  function fmtDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
  }
  function readTime(body) {
    const words = (body || '').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 220)) + ' MIN READ';
  }
  function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function inline(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }
  function render(body) {
    const blocks = (body || '').split(/\n{2,}/);
    return blocks.map(function (b) {
      const t = b.trim();
      if (!t) return '';
      if (t.indexOf('### ') === 0) return '<h3>' + inline(t.slice(4)) + '</h3>';
      if (t.indexOf('## ') === 0) return '<h2>' + inline(t.slice(3)) + '</h2>';
      if (t.indexOf('> ') === 0) return '<blockquote>' + inline(t.replace(/^>\s?/gm, '')) + '</blockquote>';
      if (/^-\s/.test(t)) {
        const items = t.split('\n').filter(function (l) { return /^-\s/.test(l.trim()); })
          .map(function (l) { return '<li>' + inline(l.trim().slice(2)) + '</li>'; }).join('');
        return '<ul>' + items + '</ul>';
      }
      return '<p>' + inline(t).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  function visible() {
    const list = posts.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    return isAdmin() ? list : list.filter(function (p) { return p.status !== 'draft'; });
  }

  function renderFeed() {
    const list = visible();
    const host = $('postList');
    host.innerHTML = '';
    $('emptyState').style.display = list.length ? 'none' : 'block';
    $('feedCount').textContent = list.length
      ? list.length + (list.length === 1 ? ' post' : ' posts')
      : '';

    list.forEach(function (p, i) {
      const row = document.createElement('a');
      row.className = 'post-row';
      row.href = '#post/' + p.id;
      row.innerHTML =
        '<div class="post-num">' + String(i + 1).padStart(2, '0') + '</div>' +
        '<div>' +
          '<div class="post-date">' + fmtDate(p.date) + '</div>' +
          '<div class="post-title">' + esc(p.title) + '</div>' +
          '<p class="post-excerpt">' + esc(p.excerpt || '') + '</p>' +
          '<div class="post-tags">' + (p.tags || []).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' +
        '</div>' +
        '<div class="post-meta-right">' +
          (p.status === 'draft' ? '<span class="draft-flag">Draft</span>' : '') +
          '<span class="post-read">' + readTime(p.body) + '</span>' +
          (isAdmin() ? '<span class="row-admin"><button class="btn btn-sm" data-edit="' + p.id + '">Edit</button></span>' : '') +
        '</div>';
      host.appendChild(row);
    });

    host.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openEditor(b.dataset.edit);
      });
    });
  }

  function show(view) {
    [feed, article, editor, gate].forEach(function (v) { v.classList.remove('is-on'); });
    feed.style.display = 'none';
    head.style.display = 'none';
    if (view === 'feed') { feed.style.display = 'block'; head.style.display = 'block'; }
    else if (view === 'article') article.classList.add('is-on');
    else if (view === 'editor') editor.classList.add('is-on');
    else if (view === 'gate') gate.classList.add('is-on');
    window.scrollTo(0, 0);
  }

  function openArticle(id) {
    const p = posts.find(function (x) { return x.id === id; });
    if (!p) { location.hash = ''; return; }
    $('articleTitle').textContent = p.title;
    $('articleMeta').innerHTML = fmtDate(p.date) + ' &nbsp;·&nbsp; ' + readTime(p.body) +
      ((p.tags || []).length ? ' &nbsp;·&nbsp; ' + p.tags.join(' / ') : '') +
      (p.status === 'draft' ? ' &nbsp;·&nbsp; DRAFT' : '');
    $('articleBody').innerHTML = render(p.body);
    show('article');
  }

  function openEditor(id) {
    if (!isAdmin()) { location.hash = '#admin'; return; }
    editingId = id || null;
    const p = id ? posts.find(function (x) { return x.id === id; }) : null;
    $('editorTitle').textContent = p ? 'Edit post' : 'New post';
    $('fTitle').value = p ? p.title : '';
    $('fDate').value = p ? p.date : new Date().toISOString().slice(0, 10);
    $('fStatus').value = p ? (p.status || 'published') : 'published';
    $('fTags').value = p ? (p.tags || []).join(', ') : '';
    $('fExcerpt').value = p ? (p.excerpt || '') : '';
    $('fBody').value = p ? (p.body || '') : '';
    $('deleteBtn').style.display = p ? 'inline-flex' : 'none';
    show('editor');
  }

  function route() {
    const h = location.hash;
    if (h.indexOf('#post/') === 0) return openArticle(h.slice(6));
    if (h === '#admin') {
      if (isAdmin()) { renderFeed(); return show('feed'); }
      return openGate();
    }
    if (h === '#new') return openEditor(null);
    renderFeed();
    show('feed');
  }

  function openGate() {
    const first = !localStorage.getItem(PASS_KEY);
    $('gateTitle').textContent = first ? 'Set a passphrase' : 'Admin';
    $('gateCopy').textContent = first
      ? 'First time here — pick a passphrase. It is stored in this browser only, so this is a convenience lock, not real security.'
      : 'Enter your passphrase to manage posts.';
    $('gateGo').textContent = first ? 'Set passphrase' : 'Unlock';
    $('gatePass').value = '';
    $('gateErr').textContent = '';
    show('gate');
    setTimeout(function () { $('gatePass').focus(); }, 60);
  }

  function tryUnlock() {
    const val = $('gatePass').value.trim();
    if (!val) { $('gateErr').textContent = 'Enter something first.'; return; }
    const stored = localStorage.getItem(PASS_KEY);
    if (!stored) {
      if (val.length < 4) { $('gateErr').textContent = 'Use at least 4 characters.'; return; }
      localStorage.setItem(PASS_KEY, val);
    } else if (val !== stored) {
      $('gateErr').textContent = 'Not that one.';
      return;
    }
    sessionStorage.setItem(SESSION_KEY, '1');
    adminBar.classList.add('is-on');
    location.hash = '';
    renderFeed();
    show('feed');
  }

  /* ── events ── */
  $('gateGo').addEventListener('click', tryUnlock);
  $('gatePass').addEventListener('keydown', function (e) { if (e.key === 'Enter') tryUnlock(); });
  $('gateCancel').addEventListener('click', function () { location.hash = ''; route(); });
  $('adminToggle').addEventListener('click', function () {
    if (isAdmin()) { renderFeed(); show('feed'); } else openGate();
  });
  $('backLink').addEventListener('click', function (e) { e.preventDefault(); location.hash = ''; });
  $('newPostBtn').addEventListener('click', function () { openEditor(null); });
  $('cancelBtn').addEventListener('click', function () { location.hash = ''; route(); });

  $('saveBtn').addEventListener('click', function () {
    const title = $('fTitle').value.trim();
    if (!title) { $('fTitle').focus(); return; }
    const data = {
      title: title,
      date: $('fDate').value || new Date().toISOString().slice(0, 10),
      status: $('fStatus').value,
      tags: $('fTags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean),
      excerpt: $('fExcerpt').value.trim(),
      body: $('fBody').value
    };
    if (editingId) {
      const i = posts.findIndex(function (p) { return p.id === editingId; });
      if (i > -1) posts[i] = Object.assign({}, posts[i], data);
    } else {
      data.id = 'p-' + Date.now().toString(36);
      posts.push(data);
    }
    save();
    editingId = null;
    location.hash = '';
    renderFeed();
    show('feed');
  });

  $('deleteBtn').addEventListener('click', function () {
    if (!editingId) return;
    if (!confirm('Delete this post? This cannot be undone.')) return;
    posts = posts.filter(function (p) { return p.id !== editingId; });
    save();
    editingId = null;
    location.hash = '';
    renderFeed();
    show('feed');
  });

  $('lockBtn').addEventListener('click', function () {
    sessionStorage.removeItem(SESSION_KEY);
    adminBar.classList.remove('is-on');
    location.hash = '';
    renderFeed();
    show('feed');
  });

  $('exportBtn').addEventListener('click', function () {
    const blob = new Blob([JSON.stringify(posts, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'blog-posts.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('importBtn').addEventListener('click', function () { $('importFile').click(); });
  $('importFile').addEventListener('change', function (e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const incoming = JSON.parse(reader.result);
        if (!Array.isArray(incoming)) throw new Error('not an array');
        const byId = {};
        posts.concat(incoming).forEach(function (p) { if (p && p.id) byId[p.id] = p; });
        posts = Object.keys(byId).map(function (k) { return byId[k]; });
        save();
        renderFeed();
        show('feed');
        alert('Imported ' + incoming.length + ' post(s).');
      } catch (err) {
        alert('That file did not parse as a posts export.');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  window.addEventListener('hashchange', route);
  if (isAdmin()) adminBar.classList.add('is-on');
  route();
})();
