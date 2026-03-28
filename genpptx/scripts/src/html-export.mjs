import fs from "fs";
import path from "path";

const W = 1280; // slide canvas width (px)  ≈ 13.33in @ 96dpi
const H = 720;  // slide canvas height (px) ≈ 7.5in @ 96dpi

function inPx(inch) { return Math.round(inch * 96); }
function ptPx(pt)   { return Math.round(pt * 96 / 72); }
function hex(c)     { return c.startsWith("#") ? c : `#${c}`; }

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function imgDataUri(imgPath) {
  if (!imgPath || !fs.existsSync(imgPath)) return null;
  const ext = path.extname(imgPath).slice(1).toLowerCase();
  const mime = (ext === "jpg" || ext === "jpeg") ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${fs.readFileSync(imgPath).toString("base64")}`;
}

// ─── Layout renderers ──────────────────────────────────────────────────────

function renderCover(slide, theme) {
  const { colors: c, typography: t, spacing: s } = theme;
  const mx = inPx(s.slideMargin.left);
  return `
    <div style="position:absolute;left:${mx}px;right:${mx}px;top:${inPx(1.8)}px">
      <div style="font-size:${ptPx(t.coverTitle.fontSize)}px;font-weight:700;color:${hex(c.text)};line-height:1.2">${esc(slide.title)}</div>
      <div style="height:3px;background:${hex(c.primary)};margin:16px 0;width:80px"></div>
      ${slide.subtitle ? `<div style="font-size:${ptPx(t.body.fontSize + 4)}px;color:${hex(c.textSub)};margin-top:8px">${esc(slide.subtitle)}</div>` : ""}
      ${slide.date ? `<div style="font-size:${ptPx(t.body.fontSize)}px;color:${hex(c.textSub)};margin-top:16px">${esc(slide.date)}</div>` : ""}
    </div>`;
}

function renderSection(slide, theme) {
  const { colors: c, typography: t } = theme;
  return `
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;width:80%">
      <div style="font-size:${ptPx(t.sectionTitle.fontSize)}px;font-weight:700;color:${hex(c.text)}">${esc(slide.title)}</div>
      <div style="height:2px;background:${hex(c.primary)};margin:16px auto;width:60px"></div>
      ${slide.subtitle ? `<div style="font-size:${ptPx(t.body.fontSize)}px;color:${hex(c.textSub)};margin-top:8px">${esc(slide.subtitle)}</div>` : ""}
    </div>`;
}

function renderContent(slide, theme) {
  const { colors: c, typography: t, spacing: s } = theme;
  const mx = inPx(s.slideMargin.left);
  const my = inPx(s.slideMargin.top);
  const sw = inPx(s.sidebarWidth);
  const hasSidebar = !!slide.sidebarTitle;
  const contentLeft = hasSidebar ? mx + sw + 16 : mx;

  const sidebar = hasSidebar ? `
    <div style="position:absolute;left:${mx}px;top:${my}px;bottom:${inPx(s.slideMargin.bottom)}px;width:${sw}px;background:${hex(c.surface)};display:flex;align-items:center;justify-content:center;border-radius:4px">
      <div style="transform:rotate(270deg);font-size:${ptPx(t.caption.fontSize)}px;color:${hex(c.textSub)};white-space:nowrap;font-weight:500">${esc(slide.sidebarTitle)}</div>
    </div>` : "";

  const bullets = (slide.bullets || []).map(b =>
    `<div style="display:flex;gap:10px;margin-bottom:10px"><span style="color:${hex(c.primary)};font-size:1.1em;line-height:1.5">•</span><span>${esc(b)}</span></div>`
  ).join("");

  const body = slide.text
    ? `<div style="line-height:1.7">${esc(slide.text)}</div>`
    : `<div>${bullets}</div>`;

  return `
    ${sidebar}
    <div style="position:absolute;left:${contentLeft}px;right:${mx}px;top:${my}px">
      <div style="font-size:${ptPx(t.pageTitle.fontSize)}px;font-weight:700;color:${hex(c.text)};padding-bottom:8px;border-bottom:2px solid ${hex(c.primary)};margin-bottom:${inPx(s.titleGap + 0.1)}px">${esc(slide.title)}</div>
      <div style="font-size:${ptPx(t.body.fontSize)}px;color:${hex(c.text)};line-height:1.6">${body}</div>
    </div>`;
}

function renderTwoColumn(slide, theme) {
  const { colors: c, typography: t, spacing: s } = theme;
  const mx = inPx(s.slideMargin.left);
  const my = inPx(s.slideMargin.top);
  const colW = Math.floor((W - mx * 2 - 24) / 2);

  const col = (data) => {
    if (!data) return "";
    const bullets = (data.bullets || []).map(b =>
      `<div style="display:flex;gap:8px;margin-bottom:8px"><span style="color:${hex(c.primary)}">•</span><span>${esc(b)}</span></div>`
    ).join("");
    return `
      <div style="width:${colW}px">
        ${data.heading ? `<div style="font-size:${ptPx(t.heading.fontSize)}px;font-weight:600;padding-bottom:6px;border-bottom:1px solid ${hex(c.border)};margin-bottom:12px">${esc(data.heading)}</div>` : ""}
        <div style="font-size:${ptPx(t.body.fontSize)}px;color:${hex(c.text)};line-height:1.6">${data.text ? esc(data.text) : bullets}</div>
      </div>`;
  };

  return `
    <div style="position:absolute;left:${mx}px;right:${mx}px;top:${my}px">
      <div style="font-size:${ptPx(t.pageTitle.fontSize)}px;font-weight:700;color:${hex(c.text)};padding-bottom:8px;border-bottom:2px solid ${hex(c.primary)};margin-bottom:${inPx(s.titleGap + 0.1)}px">${esc(slide.title)}</div>
      <div style="display:flex;gap:0">
        ${col(slide.left)}
        <div style="width:1px;background:${hex(c.border)};margin:0 12px"></div>
        ${col(slide.right)}
      </div>
    </div>`;
}

function renderTable(slide, theme) {
  const { colors: c, typography: t, spacing: s } = theme;
  const mx = inPx(s.slideMargin.left);
  const my = inPx(s.slideMargin.top);

  const ths = (slide.headers || []).map(h =>
    `<th style="background:${hex(c.text)};color:${hex(c.white)};padding:7px 12px;text-align:left;font-size:${ptPx(t.body.fontSize - 1)}px">${esc(h)}</th>`
  ).join("");

  const trs = (slide.rows || []).map((row, ri) => {
    const bg = ri % 2 === 0 ? hex(c.bg) : hex(c.surface);
    const tds = row.map((cell, ci) =>
      `<td style="padding:6px 12px;border-bottom:1px solid ${hex(c.border)};font-size:${ptPx(t.body.fontSize - 1)}px;${ci === 0 ? "font-weight:500" : ""}">${esc(String(cell))}</td>`
    ).join("");
    return `<tr style="background:${bg}">${tds}</tr>`;
  }).join("");

  return `
    <div style="position:absolute;left:${mx}px;right:${mx}px;top:${my}px">
      <div style="font-size:${ptPx(t.pageTitle.fontSize)}px;font-weight:700;color:${hex(c.text)};padding-bottom:8px;border-bottom:2px solid ${hex(c.primary)};margin-bottom:${inPx(s.titleGap + 0.1)}px">${esc(slide.title)}</div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>${ths}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
      ${slide.description ? `<div style="font-size:${ptPx(t.caption.fontSize)}px;color:${hex(c.textSub)};margin-top:8px">${esc(slide.description)}</div>` : ""}
    </div>`;
}

function renderSummary(slide, theme) {
  const { colors: c, typography: t, spacing: s } = theme;
  const mx = inPx(s.slideMargin.left);
  const my = inPx(s.slideMargin.top);
  const points = slide.points || (slide.bullets || []).map(b => typeof b === "string" ? { title: b } : b);

  const items = points.map((p, i) => `
    <div style="display:flex;gap:16px;margin-bottom:16px;align-items:flex-start">
      <div style="min-width:32px;height:32px;background:${hex(c.primary)};border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${ptPx(t.body.fontSize)}px;color:${hex(c.text)}">${i + 1}</div>
      <div>
        <div style="font-weight:600;font-size:${ptPx(t.heading.fontSize - 1)}px;color:${hex(c.text)}">${esc(p.title || "")}</div>
        ${p.description ? `<div style="font-size:${ptPx(t.body.fontSize - 1)}px;color:${hex(c.textSub)};margin-top:4px">${esc(p.description)}</div>` : ""}
      </div>
    </div>`).join("");

  return `
    <div style="position:absolute;left:${mx}px;right:${mx}px;top:${my}px">
      <div style="font-size:${ptPx(t.pageTitle.fontSize)}px;font-weight:700;color:${hex(c.text)};padding-bottom:8px;border-bottom:2px solid ${hex(c.primary)};margin-bottom:${inPx(s.titleGap + 0.1)}px">${esc(slide.title || "まとめ")}</div>
      ${items}
    </div>`;
}

function renderClosing(slide, theme) {
  const { colors: c, typography: t } = theme;
  return `
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;width:80%">
      <div style="font-size:${ptPx(t.coverTitle.fontSize)}px;font-weight:700;color:${hex(c.text)}">${esc(slide.title || "Thank You")}</div>
      <div style="height:3px;background:${hex(c.primary)};margin:16px auto;width:80px"></div>
      ${slide.subtitle ? `<div style="font-size:${ptPx(t.body.fontSize + 2)}px;color:${hex(c.textSub)};margin-top:12px">${esc(slide.subtitle)}</div>` : ""}
      ${slide.contact ? `<div style="font-size:${ptPx(t.body.fontSize)}px;color:${hex(c.textSub)};margin-top:8px">${esc(slide.contact)}</div>` : ""}
    </div>`;
}

function renderImageText(slide, theme) {
  const { colors: c, typography: t, spacing: s } = theme;
  const mx = inPx(s.slideMargin.left);
  const my = inPx(s.slideMargin.top);
  const titleH = ptPx(t.pageTitle.fontSize) + inPx(s.titleGap + 0.2) + 10;
  const colW = Math.floor((W - mx * 2 - 20) / 2);
  const imgSrc = imgDataUri(slide.image?.generatedPath || slide.image?.path);

  const imgEl = imgSrc
    ? `<img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:4px">`
    : `<div style="width:100%;height:100%;background:${hex(c.surface)};display:flex;align-items:center;justify-content:center;color:${hex(c.textSub)};font-size:13px;border-radius:4px;border:1px dashed ${hex(c.border)}">image</div>`;

  const bullets = (slide.bullets || []).map(b =>
    `<div style="display:flex;gap:8px;margin-bottom:8px"><span style="color:${hex(c.primary)}">•</span><span>${esc(b)}</span></div>`
  ).join("");

  return `
    <div style="position:absolute;left:${mx}px;right:${mx}px;top:${my}px">
      <div style="font-size:${ptPx(t.pageTitle.fontSize)}px;font-weight:700;color:${hex(c.text)};padding-bottom:8px;border-bottom:2px solid ${hex(c.primary)};margin-bottom:12px">${esc(slide.title)}</div>
    </div>
    <div style="position:absolute;left:${mx}px;width:${colW}px;top:${my + titleH}px;bottom:${inPx(s.slideMargin.bottom) + 20}px;overflow:hidden">${imgEl}</div>
    <div style="position:absolute;left:${mx + colW + 20}px;right:${mx}px;top:${my + titleH}px;font-size:${ptPx(t.body.fontSize)}px;color:${hex(c.text)};line-height:1.6">
      ${slide.text ? esc(slide.text) : bullets}
    </div>`;
}

