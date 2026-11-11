(function () {
  "use strict";

  if (window.__TIZEN_WEB_ENHANCER_ACTIVE__) return;
  window.__TIZEN_WEB_ENHANCER_ACTIVE__ = true;

  // Register Samsung TV remote keys
  try {
    if (window.tizen && tizen.tvinputdevice) {
      ["ColorF0Red", "ColorF1Green", "ColorF2Yellow", "ColorF3Blue"].forEach(function (k) {
        try { tizen.tvinputdevice.registerKey(k); } catch (_) {}
      });
    }
  } catch (_) {}

  var style = document.createElement("style");
  style.id = "tizen-web-enhancer-css";
  style.textContent = [
    "/* Cosmetic Ad & Clutter Shield */",
    "[id*='google_ads'], [class*='ad-banner'], [class*='adsbox'], iframe[src*='doubleclick'], .cookie-banner, #onetrust-banner-sdk { display: none !important; }",
    "",
    "/* High-Visibility TV Focus Ring */",
    "a:focus, button:focus, input:focus, select:focus, [tabindex]:focus {",
    "  outline: 3px solid #38bdf8 !important;",
    "  outline-offset: 3px !important;",
    "  box-shadow: 0 0 0 6px rgba(56, 189, 248, 0.35) !important;",
    "  transition: outline 0.12s ease, box-shadow 0.12s ease !important;",
    "}",
    "",
    "#tb-enhancer-hud {",
    "  position: fixed; bottom: 18px; right: 22px; z-index: 2147483647;",
    "  background: rgba(15, 23, 42, 0.92); color: #f8fafc;",
    "  border: 2px solid #38bdf8; border-radius: 14px;",
    "  padding: 10px 16px; font-family: system-ui, sans-serif; font-size: 13px;",
    "  box-shadow: 0 12px 32px rgba(0,0,0,0.65); pointer-events: none;",
    "  transition: opacity 0.3s ease;",
    "}",
    "#tb-dimmer-layer {",
    "  position: fixed; inset: 0; z-index: 2147483646; pointer-events: none;",
    "  background: #000; opacity: 0; transition: opacity 0.25s ease;",
    "}"
  ].join("\n");
  (document.head || document.documentElement).appendChild(style);

  var dimmer = document.createElement("div");
  dimmer.id = "tb-dimmer-layer";
  (document.body || document.documentElement).appendChild(dimmer);

  var hud = document.createElement("div");
  hud.id = "tb-enhancer-hud";
  hud.innerHTML = "<b>TizenBrew Web Enhancer</b> &middot; <span style='color:#ef4444'>Red:</span> Portal &middot; <span style='color:#22c55e'>Green:</span> Zoom &middot; <span style='color:#eab308'>Yellow:</span> Dimmer &middot; <span style='color:#3b82f6'>Blue:</span> Hide HUD";
  (document.body || document.documentElement).appendChild(hud);

  var zoomLevels = [1, 1.15, 1.3, 0.9];
  var zoomIdx = 0;
  var dimLevels = [0, 0.25, 0.5, 0.7];
  var dimIdx = 0;
  var portals = [
    "http://192.168.68.66:3002",
    "http://192.168.68.66:5380",
    "http://192.168.68.122:5380",
    "https://news.ycombinator.com"
  ];

  function getFocusable() {
    var sel = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])";
    var list = Array.prototype.slice.call(document.querySelectorAll(sel));
    return list.filter(function (el) {
      if (typeof el.checkVisibility === "function") return el.checkVisibility();
      var r = el.getBoundingClientRect();
      return r.width > 4 && r.height > 4;
    });
  }

  function findSpatialTarget(cur, dir) {
    var items = getFocusable().filter(function (el) { return el !== cur; });
    var curRect = cur.getBoundingClientRect();
    var tol = 4;

    var inDir = items.filter(function (el) {
      var r = el.getBoundingClientRect();
      if (dir === "right") return r.left >= curRect.right - tol;
      if (dir === "left") return r.right <= curRect.left + tol;
      if (dir === "down") return r.top >= curRect.bottom - tol;
      if (dir === "up") return r.bottom <= curRect.top + tol;
      return false;
    });

    if (!inDir.length) return null;

    var cx0 = (curRect.left + curRect.right) / 2;
    var cy0 = (curRect.top + curRect.bottom) / 2;
    var aligned = [];
    var fallback = [];

    inDir.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var cx = (r.left + r.right) / 2;
      var cy = (r.top + r.bottom) / 2;
      var gap, perp, overlaps;

      if (dir === "left" || dir === "right") {
        gap = dir === "right" ? Math.max(0, r.left - curRect.right) : Math.max(0, curRect.left - r.right);
        perp = Math.abs(cy - cy0);
        overlaps = Math.min(r.bottom, curRect.bottom) > Math.max(r.top, curRect.top);
      } else {
        gap = dir === "down" ? Math.max(0, r.top - curRect.bottom) : Math.max(0, curRect.top - r.bottom);
        perp = Math.abs(cx - cx0);
        overlaps = Math.min(r.right, curRect.right) > Math.max(r.left, curRect.left);
      }

      var item = { el: el, gap: gap, perp: perp, score: gap + 2.5 * perp };
      if (overlaps) aligned.push(item);
      else fallback.push(item);
    });

    if (aligned.length) {
      aligned.sort(function (a, b) { return (a.gap - b.gap) || (a.perp - b.perp); });
      return aligned[0].el;
    }
    fallback.sort(function (a, b) { return a.score - b.score; });
    return fallback[0].el;
  }

  window.addEventListener("keydown", function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    var target = (e.composedPath && e.composedPath()[0]) || e.target;
    if (target && target.matches && target.matches(":read-write, select, input[type='range']")) return;

    var code = e.keyCode;
    var k = e.key;
    var dirMap = { 37: "left", ArrowLeft: "left", 38: "up", ArrowUp: "up", 39: "right", ArrowRight: "right", 40: "down", ArrowDown: "down" };
    var dir = dirMap[k] || dirMap[code];

    if (dir) {
      var cur = document.activeElement;
      var focusable = getFocusable();
      if (!cur || cur === document.body || focusable.indexOf(cur) === -1) {
        if (focusable.length) {
          e.preventDefault();
          focusable[0].focus();
          focusable[0].scrollIntoView({ block: "nearest", inline: "nearest" });
        }
        return;
      }
      var next = findSpatialTarget(cur, dir);
      if (next) {
        e.preventDefault();
        next.focus();
        next.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
      return;
    }

    if (code === 403) {
      e.preventDefault();
      var idx = (portals.indexOf(window.location.origin) + 1) % portals.length;
      window.location.href = portals[idx];
    } else if (code === 404) {
      e.preventDefault();
      zoomIdx = (zoomIdx + 1) % zoomLevels.length;
      document.documentElement.style.zoom = String(zoomLevels[zoomIdx]);
    } else if (code === 405) {
      e.preventDefault();
      dimIdx = (dimIdx + 1) % dimLevels.length;
      dimmer.style.opacity = String(dimLevels[dimIdx]);
    } else if (code === 406) {
      e.preventDefault();
      hud.style.opacity = hud.style.opacity === "0" ? "1" : "0";
    }
  });
})();
