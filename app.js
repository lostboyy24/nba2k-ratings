(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var ABBR = {"Atlanta Hawks":"ATL","Boston Celtics":"BOS","Brooklyn Nets":"BKN","Charlotte Hornets":"CHA","Chicago Bulls":"CHI","Cleveland Cavaliers":"CLE","Dallas Mavericks":"DAL","Denver Nuggets":"DEN","Detroit Pistons":"DET","Golden State Warriors":"GSW","Houston Rockets":"HOU","Indiana Pacers":"IND","Los Angeles Clippers":"LAC","Los Angeles Lakers":"LAL","Memphis Grizzlies":"MEM","Miami Heat":"MIA","Milwaukee Bucks":"MIL","Minnesota Timberwolves":"MIN","New Orleans Pelicans":"NOP","New York Knicks":"NYK","Oklahoma City Thunder":"OKC","Orlando Magic":"ORL","Philadelphia 76ers":"PHI","Phoenix Suns":"PHX","Portland Trail Blazers":"POR","Sacramento Kings":"SAC","San Antonio Spurs":"SAS","Toronto Raptors":"TOR","Utah Jazz":"UTA","Washington Wizards":"WAS"};
  var POS = ['PG', 'SG', 'SF', 'PF', 'C'];
  var TIERS = [
    { id: 't95', min: 95, label: '95+', name: 'Generational' },
    { id: 't90', min: 90, label: '90–94', name: 'Superstar' },
    { id: 't85', min: 85, label: '85–89', name: 'Star' },
    { id: 't80', min: 80, label: '80–84', name: 'High-level starter' },
    { id: 't75', min: 75, label: '75–79', name: 'Starter' },
    { id: 't70', min: 70, label: '70–74', name: 'Rotation' },
    { id: 't0', min: 0, label: 'Under 70', name: 'Bench' }
  ];
  var PAGE = 50;
  var all = [], view = [], shown = PAGE;
  var sort = { k: 'ovr', dir: 'desc' };

  function tier(o) { for (var i = 0; i < TIERS.length; i++) if (o >= TIERS[i].min) return TIERS[i]; return TIERS[TIERS.length - 1]; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function avg(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : 0; }
  function get(p, k) {
    if (k === 'ovr') return p.o; if (k === 'name') return p.n; if (k === 'team') return p.t; if (k === 'pos') return p.pi; if (k === 'rank') return p.r;
    return p.a ? p.a[k] : null;
  }
  function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function badge(o, big) { var b = el('span', 'badge ' + tier(o).id + (big ? ' big' : ''), o); b.title = tier(o).label + ' · ' + tier(o).name; return b; }

  function init(d) {
    var m = d.meta;
    all = d.players.map(function (p) { p.pri = p.p.split('/')[0]; p.pi = POS.indexOf(p.pri); p.ab = ABBR[p.t] || p.t; p.s = norm(p.n + ' ' + p.t + ' ' + p.ab); return p; });
    all.sort(function (a, b) { return b.o - a.o || a.n.localeCompare(b.n); });
    all.forEach(function (p, i) { p.r = i + 1; });

    document.title = m.edition + ' Player Ratings — ' + all.length + ' Rostered Players (Unofficial Fan Site)';
    $('#edition').textContent = m.edition;
    $('#hero-count').textContent = all.length;
    $('#updated').textContent = m.edition + ' · ' + m.version + ' · ratings as of ' + m.captured + ' · source: ' + m.source;
    $('#ab-edition').textContent = m.edition + ' (' + m.version + ')';
    var src = $('#ab-source'); src.textContent = '';
    var a = el('a', null, m.source); a.href = m.sourceUrl; a.target = '_blank'; a.rel = 'noopener'; src.appendChild(a);
    src.appendChild(document.createTextNode(' — ' + m.sourceNote));
    $('#ab-updated').textContent = m.captured + ' (data pulled ' + m.pulled + ')';
    $('#ab-coverage').textContent = all.length + ' players on the 30 NBA team rosters in-game. ' + m.coverageNote;

    heroStats(); topGrid(); funStats(); filters(); teamCards();
    applyFilters();
  }

  function heroStats() {
    var top = all[0], av = avg(all.map(function (p) { return p.o; })), n90 = all.filter(function (p) { return p.o >= 90; }).length;
    var items = [[all.length, 'players rated'], [top.o, 'top overall · ' + top.n], [n90, 'players rated 90+'], [av.toFixed(1), 'league average OVR']];
    var ul = $('#hero-stats');
    items.forEach(function (x) { var li = el('li'); li.appendChild(el('b', null, x[0])); li.appendChild(el('span', null, x[1])); ul.appendChild(li); });
  }

  function topGrid() {
    var g = $('#top-grid');
    all.slice(0, 10).forEach(function (p, i) {
      var c = el('button', 'pcard ' + tier(p.o).id + (i === 0 ? ' first' : '')); c.type = 'button';
      c.appendChild(el('div', 'rk', '#' + (i + 1)));
      c.appendChild(el('div', 'nm', p.n));
      c.appendChild(el('div', 'tm', p.t));
      var bot = el('div', 'bot'); bot.appendChild(el('div', 'num', p.o)); bot.appendChild(el('div', 'ps', p.p)); c.appendChild(bot);
      c.addEventListener('click', function () { openModal(p); });
      g.appendChild(c);
    });
  }

  function funStats() {
    // tier bar
    var bar = $('#tier-bar');
    TIERS.forEach(function (t) {
      var cnt = all.filter(function (p) { return tier(p.o) === t; }).length;
      var d = el('div', t.id); d.style.flex = Math.max(cnt, 6) + ' 1 0'; d.title = t.name;
      d.appendChild(document.createTextNode(cnt)); d.appendChild(el('small', null, t.label));
      d.addEventListener('click', function () { $('#f-tier').value = t.id; applyFilters(); location.hash = '#players'; });
      bar.appendChild(d);
    });
    // position avg
    var pa = $('#pos-avg'), names = { PG: 'Point Guard', SG: 'Shooting Guard', SF: 'Small Forward', PF: 'Power Forward', C: 'Center' };
    var rows = POS.map(function (pp) { var l = all.filter(function (p) { return p.pri === pp; }); return { pos: pp, n: l.length, avg: avg(l.map(function (p) { return p.o; })) }; });
    var mx = Math.max.apply(null, rows.map(function (r) { return r.avg; })), mn = 60;
    rows.forEach(function (r) {
      var row = el('div', 'bar-row'); row.title = names[r.pos] + ' · ' + r.n + ' players';
      row.appendChild(el('span', null, r.pos));
      var b = el('div', 'bar'), i = el('i'); i.style.width = Math.max(4, (r.avg - mn) / (mx - mn + 3) * 100) + '%'; b.appendChild(i); row.appendChild(b);
      row.appendChild(el('b', null, r.avg.toFixed(1))); pa.appendChild(row);
    });
    pa.appendChild(el('p', 'muted', 'Based on each player’s primary listed position.')).style.fontSize = '12.5px';
    // best per team
    var tb = $('#team-best');
    teams().forEach(function (t) {
      var p = t.players[0], r = el('div', 'tb');
      r.appendChild(el('span', 'ab', ABBR[t.name])); r.appendChild(el('span', 'n', p.n)); r.appendChild(badge(p.o));
      r.addEventListener('click', function () { openModal(p); }); tb.appendChild(r);
    });
    // leaders
    var L = $('#leaders'), defs = [['three', 'Best 3-point shooters', '3PT'], ['dunk', 'Best dunkers', 'Dunk'], ['def', 'Best defenders', 'DEF'], ['ply', 'Best playmakers', 'PLY'], ['ath', 'Most athletic', 'ATH']];
    defs.forEach(function (d) {
      var list = all.filter(function (p) { return p.a && p.a[d[0]] != null; }).sort(function (a, b) { return b.a[d[0]] - a.a[d[0]] || b.o - a.o; }).slice(0, 5);
      if (!list.length) return;
      var c = el('div', 'card'); c.appendChild(el('h3', null, d[1] + ' (' + d[2] + ')'));
      var ol = el('ol');
      list.forEach(function (p) { var li = el('li'); li.appendChild(el('span', null, p.n)); li.appendChild(el('b', null, p.a[d[0]])); li.addEventListener('click', function () { openModal(p); }); ol.appendChild(li); });
      c.appendChild(ol); L.appendChild(c);
    });
  }

  function teams() {
    var map = {};
    all.forEach(function (p) { (map[p.t] = map[p.t] || { name: p.t, players: [] }).players.push(p); });
    return Object.keys(map).sort().map(function (k) { var t = map[k]; t.avg = avg(t.players.map(function (p) { return p.o; })); return t; });
  }

  function filters() {
    var ts = $('#f-team');
    teams().forEach(function (t) { var o = el('option', null, t.name); o.value = t.name; ts.appendChild(o); });
    var tr = $('#f-tier');
    TIERS.forEach(function (t) { var o = el('option', null, t.label + ' · ' + t.name); o.value = t.id; tr.appendChild(o); });
    var deb; $('#q').addEventListener('input', function () { clearTimeout(deb); deb = setTimeout(applyFilters, 120); });
    ['f-team', 'f-pos', 'f-tier'].forEach(function (id) { $('#' + id).addEventListener('change', applyFilters); });
    $('#sort-sel').addEventListener('change', function () { var v = this.value.split(':'); sort = { k: v[0], dir: v[1] }; applyFilters(); });
    $('#reset').addEventListener('click', function () { $('#q').value = ''; $('#f-team').value = ''; $('#f-pos').value = ''; $('#f-tier').value = ''; $('#sort-sel').value = 'ovr:desc'; sort = { k: 'ovr', dir: 'desc' }; applyFilters(); });
    document.querySelectorAll('#tbl th').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.dataset.k;
        if (sort.k === k) sort.dir = sort.dir === 'desc' ? 'asc' : 'desc';
        else sort = { k: k, dir: (k === 'name' || k === 'team' || k === 'pos' || k === 'rank') ? 'asc' : 'desc' };
        var opt = $('#sort-sel option[value="' + sort.k + ':' + sort.dir + '"]'); $('#sort-sel').value = opt ? opt.value : '';
        applyFilters();
      });
    });
    $('#more').addEventListener('click', function () { shown += PAGE * 2; render(); });
  }

  function applyFilters() {
    var q = norm($('#q').value.trim()), team = $('#f-team').value, pos = $('#f-pos').value, tr = $('#f-tier').value;
    view = all.filter(function (p) {
      return (!q || p.s.indexOf(q) !== -1) && (!team || p.t === team) && (!pos || p.pri === pos) && (!tr || tier(p.o).id === tr);
    });
    var k = sort.k, dir = sort.dir === 'asc' ? 1 : -1;
    view.sort(function (a, b) {
      var x = get(a, k), y = get(b, k);
      if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
      var c = typeof x === 'string' ? x.localeCompare(y) : x - y;
      return (c * dir) || (b.o - a.o) || a.n.localeCompare(b.n);
    });
    shown = PAGE; render();
  }

  function attrCell(p, k) {
    var v = p.a ? p.a[k] : null, td = el('td', 'num');
    if (v == null) { td.appendChild(el('span', 'attr', '–')); return td; }
    td.appendChild(el('span', 'attr' + (v >= 85 ? ' hi' : ''), v)); return td;
  }

  function render() {
    var tb = $('#tbody'); tb.textContent = '';
    document.querySelectorAll('#tbl th').forEach(function (th) { th.classList.toggle('sorted', th.dataset.k === sort.k); th.classList.toggle('asc', th.dataset.k === sort.k && sort.dir === 'asc'); });
    $('#count').textContent = view.length === all.length ? 'Showing ' + Math.min(shown, view.length) + ' of ' + all.length + ' players' : view.length + ' match' + (view.length === 1 ? '' : 'es') + ' (of ' + all.length + ')';
    if (!view.length) { var tr0 = el('tr'), td0 = el('td', 'nodata', 'No players match those filters.'); td0.colSpan = 10; tr0.appendChild(td0); tb.appendChild(tr0); $('#more').hidden = true; return; }
    var frag = document.createDocumentFragment();
    view.slice(0, shown).forEach(function (p) {
      var tr = el('tr'); tr.tabIndex = 0;
      tr.appendChild(el('td', 'num attr', p.r));
      var tdn = el('td'); tdn.appendChild(el('div', 'pn', p.n)); tdn.appendChild(el('div', 'tm-sm', p.ab)); tr.appendChild(tdn);
      tr.appendChild(el('td', 'col-team', p.t));
      tr.appendChild(el('td', null, p.p));
      var to = el('td', 'num'); to.appendChild(badge(p.o)); tr.appendChild(to);
      [['three', 'hide-sm'], ['dunk', 'hide-sm'], ['def', 'hide-sm'], ['ply', 'hide-md'], ['ath', 'hide-md']].forEach(function (c) { var td = attrCell(p, c[0]); td.className += ' ' + c[1]; tr.appendChild(td); });
      tr.addEventListener('click', function () { openModal(p); });
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter') openModal(p); });
      frag.appendChild(tr);
    });
    tb.appendChild(frag);
    $('#more').hidden = shown >= view.length;
  }

  // teams
  function teamCards() {
    var box = $('#team-cards');
    teams().sort(function (a, b) { return b.avg - a.avg; }).forEach(function (t) {
      var c = el('button', 'tc'); c.type = 'button'; c.dataset.team = t.name;
      c.appendChild(el('div', 'ab', ABBR[t.name])); c.appendChild(el('div', 'nm', t.name));
      var av = el('div', 'av'); av.appendChild(document.createTextNode('Avg ')); av.appendChild(el('b', null, t.avg.toFixed(1))); av.appendChild(document.createTextNode(' · ' + t.players.length + ' players')); c.appendChild(av);
      c.addEventListener('click', function () { showTeam(t); });
      box.appendChild(c);
    });
  }
  function showTeam(t) {
    document.querySelectorAll('.tc').forEach(function (c) { c.classList.toggle('on', c.dataset.team === t.name); });
    var d = $('#team-detail'); d.hidden = false;
    $('#td-name').textContent = t.name;
    $('#td-meta').textContent = 'Team average ' + t.avg.toFixed(1) + ' · top-rated: ' + t.players[0].n + ' (' + t.players[0].o + ') · ' + t.players.length + ' players';
    var r = $('#td-roster'); r.textContent = '';
    t.players.forEach(function (p) {
      var row = el('div', 'rr'); row.appendChild(badge(p.o)); row.appendChild(el('span', 'n', p.n)); row.appendChild(el('span', 'p', p.p));
      row.addEventListener('click', function () { openModal(p); }); r.appendChild(row);
    });
    d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // modal
  var GROUPS = [
    ['Scoring', [['Close shot', 'close'], ['Mid-range', 'mid'], ['Three-point', 'three'], ['Free throw', 'ft'], ['Driving dunk', 'ddk'], ['Standing dunk', 'sdk']]],
    ['Playmaking', [['Pass accuracy', 'pass'], ['Ball handle', 'hdl']]],
    ['Defense & rebounding', [['Interior D', 'idef'], ['Perimeter D', 'pdef'], ['Steal', 'stl'], ['Block', 'blk'], ['Rebounding', 'reb']]],
    ['Athleticism', [['Speed', 'spd'], ['Vertical', 'vert'], ['Strength', 'str']]],
    ['Category ratings', [['Finishing', 'fin'], ['Shooting', 'sho'], ['Playmaking', 'ply'], ['Defense', 'def'], ['Physical', 'ath']]]
  ];
  function openModal(p) {
    var m = $('#modal');
    var ov = $('#m-ovr'); ov.className = 'ovr big ' + tier(p.o).id; ov.textContent = p.o;
    $('#m-name').textContent = p.n;
    $('#m-sub').textContent = p.t + ' · ' + p.p + (p.h ? ' · ' + p.h : '') + ' · #' + p.r + ' overall';
    var box = $('#m-attrs'); box.textContent = '';
    if (!p.a) box.appendChild(el('p', 'muted', 'Detailed attributes were not available for this player.'));
    else GROUPS.forEach(function (g) {
      var rows = g[1].filter(function (x) { return p.a[x[1]] != null; }); if (!rows.length) return;
      box.appendChild(el('h4', null, g[0]));
      rows.forEach(function (x) {
        var v = p.a[x[1]], r = el('div', 'ar'); r.appendChild(el('span', null, x[0])); r.appendChild(el('b', null, v));
        var b = el('div', 'bar'), i = el('i'); i.style.width = v + '%'; b.appendChild(i); r.appendChild(b); box.appendChild(r);
      });
    });
    m.hidden = false; $('#m-close').focus();
  }
  function closeModal() { $('#modal').hidden = true; }
  $('#m-close').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  fetch('players.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(init)
    .catch(function (e) {
      var n = $('#load-error'); n.hidden = false; n.textContent = 'Could not load players.json (' + e.message + '). If you opened this file directly, serve the folder over HTTP instead.';
      $('#updated').textContent = 'Failed to load ratings.';
    });
})();