function renderImageFull(slide, theme) {
  const { colors: c, typography: t, spacing: s } = theme;
  const mx = inPx(s.slideMargin.left);
  const imgSrc = imgDataUri(slide.image?.generatedPath || slide.image?.path);

  if (imgSrc) {
    return `
      <img src="${imgSrc}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
      <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.55);padding:24px ${mx}px">
        <div style="font-size:${ptPx(t.pageTitle.fontSize)}px;font-weight:700;color:#fff">${esc(slide.title || "")}</div>
        ${slide.subtitle ? `<div style="font-size:${ptPx(t.body.fontSize)}px;color:rgba(255,255,255,0.85);margin-top:6px">${esc(slide.subtitle)}</div>` : ""}
      </div>`;
  }
  return `
    <div style="position:absolute;inset:0;background:${hex(c.surface)};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px">
      <div style="color:${hex(c.textSub)};font-size:14px">image placeholder</div>
      <div style="font-size:${ptPx(t.pageTitle.fontSize)}px;font-weight:700;color:${hex(c.text)}">${esc(slide.title || "")}</div>
    </div>`;
}

function renderChart(slide, theme) {
  // Render chart data as a readable table (no external chart library needed)
  const { colors: c, typography: t, spacing: s } = theme;
  const mx = inPx(s.slideMargin.left);
  const my = inPx(s.slideMargin.top);
  const data = slide.chartData || [];
  const labels = data[0]?.labels || [];

  const ths = [""].concat(labels).map(l =>
    `<th style="background:${hex(c.text)};color:${hex(c.white)};padding:6px 10px;font-size:12px">${esc(String(l))}</th>`
  ).join("");

  const trs = data.map(series => {
    const tds = series.values.map(v =>
      `<td style="padding:6px 10px;text-align:center;font-size:12px;border-bottom:1px solid ${hex(c.border)}">${v}</td>`
    ).join("");
    return `<tr><td style="padding:6px 10px;font-weight:500;font-size:12px;border-bottom:1px solid ${hex(c.border)}">${esc(series.name)}</td>${tds}</tr>`;
  }).join("");

  return `
    <div style="position:absolute;left:${mx}px;right:${mx}px;top:${my}px">
      <div style="font-size:${ptPx(t.pageTitle.fontSize)}px;font-weight:700;color:${hex(c.text)};padding-bottom:8px;border-bottom:2px solid ${hex(c.primary)};margin-bottom:${inPx(s.titleGap + 0.1)}px">${esc(slide.title)}</div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>${ths}</tr></thead>
        <tbody>${trs}</tbody>
      </table>
      <div style="font-size:11px;color:${hex(c.textSub)};margin-top:8px">${esc(slide.chartType || "chart")}</div>
    </div>`;
}

