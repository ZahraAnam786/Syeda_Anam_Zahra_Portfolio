/* Every project on the site lives in data/projects.json (edited from admin.html).
   This file draws them: the "latest project" panel and the cards on the home page, the footer list,
   and the project page (project.html?id=...). admin.html uses the same functions for its preview,
   so what you preview is what gets published.
   All text goes in with textContent (never innerHTML), so nothing typed in the form can break the page.

   A project looks like:
   { id, title, summary, lead?, tech[], tint, links{live,code}, cover?[], added,
     sections: [ { id, title, sub?, icon?, nav?, blocks: [
        { type: 'p', text }
        { type: 'points', items: [ { title?, text } ] }
        { type: 'shots', layout: 'one' | 'grid', items: [ { src, caption, alt?, w, h, crop } ] }
        { type: 'rows', items: [ { label, value } ] } ] } ] } */
(function () {
  'use strict';

  var DATA_URL = 'data/projects.json';

  // How a screenshot is cut. "screen" hides the browser tabs and taskbar of a full-screen capture.
  var CROP = {
    screen: 'shot',
    sq: 'shot shot--sq',
    c62: 'shot shot--c62',
    plain: 'shot shot--plain',
    fit: 'shot shot--fit',
    'fit-top': 'shot shot--fit shot--top'
  };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  // Only web links are allowed, so a "javascript:" link can never be published.
  function safeUrl(url) {
    return /^https?:\/\//i.test(String(url || '').trim()) ? String(url).trim() : '';
  }

  // Images must come from assets/img (or be a local preview of a file that was just picked).
  function safeImage(src) {
    src = String(src || '');
    if (/^assets\/img\/[\w\-. /]+$/.test(src) && src.indexOf('..') === -1) return src;
    if (/^(blob:|data:image\/)/.test(src)) return src;
    return '';
  }

  function safeTint(color) {
    return /^#[0-9a-fA-F]{6}$/.test(color || '') ? color : '#5B3FD6';
  }

  function safeIcon(icon) {
    return /^uil-[a-z0-9-]+$/.test(icon || '') ? icon : 'uil-file-alt';
  }

  function cropClass(crop) { return CROP[crop] || CROP.plain; }

  function pageUrl(project) {
    return 'project.html?id=' + encodeURIComponent(project.id);
  }

  function frame(label, imgSrc, shotClass, alt, width, height, extraClass) {
    var figure = el('figure', extraClass ? 'frame ' + extraClass : 'frame');
    var bar = el('figcaption', 'frame_bar');
    for (var i = 0; i < 3; i++) bar.appendChild(el('span', 'frame_dot'));
    bar.appendChild(el('span', 'frame_label', label));
    figure.appendChild(bar);
    var shot = el('div', shotClass);
    var img = el('img');
    img.src = imgSrc;
    img.alt = alt;
    if (width && height) { img.width = width; img.height = height; }
    img.loading = 'lazy';
    img.decoding = 'async';
    shot.appendChild(img);
    figure.appendChild(shot);
    return figure;
  }

  function chips(list, small, max) {
    var ul = el('ul', small ? 'chips chips--sm' : 'chips');
    var shown = max ? list.slice(0, max) : list;
    shown.forEach(function (name) { ul.appendChild(el('li', 'chip', name)); });
    if (max && list.length > max) ul.appendChild(el('li', 'chip chip--more', '+' + (list.length - max) + ' more'));
    return ul;
  }

  // The pictures for the home page. A project can set its own "cover"; otherwise the first screenshot is used.
  function coverOf(project) {
    if (project.cover && project.cover.length) {
      return project.cover.filter(function (c) { return safeImage(c.src); });
    }
    var found = [];
    (project.sections || []).forEach(function (section) {
      (section.blocks || []).forEach(function (block) {
        if (block.type === 'shots' && !found.length && block.items && block.items.length) {
          var s = block.items[0];
          if (safeImage(s.src)) {
            found.push({ src: s.src, label: project.title, crop: !s.crop || s.crop === 'plain' ? 'fit-top' : s.crop, w: s.w, h: s.h, alt: s.alt || project.title + ' screenshot' });
          }
        }
      });
    });
    return found;
  }

  function coverFrame(c, project, extraClass) {
    return frame(c.label || project.title, safeImage(c.src), cropClass(c.crop), c.alt || project.title + ' screenshot', c.w, c.h, extraClass);
  }

  /*==================== HOME PAGE: LATEST PROJECT PANEL ====================*/
  function featureNode(project, linkOverride) {
    var covers = coverOf(project);
    var feature = el('article', 'feature in');

    var media = el('div', 'feature_media');
    if (covers.length >= 2) {
      var duo = el('div', 'duo');
      duo.appendChild(coverFrame(covers[0], project, 'frame--light'));
      duo.appendChild(coverFrame(covers[1], project, 'frame--dark'));
      media.appendChild(duo);
    } else if (covers.length === 1) {
      var solo = el('div', 'solo');
      solo.appendChild(coverFrame(covers[0], project));
      media.appendChild(solo);
    }
    feature.appendChild(media);

    var body = el('div', 'feature_body');
    body.appendChild(el('span', 'pill', 'Latest project'));
    body.appendChild(el('h3', 'feature_title', project.title));
    body.appendChild(el('p', 'feature_text', project.summary));
    body.appendChild(chips(project.tech || [], false));
    var link = el('a', 'btn btn-light', 'See the project');
    link.href = linkOverride || pageUrl(project);
    body.appendChild(link);
    feature.appendChild(body);
    return feature;
  }

  /*==================== HOME PAGE: CARD ====================*/
  function cardNode(project, linkOverride) {
    var card = el('article', 'card in');
    card.style.setProperty('--tint', safeTint(project.tint));

    var visual = el('div', 'card_visual');
    var covers = coverOf(project);
    if (covers.length) visual.appendChild(coverFrame(covers[0], project));
    card.appendChild(visual);

    var body = el('div', 'card_body');
    body.appendChild(el('h3', 'card_title', project.title));
    body.appendChild(el('p', 'card_text', project.summary));
    body.appendChild(chips(project.tech || [], true, 4));
    var link = el('a', 'card_link', 'See the project');
    link.href = linkOverride || pageUrl(project);
    var icon = el('i', 'uil uil-arrow-up-right');
    icon.setAttribute('aria-hidden', 'true');
    link.appendChild(icon);
    body.appendChild(link);
    card.appendChild(body);
    return card;
  }

  /*==================== PROJECT PAGE ====================*/
  function blockNode(project, block, instant) {
    var i;
    if (block.type === 'p') {
      return el('p', instant ? 'in' : '', block.text);
    }
    if (block.type === 'points') {
      var ul = el('ul', instant ? 'points in' : 'points');
      (block.items || []).forEach(function (item) {
        var li = el('li');
        if (item.title) {
          li.appendChild(el('b', null, item.title.replace(/[.:;!?]+$/, '') + '.'));
          li.appendChild(document.createTextNode(' '));
        }
        li.appendChild(document.createTextNode(item.text));
        ul.appendChild(li);
      });
      return ul;
    }
    if (block.type === 'shots') {
      var items = (block.items || []).filter(function (s) { return safeImage(s.src); });
      if (!items.length) return null;
      var grid = el('div', (block.layout === 'one' ? 'shots shots--one' : 'shots') + (instant ? ' in' : ''));
      items.forEach(function (shot, n) {
        var caption = shot.caption || 'Screen ' + (n + 1);
        grid.appendChild(frame(caption, safeImage(shot.src), cropClass(shot.crop),
          shot.alt || project.title + ': ' + caption, shot.w, shot.h));
      });
      return grid;
    }
    if (block.type === 'rows') {
      var rows = el('div', 'rows');
      (block.items || []).forEach(function (item) {
        var row = el('div', instant ? 'row in' : 'row');
        row.appendChild(el('p', 'row_label', item.label));
        row.appendChild(el('div', 'row_value', item.value));
        rows.appendChild(row);
      });
      return rows;
    }
    return null;
  }

  // opts.instant: skip the scroll-reveal animation (used by the admin preview, which has no main.js).
  function detailNode(project, opts) {
    var instant = !!(opts && opts.instant);
    var out = document.createDocumentFragment();

    var hero = el('section', 'page_hero');
    var heroBox = el('div', 'container');
    heroBox.appendChild(el('h1', 'page_title', project.title));
    heroBox.appendChild(el('p', 'page_lead', project.lead || project.summary));
    if ((project.tech || []).length) heroBox.appendChild(chips(project.tech, false));
    var live = safeUrl(project.links && project.links.live);
    var code = safeUrl(project.links && project.links.code);
    if (live || code) {
      var actions = el('div');
      actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.5rem';
      [[live, 'Open live site', 'btn btn-primary'], [code, 'View source code', 'btn btn-ghost']].forEach(function (item) {
        if (!item[0]) return;
        var a = el('a', item[2], item[1]);
        a.href = item[0];
        a.target = '_blank';
        a.rel = 'noopener';
        actions.appendChild(a);
      });
      heroBox.appendChild(actions);
    }
    hero.appendChild(heroBox);
    out.appendChild(hero);

    (project.sections || []).forEach(function (section) {
      var sec = el('section', 'block');
      if (section.id && /^[\w-]+$/.test(section.id)) sec.id = section.id;
      var box = el('div', 'container split');
      var head = el('div', 'split_head');
      head.appendChild(el('h2', instant ? 'h2 in' : 'h2', section.title));
      if (section.sub) head.appendChild(el('p', 'split_sub', section.sub));
      var body = el('div', 'split_body prose');
      (section.blocks || []).forEach(function (block) {
        var node = blockNode(project, block, instant);
        if (node) body.appendChild(node);
      });
      box.appendChild(head);
      box.appendChild(body);
      sec.appendChild(box);
      out.appendChild(sec);
    });
    return out;
  }

  // Sections that get a link in the top menu. The menu only appears when there are at least 3.
  function navSections(project) {
    var list = (project.sections || []).filter(function (s) { return s.nav !== false && s.id && s.title; });
    return list.length >= 3 ? list : [];
  }

  /*==================== LOADING ====================*/
  function load() {
    return fetch(DATA_URL, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('projects.json ' + res.status);
      return res.json();
    }).then(function (data) {
      return Array.isArray(data.projects) ? data.projects : [];
    });
  }

  function addFooterLinks(projects) {
    var footerList = document.querySelector('nav[aria-label="Project pages"] ul');
    if (!footerList) return;
    footerList.textContent = '';
    projects.forEach(function (project) {
      var li = el('li');
      var a = el('a', null, project.title);
      a.href = pageUrl(project);
      li.appendChild(a);
      footerList.appendChild(li);
    });
  }

  function mountHome(projects) {
    var slot = document.getElementById('feature-slot');
    var grid = document.querySelector('#portfolio .cards');
    if (!slot || !grid) return;
    projects.forEach(function (project, i) {
      if (i === 0) slot.appendChild(featureNode(project)); else grid.appendChild(cardNode(project));
    });
  }

  function loadMainScript() {
    var s = document.createElement('script');
    s.src = 'assets/js/main.js';
    document.body.appendChild(s);
  }

  function mountProjectPage(projects) {
    var host = document.getElementById('project-root');
    var id = new URLSearchParams(location.search).get('id');
    var project = projects.filter(function (p) { return p.id === id; })[0];
    host.textContent = '';
    addFooterLinks(projects);

    var navMenu = document.getElementById('nav-menu');
    var navToggle = document.getElementById('nav-toggle');
    var items = project ? navSections(project) : [];
    if (items.length) {
      var list = navMenu.querySelector('.nav_list');
      items.forEach(function (section) {
        var li = el('li');
        var a = el('a', 'nav_link');
        a.href = '#' + section.id;
        var icon = el('i', 'uil ' + safeIcon(section.icon) + ' nav_icon');
        a.appendChild(icon);
        a.appendChild(document.createTextNode(section.navLabel || section.title));
        li.appendChild(a);
        list.appendChild(li);
      });
    } else {
      if (navMenu) navMenu.remove();
      if (navToggle) navToggle.remove();
    }

    if (!project) {
      var box = el('div', 'container');
      box.style.padding = '8rem 0 6rem';
      box.appendChild(el('h1', 'page_title', 'Project not found'));
      var back = el('a', 'btn btn-primary', 'Back to portfolio');
      back.href = 'index.html#portfolio';
      back.style.marginTop = '1.5rem';
      box.appendChild(back);
      host.appendChild(box);
    } else {
      document.title = project.title + ' | Syeda Anam Zahra';
      var meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', project.summary);
      host.appendChild(detailNode(project));
    }
    loadMainScript();   // after drawing, so the menu, scroll reveal and tilt see the new content
  }

  window.SAZProjects = {
    cardNode: cardNode, featureNode: featureNode, detailNode: detailNode, navSections: navSections,
    load: load, safeUrl: safeUrl, safeImage: safeImage, CROP: CROP,
    coverOf: coverOf, coverFrame: coverFrame, mountHome: mountHome
  };

  // The home page is drawn by site.js, which calls SAZProjects.mountHome(projects) once its sections exist.
  if (document.getElementById('project-root')) {
    load().then(mountProjectPage, function () { mountProjectPage([]); });
  }
})();
