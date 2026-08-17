(function () {
  function parseColor(str) {
    if (!str) return null;
    const m = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
    if (!m) return null;
    return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), m[4] !== undefined ? parseFloat(m[4]) : 1];
  }

  function composite(fg, bg) {
    const a = fg[3];
    return [
      fg[0] * a + bg[0] * (1 - a),
      fg[1] * a + bg[1] * (1 - a),
      fg[2] * a + bg[2] * (1 - a),
    ];
  }

  function relLuminance([r, g, b]) {
    const [rs, gs, bs] = [r, g, b].map((c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  function ratio(rgb1, rgb2) {
    const L1 = relLuminance(rgb1);
    const L2 = relLuminance(rgb2);
    const lighter = Math.max(L1, L2);
    const darker = Math.min(L1, L2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function effectiveBg(el) {
    const chain = [];
    let node = el;
    let hasImageOrGradient = false;
    while (node && node !== document.documentElement.parentElement) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        hasImageOrGradient = true;
      }
      const bg = parseColor(cs.backgroundColor);
      if (bg && bg[3] > 0) {
        chain.push(bg);
        if (bg[3] === 1) break;
      }
      node = node.parentElement;
    }
    chain.reverse();
    let result = [255, 255, 255];
    for (const layer of chain) {
      result = composite(layer, result);
    }
    return { rgb: result, uncertain: hasImageOrGradient };
  }

  function isVisible(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    return true;
  }

  function hasDirectText(el) {
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) return true;
    }
    return false;
  }

  const results = [];
  const seen = new Set();
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    if (!hasDirectText(el)) continue;
    if (!isVisible(el)) continue;
    const cs = getComputedStyle(el);
    const fgColor = parseColor(cs.color);
    if (!fgColor) continue;
    const { rgb: bgRgb, uncertain } = effectiveBg(el);
    const fgComposited = composite(fgColor, bgRgb);
    const cr = ratio(fgComposited, bgRgb);
    const fontSize = parseFloat(cs.fontSize);
    const fontWeight = parseInt(cs.fontWeight, 10) || 400;
    const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
    const threshold = isLarge ? 3.0 : 4.5;
    const text = el.textContent.trim().slice(0, 60);
    const key = text + '|' + cs.color + '|' + JSON.stringify(bgRgb);
    if (seen.has(key)) continue;
    seen.add(key);
    if (cr < threshold || uncertain) {
      results.push({
        text,
        tag: el.tagName,
        cls: (el.className || '').toString().slice(0, 90),
        color: cs.color,
        bg: `rgb(${bgRgb.map(Math.round).join(',')})`,
        ratio: Math.round(cr * 100) / 100,
        threshold,
        fontSize: Math.round(fontSize),
        fontWeight,
        uncertain,
      });
    }
  }
  results.sort((a, b) => a.ratio - b.ratio);
  return JSON.stringify({ theme: document.documentElement.className, url: location.href, violations: results });
})();