// ─── Slide builder ──────────────────────────────────────────────────────────

function buildSlide(slide, theme, n, total) {
  const { colors: c, typography: t, spacing: s } = theme;
  const layout = slide.layout || "content";

  const renderers = {
    cover:      () => renderCover(slide, theme),
    section:    () => renderSection(slide, theme),
    content:    () => renderContent(slide, theme),
    "two-column": () => renderTwoColumn(slide, theme),
    table:      () => renderTable(slide, theme),
    summary:    () => renderSummary(slide, theme),
    closing:    () => renderClosing(slide, theme),
    "image-text": () => renderImageText(slide, theme),
    "image-full": () => renderImageFull(slide, theme),
    chart:      () => renderChart(slide, theme),
  };

  const inner = (renderers[layout] || renderers.content)();
  const footer = `<div style="position:absolute;bottom:${inPx(s.slideMargin.bottom)}px;right:${inPx(s.slideMargin.right)}px;font-size:${ptPx(t.footnote.fontSize)}px;color:${hex(c.textSub)}">${n} / ${total}</div>`;

  return `
  <div class="slide-wrapper" data-n="${n}">
    <div class="slide" style="width:${W}px;height:${H}px;background:${hex(c.bg)};position:relative;overflow:hidden;font-family:'${t.body.fontFace}',sans-serif">
      ${inner}
      ${footer}
    </div>
    <div class="slide-num">${n} / ${total} — ${esc(slide.title || layout)}</div>
  </div>`;
}

