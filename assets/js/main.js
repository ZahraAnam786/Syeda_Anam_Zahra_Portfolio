/* Shared by index.html and the project detail pages.
   Every feature checks that its elements exist, so a page can leave any of them out. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(selector, scope) { return (scope || document).querySelector(selector); }
  function $$(selector, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(selector)); }
  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  function readStore(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeStore(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* private mode: ignore */ }
  }

  /*==================== THEME ====================*/
  var themeButton = $('#theme-button');
  var themeIcon = themeButton ? $('i', themeButton) : null;

  function applyTheme(theme) {
    root.dataset.theme = theme;
    if (themeIcon) {
      themeIcon.classList.toggle('uil-sun', theme === 'dark');
      themeIcon.classList.toggle('uil-moon', theme !== 'dark');
    }
    if (themeButton) {
      themeButton.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }
  }

  // The inline script in <head> already set data-theme before first paint.
  applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');

  if (themeButton) {
    themeButton.addEventListener('click', function () {
      var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      writeStore('selected-theme', next);
    });
  }

  /*==================== MOBILE MENU ====================*/
  var navMenu = $('#nav-menu');
  var navToggle = $('#nav-toggle');
  var navToggleIcon = navToggle ? $('i', navToggle) : null;

  function setMenu(open) {
    if (!navMenu) return;
    navMenu.classList.toggle('show-menu', open);
    if (navToggle) {
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
    if (navToggleIcon) {
      navToggleIcon.classList.toggle('uil-times', open);
      navToggleIcon.classList.toggle('uil-apps', !open);
    }
  }

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', function () {
      setMenu(!navMenu.classList.contains('show-menu'));
    });

    $$('.nav_link').forEach(function (link) {
      link.addEventListener('click', function () { setMenu(false); });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setMenu(false);
    });

    document.addEventListener('click', function (event) {
      if (!navMenu.classList.contains('show-menu')) return;
      if (navMenu.contains(event.target) || navToggle.contains(event.target)) return;
      setMenu(false);
    });
  }

  /*==================== ACTIVE LINK WHILE SCROLLING ====================*/
  var sections = $$('section[id]');
  var links = $$('.nav_link');

  function setActive(id) {
    links.forEach(function (link) {
      link.classList.toggle('active-link', link.getAttribute('href') === '#' + id);
    });
  }

  if ('IntersectionObserver' in window && sections.length && links.length) {
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach(function (section) { sectionObserver.observe(section); });
  }

  /*==================== SKILLS ACCORDION ====================*/
  $$('.skill_head').forEach(function (button) {
    button.addEventListener('click', function () {
      var card = button.closest('.skill');
      var open = !card.classList.contains('is-open');
      card.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
    });
  });

  /*==================== EXPERIENCE TABS + TREE ====================*/
  var tabs = $$('.tab');
  var trunks = $$('.trunk');

  // Measure where the first and last nodes sit so the trunk only spans between them.
  function layoutTrunk(trunk) {
    if (trunk.hidden) return;
    var leaves = $$('.leaf', trunk);
    if (!leaves.length) return;

    function nodeCentre(leaf) {
      var node = $('.leaf_node', leaf);
      return leaf.offsetTop + node.offsetTop + node.offsetHeight / 2;
    }

    var top = nodeCentre(leaves[0]);
    var bottom = nodeCentre(leaves[leaves.length - 1]);
    trunk.style.setProperty('--ty', top + 'px');
    trunk.style.setProperty('--th', (bottom - top) + 'px');
  }

  // Grow the trunk and switch on each leaf as the page scrolls past it.
  function updateTrunk(trunk) {
    if (trunk.hidden) return;
    var anchor = window.innerHeight * 0.62;
    var rect = trunk.getBoundingClientRect();
    var ty = parseFloat(trunk.style.getPropertyValue('--ty')) || 0;
    var th = parseFloat(trunk.style.getPropertyValue('--th')) || 0;
    var progress = th > 0 ? clamp((anchor - (rect.top + ty)) / th, 0, 1) : 0;
    trunk.style.setProperty('--p', progress.toFixed(4));

    $$('.leaf', trunk).forEach(function (leaf) {
      var node = $('.leaf_node', leaf).getBoundingClientRect();
      leaf.classList.toggle('is-on', node.top + node.height / 2 < anchor);
    });
  }

  function selectTab(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
    trunks.forEach(layoutTrunk);
    update();
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { selectTab(tab); });
    tab.addEventListener('keydown', function (event) {
      var next = null;
      if (event.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      if (event.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (next) {
        event.preventDefault();
        next.focus();
        selectTab(next);
      }
    });
  });

  /*==================== SCROLL: HEADER, PROGRESS BAR, TOP BUTTON, TREE ====================*/
  var header = $('#header');
  var scrollUp = $('#scroll-up');
  var ticking = false;

  function update() {
    var y = window.scrollY || window.pageYOffset;
    var max = root.scrollHeight - window.innerHeight;
    if (header) header.classList.toggle('scroll-header', y >= 8);
    if (scrollUp) scrollUp.classList.toggle('show-scroll', y >= 600);
    root.style.setProperty('--scroll', max > 0 ? clamp(y / max, 0, 1).toFixed(4) : '0');
    trunks.forEach(updateTrunk);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      ticking = false;
      update();
    });
  }

  function onResize() {
    trunks.forEach(layoutTrunk);
    update();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('load', onResize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);
  onResize();

  /*==================== REVEAL ON SCROLL ====================*/
  var revealSelector = '.split_head .h2, .section_h, .prose > *, .skill, .feature, .card, .shots, .points, .rows .row, .tabs, .section_lead, .contact_panel';
  var revealItems = $$(revealSelector);

  revealItems.forEach(function (el) {
    var siblings = el.parentNode ? el.parentNode.children : [];
    var index = Array.prototype.indexOf.call(siblings, el);
    el.style.setProperty('--d', Math.min(index, 5) * 70 + 'ms');
  });

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach(function (el) { el.classList.add('in'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    revealItems.forEach(function (el) { revealObserver.observe(el); });
  }

  /*==================== COUNT-UP NUMBERS ====================*/
  function countUp(el) {
    var to = parseInt(el.getAttribute('data-to'), 10);
    var suffix = el.getAttribute('data-suffix') || '';
    if (isNaN(to)) return;
    var duration = 1300;
    var start = null;

    function step(now) {
      if (start === null) start = now;
      var t = clamp((now - start) / duration, 0, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(to * eased) + (t === 1 ? suffix : '');
      if (t < 1) window.requestAnimationFrame(step);
    }

    el.textContent = '0';
    window.requestAnimationFrame(step);
  }

  if (!reduceMotion && 'IntersectionObserver' in window) {
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        countUp(entry.target);
        countObserver.unobserve(entry.target);
      });
    }, { threshold: 0.6 });

    $$('.count').forEach(function (el) { countObserver.observe(el); });
  }

  /*==================== SCREENSHOT TILT ====================*/
  var finePointer = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (finePointer && !reduceMotion) {
    $$('.shots .frame').forEach(function (frame) {
      frame.addEventListener('pointermove', function (event) {
        var rect = frame.getBoundingClientRect();
        var x = (event.clientX - rect.left) / rect.width - 0.5;
        var y = (event.clientY - rect.top) / rect.height - 0.5;
        frame.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg');
        frame.style.setProperty('--rx', (-y * 6).toFixed(2) + 'deg');
      });
      frame.addEventListener('pointerleave', function () {
        frame.style.setProperty('--ry', '0deg');
        frame.style.setProperty('--rx', '0deg');
      });
    });
  }

  /*==================== COPY EMAIL ====================*/
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(area);
      if (ok) resolve(); else reject(new Error('copy failed'));
    });
  }

  $$('.copy').forEach(function (button) {
    var label = $('span', button);
    var original = label ? label.textContent : '';
    var timer = null;

    button.addEventListener('click', function () {
      copyText(button.getAttribute('data-copy') || '').then(function () {
        button.classList.add('is-done');
        if (label) label.textContent = 'Copied';
      }, function () {
        if (label) label.textContent = 'Copy failed';
      }).then(function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          button.classList.remove('is-done');
          if (label) label.textContent = original;
        }, 1800);
      });
    });
  });

  /*==================== FOOTER YEAR ====================*/
  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  // Tells the inline script in <head> that this file ran, so content stays hidden for the reveal.
  window.__ready = true;
})();
