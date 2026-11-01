/* =============================================================
   Team Building Ranking System
   Vanilla JS · no build step · state persisted in localStorage
   ============================================================= */
(function () {
  "use strict";

  var STORAGE_KEY = "tb-ranking-system-v1";
  var MIN_GROUPS = 2;
  var MAX_GROUPS = 16;
  var MIN_GAMES = 1;
  var MAX_GAMES = 30;
  var ANON_WINDOW = 4; // the final N games hide team names completely

  var COLORS = [
    "#16a34a", "#15803d", "#4d7c0f", "#0f766e",
    "#22c55e", "#65a30d", "#0d9488", "#3f6212",
    "#059669", "#84cc16", "#14b8a6", "#166534",
    "#4ade80", "#a3e635", "#6ee7b7", "#a7f3d0"
  ];

  /* ----------------------------- helpers ----------------------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function ordinal(n) {
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function letterName(i) {
    if (i < 26) return String.fromCharCode(65 + i);
    return String(i + 1);
  }
  function autoPoints(n) {
    var arr = [];
    for (var i = 0; i < n; i++) arr.push(Math.max(1, 10 - i * 2));
    return arr;
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ------------------------------ state ------------------------------ */
  function createState() {
    var s = {
      title: "Team Building Championship",
      groups: [],
      games: [],
      points: [],
      anonymousFinal: true,
      revealUntil: 0,
      setupOpen: true
    };
    applyGroupCount(s, 4);
    applyGameCount(s, 6);
    s.points = autoPoints(4);
    return s;
  }

  function applyGroupCount(s, n) {
    n = clamp(n, MIN_GROUPS, MAX_GROUPS);
    while (s.groups.length < n) {
      var idx = s.groups.length;
      s.groups.push({ id: uid(), name: "Group " + letterName(idx) });
    }
    while (s.groups.length > n) {
      var removed = s.groups.pop();
      s.games.forEach(function (g) { delete g.results[removed.id]; });
    }
    sanitizeResults(s);
    var auto = autoPoints(n);
    if (s.points.length < n) {
      for (var i = s.points.length; i < n; i++) s.points.push(auto[i]);
    } else if (s.points.length > n) {
      s.points.length = n;
    }
    return s;
  }

  function applyGameCount(s, n) {
    n = clamp(n, MIN_GAMES, MAX_GAMES);
    while (s.games.length < n) {
      s.games.push({ id: uid(), name: "Game " + (s.games.length + 1), results: {} });
    }
    while (s.games.length > n) s.games.pop();
    return s;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.groups) || !Array.isArray(parsed.games)) return null;
      var s = parsed;
      s.title = typeof s.title === "string" ? s.title : "Team Building Championship";
      s.points = Array.isArray(s.points) && s.points.length ? s.points : autoPoints(s.groups.length);
      s.anonymousFinal = s.anonymousFinal !== false;
      s.revealUntil = 0;
      s.setupOpen = s.setupOpen !== false;
      s.games.forEach(function (g) { g.results = g.results && typeof g.results === "object" ? g.results : {}; });
      delete s.alias;
      sanitizeResults(s);
      return s;
    } catch (e) {
      return null;
    }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  var state = loadState() || createState();
  var prevRanks = {};
  var expandedGames = {};   // games whose full place list is expanded
  var VISIBLE_PLACES = 6;   // places shown before the "show all" toggle
  var revealTimer = null;
  var toastTimer = null;

  function commit() { save(); renderAll(); }

  /* ---------------------------- computing ---------------------------- */
  function pointsForPlace(place) {
    if (!place) return 0;
    var arr = state.points;
    if (!arr.length) return 0;
    var v = place <= arr.length ? arr[place - 1] : arr[arr.length - 1];
    v = Number(v);
    return isNaN(v) ? 0 : v;
  }

  function scoredInGame(game) {
    if (!game) return 0;
    return Object.keys(game.results).filter(function (k) { return game.results[k]; }).length;
  }

  function gamesScored() {
    return state.games.filter(function (g) { return scoredInGame(g) > 0; }).length;
  }

  function gamesCompleted() {
    return state.games.filter(function (g) { return scoredInGame(g) >= state.groups.length; }).length;
  }

  function computeStandings() {
    var entries = state.groups.map(function (g) {
      var perGame = state.games.map(function (game) {
        var place = game.results[g.id] || null;
        return { place: place, points: place ? pointsForPlace(place) : 0, scored: !!place };
      });
      var total = 0, wins = 0, top3 = 0, played = 0;
      perGame.forEach(function (e) {
        total += e.points;
        if (e.scored) played++;
        if (e.place === 1) wins++;
        if (e.place && e.place <= 3) top3++;
      });
      return { group: g, perGame: perGame, total: total, wins: wins, top3: top3, played: played };
    });

    // Total points only — no tie-breakers. Equal totals share a rank,
    // and the host decides how to separate them.
    entries.sort(function (a, b) { return b.total - a.total; });

    var rank = 0, prevTotal = null;
    entries.forEach(function (e, i) {
      if (e.total !== prevTotal) { rank = i + 1; prevTotal = e.total; }
      e.rank = rank;
      e.tie = entries.filter(function (o) { return o.total === e.total; }).length > 1;
    });

    return entries;
  }

  /* --------------------------- anonymity ---------------------------- */
  function anonStartIndex() {
    return Math.max(0, state.games.length - ANON_WINDOW);
  }

  function inAnonWindow() {
    if (!state.anonymousFinal) return false;
    if (state.games.length === 0) return false;
    return gamesScored() >= anonStartIndex();
  }

  function namesHidden() {
    return inAnonWindow() && Date.now() >= state.revealUntil;
  }

  function entryName(group) {
    var name = (group.name || "").trim();
    var i = state.groups.indexOf(group);
    return name || "Unnamed group " + letterName(i < 0 ? 0 : i);
  }

  function displayName(group) {
    return namesHidden() ? "Anonymous" : entryName(group);
  }

  function revealNames(seconds) {
    if (!inAnonWindow()) {
      toast("Anonymity isn't active right now.");
      return;
    }
    seconds = seconds || 6;
    state.revealUntil = Date.now() + seconds * 1000;
    renderLive();
    renderScoreboard();
    toast("Names revealed for " + seconds + " seconds");
    clearTimeout(revealTimer);
    revealTimer = setTimeout(function () {
      state.revealUntil = 0;
      renderLive();
      renderScoreboard();
    }, seconds * 1000);
  }

  /* ---------------------------- rendering ---------------------------- */
  function renderAll() {
    renderTitle();
    renderSetup();
    renderGames();
    renderLive();
    renderScoreboard();
  }

  function renderTitle() {
    $("#brandTitle").textContent = state.title || "Team Building Championship";
    document.title = (state.title || "Ranking System") + " · Live Rankings";
    $("#titleInput").value = state.title;
    $("#sbTitle").textContent = state.title || "Team Building Championship";
  }

  function renderSetup() {
    $("#groupCount").value = state.groups.length;
    $("#gameCount").value = state.games.length;
    $("#anonToggle").checked = state.anonymousFinal;
    $("#setupBody").classList.toggle("collapsed", !state.setupOpen);
    $("#toggleSetup").textContent = state.setupOpen ? "Collapse" : "Expand";
    $("#toggleSetup").setAttribute("aria-expanded", String(state.setupOpen));

    $("#groupNameList").innerHTML = state.groups.map(function (g) {
      return '<div class="chip">' +
        '<span class="chip-dot" style="background:' + groupColor(g.id) + ';color:' + groupColor(g.id) + '"></span>' +
        '<input type="text" maxlength="24" value="' + esc(g.name) + '" data-group-name="' + esc(g.id) + '" aria-label="Group name" placeholder="Team name" spellcheck="false">' +
        '</div>';
    }).join("");

    renderPointsEditor();
  }

  function renderPointsEditor() {
    var wrap = $("#pointsList");
    var focusedPlace = null;
    var active = document.activeElement;
    if (active && active.dataset && active.dataset.place) focusedPlace = active.dataset.place;

    wrap.innerHTML = state.points.map(function (p, i) {
      return '<label class="point-item">' +
        '<span>' + ordinal(i + 1) + '</span>' +
        '<input type="number" min="0" max="99" step="1" inputmode="numeric" value="' + esc(p) + '" data-place="' + (i + 1) + '" aria-label="Points for ' + ordinal(i + 1) + ' place">' +
        '</label>';
    }).join("");

    if (focusedPlace) {
      var el = wrap.querySelector('[data-place="' + focusedPlace + '"]');
      if (el) { el.focus(); el.select(); }
    }
  }

  function groupColor(id) {
    var idx = state.groups.findIndex(function (g) { return g.id === id; });
    if (idx < 0) idx = 0;
    return COLORS[idx % COLORS.length];
  }

  function assignedByPlace(game) {
    var map = {};
    state.groups.forEach(function (g) {
      var p = parseInt(game.results[g.id], 10);
      if (p >= 1 && p <= state.groups.length) map[p] = g;
    });
    return map;
  }

  function renderGames() {
    var wrap = $("#gamesList");
    if (!state.games.length) { wrap.innerHTML = ""; return; }
    wrap.innerHTML = state.games.map(gameCardHTML).join("");
  }

  // Re-render one game only, so the control the host is using keeps its focus.
  function refreshGame(gameId, focusPlace) {
    var game = state.games.find(function (g) { return g.id === gameId; });
    if (!game) return;
    var card = $("#gamesList").querySelector('[data-game="' + gameId + '"]');
    if (!card) { renderGames(); return; }
    card.outerHTML = gameCardHTML(game, state.games.indexOf(game));
    if (focusPlace) {
      var next = $("#gamesList").querySelector('[data-game="' + gameId + '"] .slot[data-place="' + focusPlace + '"] .team-select');
      if (next) next.focus({ preventScroll: true });
    }
  }

  function gameCardHTML(game, gi) {
    var anonStart = anonStartIndex();
    var isAnonGame = state.anonymousFinal && gi >= anonStart;
    var byPlace = assignedByPlace(game);
    var taken = {};
    Object.keys(byPlace).forEach(function (p) { taken[byPlace[p].id] = true; });

    var done = Object.keys(byPlace).length;
    var total = state.groups.length;
    var complete = done >= total;
    var expanded = !!expandedGames[game.id];

    // One row per place. A team already placed elsewhere is never offered again,
    // so one place can only hold one team and the same team cannot take two places.
    var slots = "";
    for (var p = 1; p <= total; p++) {
      var chosen = byPlace[p] || null;
      var options = state.groups.map(function (g) {
        var held = parseInt(game.results[g.id], 10);
        var elsewhere = held && held !== p && byPlace[held];
        var sel = chosen && chosen.id === g.id ? " selected" : "";
        var label = entryName(g) + (elsewhere ? " · " + ordinal(held) : "");
        return '<option value="' + esc(g.id) + '"' + sel + ">" + esc(label) + "</option>";
      }).join("");

      // Long activities stay compact: show the first places, keep filled ones visible,
      // and let the host expand the rest.
      var hiddenSlot = total > VISIBLE_PLACES && p > VISIBLE_PLACES && !chosen && !expanded;
      slots += '<div class="slot' + (chosen ? " is-set" : "") + '" data-place="' + p + '"' +
        (hiddenSlot ? " data-folded=\"1\"" : "") + '>' +
        '<span class="slot-place">' + ordinal(p) + "</span>" +
        '<span class="slot-pick">' +
        '<span class="slot-dot" style="background:' + (chosen ? groupColor(chosen.id) : "transparent") + '"></span>' +
        '<select class="team-select" data-game="' + esc(game.id) + '" data-place="' + p + '" ' +
        'aria-label="Team in ' + ordinal(p) + ' place in ' + esc(game.name) + '">' +
        '<option value="">Select team</option>' + options + "</select>" +
        "</span>" +
        '<span class="slot-pts">' + pointsForPlace(p) + " pts</span>" +
        "</div>";
    }

    var unassigned = state.groups.filter(function (g) { return !taken[g.id]; });
    var quick = unassigned.length
      ? '<div class="unassigned">' +
          '<span class="unassigned-label">Still to place — tap a team to drop it into the next free spot</span>' +
          unassigned.map(function (g) {
            return '<button class="chip-assign" type="button" data-game="' + esc(game.id) + '" data-group="' + esc(g.id) + '">' +
              '<span class="row-dot" style="background:' + groupColor(g.id) + '"></span>' +
              '<span class="chip-name">' + esc(entryName(g)) + "</span></button>";
          }).join("") +
        "</div>"
      : "";

    var left = total - done;
    return '<article class="game-card' + (complete ? " is-complete" : "") + (isAnonGame ? " anon-game" : "") + '" data-game="' + esc(game.id) + '">' +
      '<header class="game-head">' +
      '<span class="game-num">' + (gi + 1) + "</span>" +
      '<input class="game-name-input" type="text" maxlength="40" value="' + esc(game.name) + '" data-game-name="' + esc(game.id) + '" aria-label="Game name" spellcheck="false">' +
      '<span class="game-progress">' + done + "/" + total + "</span>" +
      "</header>" +
      (isAnonGame ? '<p class="anon-tag">Final-stretch game · names hidden on the scoreboard</p>' : "") +
      '<div class="slots">' + slots + "</div>" +
      (total > VISIBLE_PLACES
        ? '<button class="slots-toggle" type="button" data-expand="' + esc(game.id) + '" aria-expanded="' + expanded + '">' +
          (expanded ? "Show fewer places" : "Show all " + total + " places") + "</button>"
        : "") +
      quick +
      '<footer class="game-foot">' +
      '<span class="muted small">' + (complete ? "All places filled" : left + " place" + (left === 1 ? "" : "s") + " left") + "</span>" +
      '<button class="btn btn-tiny clear-game" type="button" data-clear="' + esc(game.id) + '">Clear</button>' +
      "</footer>" +
      "</article>";
  }

  function renderStats() {
    var entries = computeStandings();
    var scored = gamesScored() > 0;
    $("#statTeams").textContent = state.groups.length;
    $("#statGames").textContent = state.games.length;
    $("#statScored").textContent = gamesScored() + " / " + state.games.length;

    var leaderEl = $("#statLeader");
    if (!entries.length || !scored || entries[0].total <= 0) {
      leaderEl.textContent = "\u2014";
      return;
    }
    var top = entries[0];
    var sharedLead = entries.filter(function (e) { return e.total === top.total; }).length > 1;
    // a shared lead is safe to announce even while names are hidden
    leaderEl.textContent = sharedLead ? "Tied lead" : displayName(top.group);
  }

  function renderLive() {
    renderStats();
    var entries = computeStandings();
    var meta = $("#liveMeta");
    meta.textContent = gamesCompleted() === state.games.length && state.games.length > 0
      ? "Final result"
      : (inAnonWindow() ? "Final stretch · names hidden" : "Scoring in progress");

    var hidden = namesHidden();
    $("#anonBanner").hidden = !inAnonWindow();
    $("#revealBtn").hidden = !inAnonWindow();

    if (!entries.length) {
      $("#liveList").innerHTML = '<li class="empty-state">Add at least one group to see the ranking.</li>';
      return;
    }

    var max = Math.max.apply(null, entries.map(function (e) { return e.total; }).concat([1]));

    $("#liveList").innerHTML = entries.map(function (e, i) {
      var prev = prevRanks[e.group.id];
      var delta = "";
      if (typeof prev === "number" && prev !== e.rank) {
        var up = prev > e.rank;
        delta = '<span class="delta ' + (up ? "up" : "down") + '">' + (up ? "\u2191" : "\u2193") + Math.abs(prev - e.rank) + "</span>";
      }
      var name = '<span class="' + (hidden ? "is-anonymous" : "") + '">' + esc(displayName(e.group)) + "</span>";
      var pct = max > 0 ? Math.max(e.total > 0 ? 6 : 0, Math.round((e.total / max) * 100)) : 0;
      return '<li class="live-row rank-' + (e.rank <= 3 ? e.rank : "n") + '" style="animation-delay:' + (i * 25) + 'ms">' +
        '<span class="rank-badge">' + e.rank + "</span>" +
        '<div class="row-main">' +
        '<div class="row-top">' +
        '<span class="row-name">' + name + "</span>" +
        '<span class="row-total">' + e.total + " <em>pts</em></span>" +
        "</div>" +
        '<div class="row-bar"><span style="width:' + pct + '%"></span></div>' +
        '<div class="row-sub">' + delta +
        "<span>" + e.played + " of " + state.games.length + " game" + (state.games.length === 1 ? "" : "s") + " scored</span>" +
        (e.tie ? '<span class="tie-flag">tied</span>' : "") +
        "</div></div></li>";
    }).join("");

    prevRanks = {};
    entries.forEach(function (e) { prevRanks[e.group.id] = e.rank; });

    var legend = state.points.slice(0, 4).map(function (p, i) {
      return ordinal(i + 1) + " +" + p;
    }).join(" · ");
    $("#legendText").textContent = legend + (state.points.length > 4 ? " · …" : "");
  }

  function renderScoreboard() {
    if ($("#scoreboard").hidden) return;
    var entries = computeStandings();
    var hidden = namesHidden();
    var allDone = state.games.length > 0 && gamesCompleted() === state.games.length;

    $("#sbKicker").textContent = allDone ? "Final standings" : "Live standings";
    $("#sbStatus").textContent = allDone
      ? "All " + state.games.length + " games complete"
      : gamesScored() + " of " + state.games.length + " games scored";
    $("#sbBanner").hidden = !inAnonWindow();
    $("#sbReveal").hidden = !inAnonWindow();

    if (!entries.length) {
      $("#sbList").innerHTML = '<li class="empty-state">No groups yet.</li>';
      return;
    }

    var max = Math.max.apply(null, entries.map(function (e) { return e.total; }).concat([1]));

    $("#sbList").innerHTML = entries.map(function (e, i) {
      var pct = max > 0 ? Math.max(e.total > 0 ? 5 : 0, Math.round((e.total / max) * 100)) : 0;
      var dots = "";
      if (!hidden && state.games.length <= 14) {
        dots = '<div class="sb-dots">' + e.perGame.map(function (pg) {
          var cls = pg.place === 1 ? "p1" : pg.place === 2 ? "p2" : pg.place === 3 ? "p3" : pg.place ? "pn" : "";
          return '<span class="sb-dot ' + cls + '" title="' + (pg.place ? ordinal(pg.place) + " place" : "not scored") + '"></span>';
        }).join("") + "</div>";
      }
      var crown = allDone && e.rank === 1 ? ' <span class="crown">🏆</span>' : "";
      var name = '<span class="' + (hidden ? "is-anonymous" : "") + '">' + esc(displayName(e.group)) + "</span>";
      return '<li class="sb-row rank-' + (e.rank <= 3 ? e.rank : "n") + '" style="animation-delay:' + (i * 45) + 'ms">' +
        '<span class="sb-rank">' + e.rank + "</span>" +
        '<div class="sb-main">' +
        '<div class="sb-name">' + name + crown + "</div>" +
        '<div class="sb-bar"><span style="width:' + pct + '%"></span></div>' +
        dots +
        "</div>" +
        '<span class="sb-pts">' + e.total + "<em>pts</em></span>" +
        "</li>";
    }).join("");

    var legend = state.points.slice(0, 5).map(function (p, i) {
      return ordinal(i + 1) + " +" + p;
    }).join(" · ");
    $("#sbFoot").textContent = "Points: " + legend + (state.points.length > 5 ? " · …" : "");
  }

  /* ----------------------------- actions ----------------------------- */
  function setGroupCount(n) {
    if (isNaN(n)) return;
    n = clamp(Math.round(n), MIN_GROUPS, MAX_GROUPS);
    applyGroupCount(state, n);
    commit();
  }

  function setGameCount(n) {
    if (isNaN(n)) return;
    n = clamp(Math.round(n), MIN_GAMES, MAX_GAMES);
    applyGameCount(state, n);
    if (state.anonymousFinal && state.games.length <= ANON_WINDOW) {
      toast("Heads up: with " + state.games.length + " game(s), the whole activity is anonymous.");
    }
    commit();
  }

  // Put a team into a place. A place holds one team and a team holds one place,
  // so a duplicate placing (a tie) can never be created.
  function setSlotTeam(gameId, place, groupId) {
    var game = state.games.find(function (g) { return g.id === gameId; });
    if (!game) return;
    place = clamp(parseInt(place, 10), 1, state.groups.length);
    if (groupId && !state.groups.some(function (g) { return g.id === groupId; })) return;

    var current = assignedByPlace(game)[place] || null;          // who holds this place now
    var incomingFrom = game.results[groupId] || null;             // where the incoming team was

    state.groups.forEach(function (g) {
      if (parseInt(game.results[g.id], 10) === place) delete game.results[g.id];
    });

    if (groupId) {
      game.results[groupId] = place;
      // if that team already had a place, the two teams simply swap
      if (current && current.id !== groupId && incomingFrom) {
        game.results[current.id] = incomingFrom;
      }
    }
    afterGameChange(gameId, groupId ? nextEmptyPlace(game) : place);
  }

  function nextEmptyPlace(game) {
    var byPlace = assignedByPlace(game);
    for (var p = 1; p <= state.groups.length; p++) {
      if (!byPlace[p]) return p;
    }
    return 0;
  }

  // Save, then update just the game card + live panel (no flicker, focus stays put).
  function afterGameChange(gameId, focusPlace) {
    save();
    refreshGame(gameId, focusPlace);
    renderStats();
    renderLive();
    renderScoreboard();
  }

  // Tap-to-fill: drop a team into the first place that is still open.
  function quickAssign(gameId, groupId) {
    var game = state.games.find(function (g) { return g.id === gameId; });
    if (!game) return;
    var place = nextEmptyPlace(game);
    if (place) setSlotTeam(gameId, place, groupId);
  }

  // Repair any legacy data where two teams shared one place.
  function sanitizeResults(st) {
    st = st || state;
    var ids = {};
    st.groups.forEach(function (g) { ids[g.id] = true; });
    st.games.forEach(function (game) {
      var seen = {};
      Object.keys(game.results).forEach(function (gid) {
        var p = parseInt(game.results[gid], 10);
        if (!ids[gid] || !p || p < 1 || p > st.groups.length || seen[p]) {
          delete game.results[gid];
          return;
        }
        seen[p] = true;
        game.results[gid] = p;
      });
    });
  }

  function clearGame(gameId) {
    var game = state.games.find(function (g) { return g.id === gameId; });
    if (!game) return;
    game.results = {};
    afterGameChange(gameId, 0);
    toast("Game cleared");
  }

  var lastFocused = null;

  function openScoreboard() {
    lastFocused = document.activeElement;
    $("#scoreboard").hidden = false;
    document.body.classList.add("sb-open");
    renderScoreboard();
    $("#sbClose").focus({ preventScroll: true });
    var el = $("#scoreboard");
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(function () { /* not allowed, ignore */ });
    }
  }

  function closeScoreboard() {
    $("#scoreboard").hidden = true;
    document.body.classList.remove("sb-open");
    if (lastFocused && lastFocused.focus) lastFocused.focus({ preventScroll: true });
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () { /* ignore */ });
    }
  }

  function loadDemoScores() {
    state.games.forEach(function (game) {
      var order = shuffle(state.groups.map(function (g) { return g.id; }));
      var results = {};
      order.forEach(function (gid, i) { results[gid] = i + 1; });
      game.results = results;
    });
    commit();
    toast(namesHidden() ? "Sample scores loaded — names are hidden" : "Sample scores loaded");
  }

  function resetActivity() {
    if (!window.confirm("Reset everything? All groups, scores and settings will be cleared.")) return;
    state = createState();
    state.setupOpen = true;
    commit();
    toast("New activity ready");
  }

  function toast(msg) {
    var el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2600);
  }

  /* ------------------------------ events ----------------------------- */
  function bind() {
    $("#titleInput").addEventListener("input", function (e) {
      state.title = e.target.value;
      $("#brandTitle").textContent = state.title || "Team Building Championship";
      $("#sbTitle").textContent = state.title || "Team Building Championship";
      document.title = (state.title || "Ranking System") + " · Live Rankings";
      save();
    });

    $("#groupCount").addEventListener("change", function (e) {
      setGroupCount(parseInt(e.target.value, 10));
      renderSetup();
    });
    $("#gameCount").addEventListener("change", function (e) {
      setGameCount(parseInt(e.target.value, 10));
      renderSetup();
    });

    document.querySelectorAll("[data-step]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var kind = btn.dataset.step;
        var dir = parseInt(btn.dataset.dir, 10);
        if (kind === "groups") {
          setGroupCount(state.groups.length + dir);
          renderSetup();
        } else {
          setGameCount(state.games.length + dir);
          renderSetup();
        }
      });
    });

    $("#anonToggle").addEventListener("change", function (e) {
      state.anonymousFinal = e.target.checked;
      commit();
      toast(state.anonymousFinal ? "Anonymity on for the final 4 games" : "Anonymity off");
    });

    $("#toggleSetup").addEventListener("click", function () {
      state.setupOpen = !state.setupOpen;
      save();
      renderSetup();
    });


    $("#clearNames").addEventListener("click", function () {
      state.groups.forEach(function (g) { g.name = ""; });
      commit();
      toast("Names cleared — teams can enter their own");
    });

    $("#autoPointsBtn").addEventListener("click", function () {
      state.points = autoPoints(state.groups.length);
      commit();
      toast("Points reset to 10, 8, 6, 4…");
    });

    // group names (typing)
    $("#groupNameList").addEventListener("input", function (e) {
      var input = e.target.closest("[data-group-name]");
      if (!input) return;
      var group = state.groups.find(function (g) { return g.id === input.dataset.groupName; });
      if (!group) return;
      group.name = input.value;
      save();
      // keep the game cards in sync without stealing focus from this field
      $("#gamesList").querySelectorAll(".team-select").forEach(function (sel) {
        var opt = sel.querySelector('option[value="' + group.id + '"]');
        if (!opt) return;
        var game = state.games.find(function (gm) { return gm.id === sel.dataset.game; });
        var held = game ? parseInt(game.results[group.id], 10) : 0;
        var here = parseInt(sel.dataset.place, 10);
        opt.textContent = entryName(group) + (held && held !== here ? " · " + ordinal(held) : "");
      });
      $("#gamesList").querySelectorAll('.chip-assign[data-group="' + group.id + '"] .chip-name').forEach(function (el) {
        el.textContent = entryName(group);
      });
      renderStats();
      renderLive();
      renderScoreboard();
    });

    // points (typing)
    $("#pointsList").addEventListener("input", function (e) {
      var input = e.target.closest("[data-place]");
      if (!input) return;
      var idx = parseInt(input.dataset.place, 10) - 1;
      var val = clamp(parseInt(input.value, 10) || 0, 0, 99);
      state.points[idx] = val;
      save();
      renderGames();
      renderLive();
      renderScoreboard();
    });

    // game name inputs
    $("#gamesList").addEventListener("input", function (e) {
      var input = e.target.closest("[data-game-name]");
      if (!input) return;
      var game = state.games.find(function (g) { return g.id === input.dataset.gameName; });
      if (!game) return;
      game.name = input.value;
      save();
    });

    // Enter (or ↓) jumps to the next place in the same game, ↑/Shift+Tab goes back
    $("#gamesList").addEventListener("keydown", function (e) {
      var sel = e.target.closest(".team-select");
      if (!sel) return;
      var forward = e.key === "Enter" || e.key === "ArrowDown";
      var back = e.key === "ArrowUp";
      if (!forward && !back) return;
      e.preventDefault();
      var game = sel.dataset.game;
      var dir = forward ? 1 : -1;
      // skip places that are folded away in a long list
      var selects = Array.prototype.slice.call(
        $("#gamesList").querySelectorAll('.team-select[data-game="' + game + '"]')
      ).filter(function (el) { return !el.closest("[data-folded]"); });
      var i = selects.indexOf(sel);
      var next = selects[i + dir];
      if (next) next.focus();
      else if (forward) sel.blur();
    });

    // place -> team selects
    $("#gamesList").addEventListener("change", function (e) {
      var sel = e.target.closest(".team-select");
      if (!sel) return;
      setSlotTeam(sel.dataset.game, sel.dataset.place, sel.value || null);
    });

    // tap a waiting team to fill the next open place
    $("#gamesList").addEventListener("click", function (e) {
      var expandBtn = e.target.closest("[data-expand]");
      if (expandBtn) {
        var gid = expandBtn.dataset.expand;
        expandedGames[gid] = !expandedGames[gid];
        refreshGame(gid);
        return;
      }

      var quickBtn = e.target.closest(".chip-assign");
      if (quickBtn) { quickAssign(quickBtn.dataset.game, quickBtn.dataset.group); return; }

      var btn = e.target.closest("[data-clear]");
      if (btn) clearGame(btn.dataset.clear);
    });

    // reveal
    $("#revealBtn").addEventListener("click", function () { revealNames(6); });
    $("#sbReveal").addEventListener("click", function () { revealNames(6); });

    // scoreboard open / close
    $("#scoreboardBtn").addEventListener("click", openScoreboard);
    $("#sbClose").addEventListener("click", closeScoreboard);

    $("#demoBtn").addEventListener("click", loadDemoScores);
    $("#resetBtn").addEventListener("click", resetActivity);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !$("#scoreboard").hidden) closeScoreboard();
      if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "r" || e.key === "R") &&
          !$("#scoreboard").hidden && inAnonWindow() &&
          !/^(input|select|textarea)$/i.test(document.activeElement.tagName)) {
        revealNames(6);
      }
      if (e.key === "Tab" && !$("#scoreboard").hidden) {
        var focusables = $("#scoreboard").querySelectorAll("button:not([hidden])");
        if (!focusables.length) return;
        var first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ------------------------------- boot ------------------------------ */
  bind();
  renderAll();
  save();

  // keep the anonymity clock accurate if a tab sleeps mid-reveal
  setInterval(function () {
    if (state.revealUntil && Date.now() >= state.revealUntil) {
      state.revealUntil = 0;
      renderLive();
      renderScoreboard();
    }
  }, 1000);
})();