// ─── Page shell ─────────────────────────────────────────────────────────────

function buildPage(title, theme, slideDivs, total) {
  const { colors: c } = theme;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#1c1c1e;font-family:'Noto Sans JP',sans-serif}

    /* ── Toolbar ── */
    .toolbar{
      position:fixed;top:0;left:0;right:0;z-index:100;
      background:rgba(28,28,30,.92);backdrop-filter:blur(10px);
      display:flex;align-items:center;justify-content:space-between;
      padding:10px 20px;color:#fff;
    }
    .toolbar h1{font-size:14px;font-weight:500;opacity:.8}
    .toolbar button{
      background:${hex(c.primary)};color:${hex(c.text)};
      border:none;padding:6px 18px;border-radius:6px;
      font-size:13px;font-weight:700;cursor:pointer;
    }

    /* ── Scroll view ── */
    .slides-scroll{
      padding:60px 20px 40px;
      display:flex;flex-direction:column;align-items:center;gap:12px;
    }
    .slide-wrapper{display:flex;flex-direction:column;align-items:center;gap:4px}
    .slide-wrapper .slide{box-shadow:0 4px 24px rgba(0,0,0,.5)}
    .slide-num{font-size:11px;color:rgba(255,255,255,.35);align-self:flex-end}

    /* ── Presenter ── */
    body.presenting .toolbar,
    body.presenting .slides-scroll{display:none}
    .presenter{
      display:none;position:fixed;inset:0;background:#000;
      align-items:center;justify-content:center;
    }
    body.presenting .presenter{display:flex}
    .presenter-slide-area{display:flex;align-items:center;justify-content:center;width:100vw;height:100vh}
    .presenter-nav{
      position:fixed;bottom:16px;left:50%;transform:translateX(-50%);
      display:flex;align-items:center;gap:12px;
      background:rgba(0,0,0,.6);padding:8px 16px;border-radius:20px;color:#fff;font-size:13px;
    }
    .presenter-nav button{
      background:none;border:1px solid rgba(255,255,255,.3);
      color:#fff;padding:4px 12px;border-radius:12px;cursor:pointer;font-family:inherit;
    }
    .presenter-nav button:hover{background:rgba(255,255,255,.1)}
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>${esc(title)}</h1>
    <button onclick="startPresenting()">▶ プレゼン開始</button>
  </div>

  <div class="slides-scroll">
    ${slideDivs}
  </div>

  <div class="presenter">
    <div class="presenter-slide-area" id="presArea"></div>
    <div class="presenter-nav">
      <button onclick="prev()">◀</button>
      <span id="presCounter">1 / ${total}</span>
      <button onclick="next()">▶</button>
      <button onclick="stopPresenting()" style="margin-left:8px;opacity:.6">✕ 終了</button>
    </div>
  </div>

  <script>
    const total = ${total};
    let cur = 1;
    const wrappers = [...document.querySelectorAll('.slides-scroll .slide-wrapper')];

    // ── Responsive scaling for scroll view ──
    function scaleSlides() {
      const maxW = Math.min(window.innerWidth - 40, ${W});
      const scale = maxW / ${W};
      wrappers.forEach(w => {
        const slide = w.querySelector('.slide');
        slide.style.transform = 'scale(' + scale + ')';
        slide.style.transformOrigin = 'top left';
        w.style.width  = Math.round(${W} * scale) + 'px';
        w.style.height = Math.round(${H} * scale) + 'px';
        w.style.overflow = 'hidden';
      });
    }
    scaleSlides();
    window.addEventListener('resize', scaleSlides);

    // ── Presentation mode ──
    function startPresenting() {
      document.body.classList.add('presenting');
      show(cur);
    }
    function stopPresenting() {
      document.body.classList.remove('presenting');
    }
    function show(n) {
      cur = Math.max(1, Math.min(total, n));
      const area = document.getElementById('presArea');
      const original = wrappers[cur - 1].querySelector('.slide');
      area.innerHTML = original.outerHTML;
      const clone = area.querySelector('.slide');
      const scale = Math.min(window.innerWidth / ${W}, window.innerHeight / ${H});
      clone.style.transform = 'scale(' + scale + ')';
      clone.style.transformOrigin = 'center center';
      clone.style.position = 'absolute';
      clone.style.left = '50%';
      clone.style.top  = '50%';
      clone.style.marginLeft = '-${W / 2}px';
      clone.style.marginTop  = '-${H / 2}px';
      document.getElementById('presCounter').textContent = cur + ' / ' + total;
    }
    function next() { show(cur + 1); }
    function prev() { show(cur - 1); }

    document.addEventListener('keydown', e => {
      if (!document.body.classList.contains('presenting')) return;
      if (e.key === 'ArrowRight' || e.key === ' ') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape') stopPresenting();
    });
    window.addEventListener('resize', () => {
      if (document.body.classList.contains('presenting')) show(cur);
    });
  </script>
</body>
</html>`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function exportToHtml(spec, theme, outputPath) {
  const slides = spec.slides || [];
  const total  = slides.length;
  const divs   = slides.map((s, i) => buildSlide(s, theme, i + 1, total)).join("\n");
  const html   = buildPage(spec.title || "Presentation", theme, divs, total);
  fs.writeFileSync(outputPath, html, "utf-8");
  return outputPath;
}
