/* NATUREFreak site behaviour: directory filters, registration steps, forms, journal filters. No dependencies. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } }
  };
  var params = new URLSearchParams(location.search);
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var HANDLE = /^@?[A-Za-z0-9._]{1,30}$/;
  var uid = 0;
  var DRAFT = 'nf-join-draft';

  function isUrl(v) { try { var u = new URL(v); return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.indexOf('.') > 0; } catch (e) { return false; } }
  function tomorrow() { var d = new Date(Date.now() + 864e5); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function setUrl(p) { var s = p.toString(); try { history.replaceState(null, '', location.pathname + (s ? '?' + s : '')); } catch (e) { /* ignore */ } }

  /* ---------- sending ---------- */
  function send(path, data) {
    return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.text().then(function (t) { var j = {}; try { j = JSON.parse(t); } catch (e) { /* not JSON */ } return { status: r.status, body: j || {} }; }); })
      .catch(function () { return { status: 0, body: {} }; })
      .then(function (r) {
        if (r.status >= 200 && r.status < 300 && r.body.ok) return { state: 'ok', body: r.body };
        if (r.status === 400 && r.body.errors) return { state: 'invalid', errors: r.body.errors };
        return { state: 'offline' };
      });
  }

  /* ---------- validation ---------- */
  var tick = function (msg) { return function (v, el) { return el.checked ? '' : msg; }; };
  var RULES = {
    name: function (v) { return v.length < 2 ? 'Enter your name.' : ''; },
    email: function (v) { return EMAIL.test(v) ? '' : 'Enter an email address, like name@example.com.'; },
    location: function (v) { return v.length < 2 ? 'Enter your town and country.' : ''; },
    username: function (v) { return HANDLE.test(v) ? '' : 'Enter an Instagram username, like @yourhandle.'; },
    instagram: function (v) { return !v || HANDLE.test(v) ? '' : 'Enter an Instagram username, like @yourhandle.'; },
    website: function (v) { return !v || isUrl(v) ? '' : 'Enter a web address, like https://example.com.'; },
    media: function (v) { return isUrl(v) ? '' : 'Paste a link to your photo or reel, starting with https://.'; },
    caption: function (v) { return v.length < 3 ? 'Write the caption you want us to post.' : ''; },
    date: function (v) { return !v ? 'Choose a date.' : (v < tomorrow() ? 'Choose a date from tomorrow onwards.' : ''); },
    time: function (v) { return v ? '' : 'Choose a time.'; },
    message: function (v) { return v.length < 10 ? 'Write your message (at least 10 characters).' : ''; },
    bio: function (v) { return v.length > 280 ? 'Keep your bio to 280 characters.' : ''; },
    own: tick('Tick this box to confirm the work is your own.'),
    label: tick('Tick this box to continue.'),
    terms: tick('Tick this box to agree to the terms and privacy policy.')
  };
  function controls(scope, name) { return $$('[name="' + name + '"]', scope); }
  function setErr(scope, name, msg) {
    var p = $('[data-err="' + name + '"]', scope), list = controls(scope, name);
    if (p) { if (!p.id) p.id = 'nf-err-' + (++uid); p.textContent = msg || ''; p.hidden = !msg; }
    list.forEach(function (c) {
      if (c.type !== 'checkbox' && c.type !== 'radio') c.classList.toggle('nf-bad', !!msg);
      if (msg) { c.setAttribute('aria-invalid', 'true'); if (p) c.setAttribute('aria-describedby', p.id); }
      else { c.removeAttribute('aria-invalid'); c.removeAttribute('aria-describedby'); }
    });
  }
  function check(scope, name) {
    var list = controls(scope, name), el = list[0], msg = '';
    if (!el) return null;
    if (name === 'specialisms') {
      var n = list.filter(function (c) { return c.checked; }).length;
      msg = n < 1 ? 'Choose at least one.' : (n > 3 ? 'Choose up to 3.' : '');
    } else if (el.type === 'radio') {
      msg = list.some(function (c) { return c.checked; }) ? '' : (name === 'time' ? 'Choose a time.' : 'Choose one.');
    } else if (RULES[name]) { msg = RULES[name](el.value.trim(), el); }
    setErr(scope, name, msg);
    return msg ? el : null;
  }
  function validate(scope, names) {
    var first = null;
    names.forEach(function (n) { var bad = check(scope, n); if (bad && !first) first = bad; });
    return first;
  }
  function names(scope) {
    var out = [];
    $$('input[name], textarea[name], select[name]', scope).forEach(function (c) { if (c.name !== 'company' && out.indexOf(c.name) < 0) out.push(c.name); });
    return out;
  }
  function collect(scope) {
    var data = {};
    $$('input[name], textarea[name], select[name]', scope).forEach(function (c) {
      if (c.type === 'checkbox') {
        if (controls(scope, c.name).length > 1) { data[c.name] = data[c.name] || []; if (c.checked) data[c.name].push(c.value); }
        else data[c.name] = c.checked;
      } else if (c.type === 'radio') { if (c.checked) data[c.name] = c.value; else if (!(c.name in data)) data[c.name] = ''; }
      else data[c.name] = c.value.trim();
    });
    return data;
  }
  function say(el, msg) { if (el) { el.textContent = msg || ''; el.hidden = !msg; } }
  function applyErrors(scope, errors) {
    var first = null;
    Object.keys(errors).forEach(function (n) { setErr(scope, n, errors[n]); var c = controls(scope, n)[0]; if (c && !first) first = c; });
    return first;
  }
  // Add https:// to a web address typed without it.
  $$('input[type="url"]').forEach(function (c) {
    c.addEventListener('blur', function () { var v = c.value.trim(); if (v && !/^https?:\/\//i.test(v) && v.indexOf('.') > 0) c.value = 'https://' + v; });
  });

  /* ---------- simple forms: booking, newsletter, contact ---------- */
  var OFFLINE = {
    booking: 'Bookings aren’t open yet, so this request wasn’t sent. Please try again soon.',
    subscribe: 'The newsletter isn’t open for sign-ups yet, so your address wasn’t saved. Please try again soon.',
    contact: 'This form isn’t switched on yet, so your message wasn’t sent. For now, message @naturefreak_hd on Instagram.'
  };
  $$('form[data-nf]').forEach(function (form) {
    var kind = form.getAttribute('data-nf'), wrap = form.closest('[data-form-wrap]') || form.parentNode;
    var statusEl = $('[data-status]', form), doneEl = $('[data-done]', wrap), btn = $('button[type="submit"]', form);
    var date = $('input[type="date"]', form); if (date) date.min = tomorrow();
    if (kind === 'booking') {
      var formats = controls(form, 'format');
      var relabel = function () {
        var f = formats.filter(function (c) { return c.checked; })[0];
        if (f) btn.textContent = 'Request my ' + f.getAttribute('data-label') + ' slot · £' + f.getAttribute('data-price');
      };
      var choose = function (v) { formats.forEach(function (c) { if (c.value === v) c.checked = true; }); relabel(); };
      choose(params.get('format') || '');
      formats.forEach(function (c) { c.addEventListener('change', relabel); });
      // "Book a reel" buttons on this page pick the format and jump to the form.
      $$('a[data-format]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault(); choose(a.getAttribute('data-format'));
          $('#book').scrollIntoView({ block: 'start' }); $('[name="username"]', form).focus({ preventScroll: true });
        });
      });
    }
    names(form).forEach(function (n) { controls(form, n).forEach(function (c) { c.addEventListener('input', function () { if (c.getAttribute('aria-invalid')) check(form, n); }); }); });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); say(statusEl, '');
      var bad = validate(form, names(form)); if (bad) { bad.focus(); return; }
      var label = btn.textContent; btn.disabled = true; btn.textContent = 'Sending…';
      var data = collect(form); if (kind === 'booking') data.label = data.own;
      send('/api/' + kind, data).then(function (r) {
        btn.disabled = false; btn.textContent = label;
        if (r.state === 'ok') { form.hidden = true; doneEl.hidden = false; doneEl.focus(); }
        else if (r.state === 'invalid') { var f = applyErrors(form, r.errors); if (f) f.focus(); }
        else say(statusEl, OFFLINE[kind]);
      });
    });
  });

  /* ---------- home: start registration ---------- */
  var start = $('form[data-nf-start]');
  if (start) (function () {
    ['name', 'email'].forEach(function (n) { controls(start, n)[0].addEventListener('input', function (e) { if (e.target.getAttribute('aria-invalid')) check(start, n); }); });
    start.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = validate(start, ['name', 'email']); if (bad) { bad.focus(); return; }
      var d = store.get(DRAFT) || {}, v = collect(start); d.name = v.name; d.email = v.email; store.set(DRAFT, d);
      location.href = '/join.html';
    });
  })();

  /* ---------- directory ---------- */
  var plist = $('#plist');
  if (plist) (function () {
    var q = $('#dq'), chips = $$('#dchips .nf-chip'), hire = $('#dhire'), sort = $('#dsort'), count = $('#dcount'), empty = $('#dempty'), note = $('#dnote'), tpl = $('#prow-tpl');
    var state = { q: params.get('q') || '', tag: (params.get('tag') || 'all').toLowerCase(), hire: params.get('hire') === '1', sort: params.get('sort') || 'new' };
    if (!chips.some(function (c) { return c.dataset.val === state.tag; })) state.tag = 'all';
    if (['new', 'name', 'loc'].indexOf(state.sort) < 0) state.sort = 'new';
    q.value = state.q; hire.checked = state.hire; sort.value = state.sort;
    function rows() { return $$('[data-row]', plist); }
    function apply() {
      var words = state.q.toLowerCase().split(/\s+/).filter(Boolean), shown = 0, list = rows();
      list.sort(function (a, b) {
        if (state.sort === 'name') return a.dataset.name.localeCompare(b.dataset.name);
        if (state.sort === 'loc') return a.dataset.loc.localeCompare(b.dataset.loc) || a.dataset.name.localeCompare(b.dataset.name);
        return Number(a.dataset.order) - Number(b.dataset.order);
      }).forEach(function (r) { plist.appendChild(r); });
      list.forEach(function (r) {
        var d = r.dataset, hay = (d.name + ' ' + d.loc + ' ' + d.tags + ' ' + d.bio).toLowerCase();
        var ok = words.every(function (w) { return hay.indexOf(w) > -1; }) &&
          (state.tag === 'all' || d.tags.toLowerCase().split(',').indexOf(state.tag) > -1) && (!state.hire || d.hire === '1');
        r.hidden = !ok; if (ok) shown++;
      });
      count.textContent = shown + (shown === 1 ? ' photographer' : ' photographers');
      empty.hidden = shown > 0;
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.val === state.tag)); });
      var p = new URLSearchParams();
      if (state.q) p.set('q', state.q); if (state.tag !== 'all') p.set('tag', state.tag); if (state.hire) p.set('hire', '1'); if (state.sort !== 'new') p.set('sort', state.sort);
      setUrl(p);
    }
    function build(p, i) {
      var li = tpl.content.firstElementChild.cloneNode(true), tags = (p.specialisms || p.tags || []), f = function (k) { return $('[data-f="' + k + '"]', li); };
      if (typeof tags === 'string') tags = tags.split(',').filter(Boolean);
      li.dataset.name = p.name; li.dataset.loc = p.location || p.loc || ''; li.dataset.tags = tags.join(','); li.dataset.hire = (p.for_hire || p.hire) ? '1' : '0'; li.dataset.bio = p.bio || ''; li.dataset.order = i;
      f('initials').textContent = p.name.split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
      f('name').textContent = p.name; f('loc').textContent = li.dataset.loc; f('bio').textContent = li.dataset.bio; f('hire').hidden = li.dataset.hire !== '1'; f('bio').hidden = !li.dataset.bio;
      var box = f('tags'), proto = f('tag'); box.textContent = '';
      tags.forEach(function (t) { var s = proto.cloneNode(false); s.textContent = t; box.appendChild(s); });
      var a = f('link'); a.href = '/profile.html?id=' + encodeURIComponent(p.slug); a.lastElementChild.textContent = ' of ' + p.name;
      return li;
    }
    $('#dform').addEventListener('submit', function (e) { e.preventDefault(); state.q = q.value.trim(); apply(); });
    q.addEventListener('input', function () { state.q = q.value.trim(); apply(); });
    chips.forEach(function (c) { c.addEventListener('click', function () { state.tag = c.dataset.val; apply(); }); });
    hire.addEventListener('change', function () { state.hire = hire.checked; apply(); });
    sort.addEventListener('change', function () { state.sort = sort.value; apply(); });
    $('#dclear').addEventListener('click', function () { state.q = ''; state.tag = 'all'; state.hire = false; q.value = ''; hire.checked = false; apply(); q.focus(); });
    apply();
    // Real listings replace the examples as soon as there are any.
    fetch('/api/photographers').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.ok || !j.photographers || !j.photographers.length || !tpl) return;
      rows().forEach(function (r) { r.remove(); }); if (note) note.hidden = true;
      j.photographers.forEach(function (p, i) { plist.appendChild(build(p, i)); });
      apply();
    }).catch(function () { /* keep the examples */ });
  })();

  /* ---------- profile ---------- */
  var prof = $('#prof');
  if (prof) (function () {
    var id = params.get('id') || '', missing = $('#prof-missing'), loading = $('#prof-loading');
    var f = function (k) { return $('[data-f="' + k + '"]', prof); };
    function fail() { loading.hidden = true; missing.hidden = false; document.title = 'Photographer not found — NATUREFreak'; }
    function show(p, example) {
      var tags = p.specialisms || p.tags || []; if (typeof tags === 'string') tags = tags.split(',').filter(Boolean);
      f('initials').textContent = p.name.split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
      f('name').textContent = p.name; f('loc').textContent = p.location || p.loc || ''; f('bio').textContent = p.bio || (p.name.split(/\s+/)[0] + ' photographs ' + tags.join(', ').toLowerCase() + '.'); f('first').textContent = p.name.split(/\s+/)[0];
      f('hire').hidden = !(p.for_hire || p.hire); f('example').hidden = !example; f('exnote').hidden = !example;
      var box = f('tags'), proto = f('tag'); box.textContent = '';
      tags.forEach(function (t) { var s = proto.cloneNode(false); s.textContent = t; box.appendChild(s); });
      var ig = f('ig'), web = f('web'), links = 0;
      if (p.instagram && HANDLE.test(p.instagram)) { ig.href = 'https://www.instagram.com/' + p.instagram.replace(/^@/, '') + '/'; ig.hidden = false; links++; }
      if (p.website && isUrl(p.website)) { web.href = p.website; web.hidden = false; links++; }
      f('contact').hidden = example || !links;
      document.title = p.name + ' — NATUREFreak directory';
      loading.hidden = true; prof.hidden = false;
    }
    if (!id) { fail(); return; }
    fetch('/api/photographers?id=' + encodeURIComponent(id)).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (j) {
      if (j && j.ok && j.photographer) { show(j.photographer, false); return null; }
      return fetch('/data/photographers.json').then(function (r) { return r.json(); }).then(function (list) {
        var p = list.filter(function (x) { return x.slug === id; })[0]; if (p) show(p, true); else fail();
      });
    }).catch(fail);
  })();

  /* ---------- journal topic filter ---------- */
  var bgrid = $('#bgrid');
  if (bgrid) (function () {
    var chips = $$('#bchips .nf-chip'), feat = $('#bfeat'), count = $('#bcount'), cards = $$('a[data-topic]', bgrid);
    var topic = (params.get('topic') || 'all').toLowerCase();
    if (!chips.some(function (c) { return c.dataset.val === topic; })) topic = 'all';
    function apply() {
      var n = 0;
      feat.hidden = topic !== 'all';
      cards.forEach(function (c) { var ok = topic === 'all' || c.dataset.topic === topic; c.hidden = topic === 'all' ? !!c.dataset.featured : !ok; if (ok) n++; });
      count.textContent = n + (n === 1 ? ' story' : ' stories');
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.val === topic)); });
      var p = new URLSearchParams(); if (topic !== 'all') p.set('topic', topic); setUrl(p);
    }
    chips.forEach(function (c) { c.addEventListener('click', function () { topic = c.dataset.val; apply(); }); });
    apply();
  })();

  /* ---------- registration: two steps ---------- */
  var jf = $('#join-form');
  if (jf) (function () {
    var wrap = jf.closest('[data-form-wrap]'), inds = $$('[data-step-ind]', jf), cur = 1, LAST = 2;
    var doneEl = $('[data-done]', wrap), offEl = $('[data-offline]', wrap), statusEl = $('[data-status]', jf), btn = $('button[type="submit"]', jf);
    var FIELDS = { 1: ['name', 'email', 'location'], 2: ['specialisms', 'instagram', 'website', 'bio'] };
    var bio = $('[name="bio"]', jf), counter = $('[data-count="bio"]', jf), picks = controls(jf, 'specialisms');
    function panel(n) { return $('[data-step="' + n + '"]', jf); }
    function count() { counter.textContent = bio.value.length; }
    function go(n, focus) {
      cur = n;
      for (var i = 1; i <= LAST; i++) panel(i).hidden = i !== n;
      inds.forEach(function (li) {
        var i = Number(li.getAttribute('data-step-ind'));
        li.setAttribute('data-state', i === n ? 'current' : (i < n ? 'done' : 'todo'));
        if (i === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
      say(statusEl, '');
      if (focus) { var h = $('h2', panel(n)); h.focus(); h.scrollIntoView({ block: 'center' }); }
    }
    function save() { var d = collect(jf); delete d.company; store.set(DRAFT, d); }
    function restore() {
      var d = store.get(DRAFT); if (!d) return;
      ['name', 'email', 'location', 'instagram', 'website', 'bio'].forEach(function (k) { if (typeof d[k] === 'string') controls(jf, k)[0].value = d[k]; });
      if (Array.isArray(d.specialisms)) picks.forEach(function (c) { c.checked = d.specialisms.indexOf(c.value) > -1; });
      controls(jf, 'hire')[0].checked = !!d.hire;
    }
    function next() { var bad = validate(jf, FIELDS[cur]); if (bad) { bad.focus(); return; } save(); go(cur + 1, true); }
    restore(); count();
    // Arriving from the home page with name and email already given: go straight to the next empty field.
    var nameEl = controls(jf, 'name')[0], emailEl = controls(jf, 'email')[0], locEl = controls(jf, 'location')[0];
    if (nameEl.value.trim().length > 1 && EMAIL.test(emailEl.value.trim()) && !locEl.value) locEl.focus({ preventScroll: true });
    bio.addEventListener('input', count);
    picks.forEach(function (c) {
      c.addEventListener('change', function () {
        if (picks.filter(function (x) { return x.checked; }).length > 3) { c.checked = false; setErr(jf, 'specialisms', 'Choose up to 3.'); }
        else setErr(jf, 'specialisms', '');
      });
    });
    // Errors clear as the visitor types, not on blur, so the layout never shifts under a button they are about to press.
    jf.addEventListener('input', function (e) { var n = e.target.name; if (n && n !== 'specialisms' && e.target.getAttribute('aria-invalid')) check(jf, n); save(); });
    $$('[data-next]', jf).forEach(function (b) { b.addEventListener('click', next); });
    $$('[data-back]', jf).forEach(function (b) { b.addEventListener('click', function () { go(cur - 1, true); }); });
    $('[data-resume]', wrap).addEventListener('click', function () { offEl.hidden = true; jf.hidden = false; go(LAST, true); });
    jf.addEventListener('submit', function (e) {
      e.preventDefault();
      if (cur < LAST) { next(); return; }
      for (var s = 1; s <= LAST; s++) { var bad = validate(jf, FIELDS[s]); if (bad) { if (s !== cur) go(s, false); bad.focus(); return; } }
      // Submitting is the agreement: the line under the button says so.
      var data = collect(jf), label = btn.textContent; data.own = true; data.terms = true; btn.disabled = true; btn.textContent = 'Sending…';
      send('/api/register', data).then(function (r) {
        btn.disabled = false; btn.textContent = label;
        if (r.state === 'ok') { store.del(DRAFT); $('[data-done-email]', doneEl).textContent = data.email; jf.hidden = true; doneEl.hidden = false; doneEl.focus(); doneEl.scrollIntoView({ block: 'center' }); }
        else if (r.state === 'invalid') {
          var first = applyErrors(jf, r.errors), name = first && first.name;
          for (var s = 1; s <= LAST; s++) if (FIELDS[s].indexOf(name) > -1) { go(s, false); break; }
          if (first) first.focus();
        } else { save(); jf.hidden = true; offEl.hidden = false; offEl.focus(); offEl.scrollIntoView({ block: 'center' }); }
      });
    });
  })();
})();
