/**
 * Audit layout at the product viewport matrix.
 * Run: node .../browser.mjs http://localhost:3002 --script ./responsive-audit.mjs
 */
const WIDTHS = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];
const PAGES = ['/', '/login', '/reports'];
const TOUCH_MAX = 430;

function layoutMode(width) {
  if (width < 768) return 'phone';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

async function measure(page, width) {
  return page.evaluate((w) => {
    const doc = document.documentElement;
    const body = document.body;
    const overflowX = Math.max(doc.scrollWidth, body.scrollWidth) - w;
    const header = document.querySelector('header');
    const headerOverflow = header ? header.scrollWidth - header.clientWidth : 0;
    const bottomNav = document.querySelector('nav.mobile-bottom-nav, nav[aria-label*="obile"]');
    const desktopNav = document.querySelector('header nav[aria-label]');
    const desktopNavVisible = desktopNav
      ? window.getComputedStyle(desktopNav).display !== 'none'
      : false;
    const bottomNavVisible = bottomNav
      ? window.getComputedStyle(bottomNav).display !== 'none'
      : false;

    const controls = [...document.querySelectorAll('a, button, input, select, textarea')].filter(
      (el) => {
        if (el.classList.contains('sr-only')) return false;
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || s.position === 'absolute' && (s.clip || s.clipPath)) return false;
        if (s.width === '1px' && s.height === '1px') return false;
        const r = el.getBoundingClientRect();
        return r.width > 4 && r.height > 4;
      },
    );
    const small = controls
      .map((el) => {
        const hit = el.closest('label') || el;
        const r = hit.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          name: (el.getAttribute('aria-label') || el.textContent || el.id || '').trim().slice(0, 40),
          h: Math.round(r.height * 10) / 10,
          w: Math.round(r.width * 10) / 10,
        };
      })
      .filter((c) => c.h < 40 && c.w < 40);

    const h1 = document.querySelector('h1');
    const h1Top = h1 ? h1.getBoundingClientRect().top : null;
    const email = document.querySelector('input[type="email"]');
    const emailTop = email ? email.getBoundingClientRect().top : null;

    return {
      innerWidth: window.innerWidth,
      overflowX: Math.round(overflowX * 10) / 10,
      headerOverflow: Math.round(headerOverflow * 10) / 10,
      bottomNavVisible,
      desktopNavVisible,
      h1Top: h1Top == null ? null : Math.round(h1Top),
      emailTop: emailTop == null ? null : Math.round(emailTop),
      viewportH: window.innerHeight,
      tinyControls: small.slice(0, 8),
      tinyCount: small.length,
    };
  }, width);
}

export default async function run(page) {
  const base = page.url().replace(/\/$/, '') || 'http://localhost:3002';
  const results = [];

  for (const path of PAGES) {
    await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(300);

    for (const width of WIDTHS) {
      const height = width < 768 ? 740 : 900;
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(150);
      const mode = layoutMode(width);
      const m = await measure(page, width);
      const issues = [];
      if (m.overflowX > 1) issues.push(`page overflow-x ${m.overflowX}px`);
      if (m.headerOverflow > 1) issues.push(`header overflow-x ${m.headerOverflow}px`);
      if ((mode === 'phone' || mode === 'tablet') && path !== '/login' && !m.bottomNavVisible) {
        issues.push('bottom nav missing below lg');
      }
      if ((mode === 'phone' || mode === 'tablet') && m.desktopNavVisible) {
        issues.push('desktop nav visible below lg');
      }
      if (mode === 'desktop' && m.bottomNavVisible) issues.push('bottom nav visible at lg+');
      if (mode === 'desktop' && path !== '/login' && !m.desktopNavVisible) {
        issues.push('desktop nav missing at lg+');
      }
      if (path === '/login' && m.emailTop != null && m.emailTop > m.viewportH - 80) {
        issues.push(`email field below fold (top ${m.emailTop})`);
      }
      if (path === '/login' && m.h1Top != null && m.h1Top > m.viewportH * 0.65) {
        issues.push(`login title not immediately accessible (top ${m.h1Top})`);
      }
      if (width <= TOUCH_MAX && m.tinyCount > 0) {
        issues.push(`${m.tinyCount} controls under 40×40 (${m.tinyControls.map((c) => c.name || c.tag).join(', ')})`);
      }
      results.push({ width, path, mode, issues, overflowX: m.overflowX, bottomNav: m.bottomNavVisible, desktopNav: m.desktopNavVisible });
    }
  }

  const failed = results.filter((r) => r.issues.length > 0);
  return {
    ok: failed.length === 0,
    checked: results.length,
    failed: failed.length,
    failures: failed,
    summary: results.map((r) => ({
      width: r.width,
      path: r.path,
      overflowX: r.overflowX,
      bottomNav: r.bottomNav,
      desktopNav: r.desktopNav,
      issues: r.issues,
    })),
  };
}
