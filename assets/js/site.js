/* Draws everything on the home page except the project cards (those are drawn by projects.js):
   header menu, hero, tech strip, About, Skills, Experience, Projects heading, Contact and the footer.
   All of it comes from data/site.json, which admin.html edits. The project page (project.html)
   only uses the footer. admin.html uses the same functions for its preview.
   All text goes in with textContent (never innerHTML), so nothing typed in the admin can break the page.

   data/site.json looks like:
   { meta{title, description}, labels{about, skills, experience, portfolio, contact, seeProjects, downloadCv, tabWork, tabEdu, footerNote},
     profile{name, role, buildPrefix, words[], lead, cv, footerText},
     links{email, phone, phoneShown, linkedin, github, location},
     marquee[], sections[ {id, show} ],
     about{photo, paragraphs[], stats[{value, suffix, label}], facts[{label, value}]},
     skills[ {icon, title, sub, open, items[]} ],
     experience{work[], education[]}  each: {when, title, role, text},
     projectsIntro, contact{title, lead} } */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null);
  else root.SAZSite = factory(root);
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var DATA_URL = 'data/site.json';

  var SECTION_INFO = {
    about: { label: 'About', icon: 'uil-user' },
    skills: { label: 'Skills', icon: 'uil-brackets-curly' },
    experience: { label: 'Experience', icon: 'uil-briefcase-alt' },
    portfolio: { label: 'Projects', icon: 'uil-folder' },
    contact: { label: 'Contact', icon: 'uil-envelope' }
  };
  var DEFAULT_LABELS = {
    about: 'About', skills: 'Skills', experience: 'Experience', portfolio: 'Projects', contact: 'Contact',
    seeProjects: 'See my projects', downloadCv: 'Download CV', tabWork: 'Work', tabEdu: 'Education',
    footerNote: 'Built with plain HTML, CSS and JavaScript.'
  };
  var SECTION_ORDER = ['about', 'skills', 'experience', 'portfolio', 'contact'];

  /*==================== SMALL HELPERS ====================*/
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function icon(name, extra) {
    var i = el('i', 'uil ' + name + (extra ? ' ' + extra : ''));
    i.setAttribute('aria-hidden', 'true');
    return i;
  }

  function str(v) { return typeof v === 'string' ? v : (v === undefined || v === null ? '' : String(v)); }
  function list(v) { return Array.isArray(v) ? v : []; }

  function safeWebUrl(url) {
    url = str(url).trim();
    return /^https?:\/\//i.test(url) ? url : '';
  }
  function safeEmail(email) {
    email = str(email).trim();
    return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email) ? email : '';
  }
  function safePhone(phone) {
    var p = str(phone).replace(/[^\d+]/g, '');
    return p.length >= 5 ? p : '';
  }
  function safeIcon(name) { return /^uil-[a-z0-9-]+$/.test(name || '') ? name : 'uil-file-alt'; }
  function safePhoto(src) {
    src = str(src);
    if (/^assets\/img\/[\w\-. /]+$/.test(src) && src.indexOf('..') === -1) return src;
    if (/^(blob:|data:image\/)/.test(src)) return src;
    return '';
  }
  function safeCv(src) {
    src = str(src);
    if (/^assets\/pdf\/[\w\-. /]+\.pdf$/i.test(src) && src.indexOf('..') === -1) return src;
    if (/^blob:/.test(src)) return src;
    return '';
  }

  // The last part of a profile link, shown as the card value (".../in/syeda-anam-zahra/" -> "syeda-anam-zahra").
  function handleOf(url) {
    var parts = url.replace(/[?#].*$/, '').replace(/\/+$/, '').split('/');
    return parts[parts.length - 1] || url;
  }

  function initials(name) {
    var letters = str(name).trim().split(/\s+/).filter(Boolean).map(function (w) { return w.charAt(0).toUpperCase(); });
    return letters.slice(0, 3).join('') || '?';
  }

  /*==================== DEFAULTS ====================*/
  // Fills in anything missing, so a half-written site.json can never break the page.
  function normalize(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var lb = raw.labels || {}, mt = raw.meta || {};
    var labels = {};
    Object.keys(DEFAULT_LABELS).forEach(function (k) { labels[k] = str(lb[k]).trim() || DEFAULT_LABELS[k]; });
    var p = raw.profile || {}, l = raw.links || {}, a = raw.about || {}, e = raw.experience || {}, c = raw.contact || {};

    var seen = {};
    var sections = [];
    list(raw.sections).forEach(function (s) {
      if (s && SECTION_INFO[s.id] && !seen[s.id]) { seen[s.id] = true; sections.push({ id: s.id, show: s.show !== false }); }
    });
    SECTION_ORDER.forEach(function (id) { if (!seen[id]) sections.push({ id: id, show: true }); });

    function exp(items) {
      return list(items).map(function (x) {
        x = x || {};
        return { when: str(x.when), title: str(x.title), role: str(x.role), text: str(x.text) };
      });
    }

    return {
      meta: { title: str(mt.title), description: str(mt.description) },
      labels: labels,
      profile: {
        name: str(p.name), role: str(p.role), buildPrefix: str(p.buildPrefix),
        words: list(p.words).map(str).filter(Boolean), lead: str(p.lead), cv: str(p.cv), footerText: str(p.footerText)
      },
      links: {
        email: str(l.email), phone: str(l.phone), phoneShown: str(l.phoneShown),
        linkedin: str(l.linkedin), github: str(l.github), location: str(l.location)
      },
      marquee: list(raw.marquee).map(str).filter(Boolean),
      sections: sections,
      about: {
        photo: str(a.photo),
        paragraphs: list(a.paragraphs).map(str).filter(Boolean),
        stats: list(a.stats).map(function (s) {
          s = s || {};
          return { value: parseInt(s.value, 10) || 0, suffix: str(s.suffix), label: str(s.label) };
        }),
        facts: list(a.facts).map(function (f) { f = f || {}; return { label: str(f.label), value: str(f.value) }; })
      },
      skills: list(raw.skills).map(function (g) {
        g = g || {};
        return { icon: str(g.icon), title: str(g.title), sub: str(g.sub), open: g.open !== false, items: list(g.items).map(str).filter(Boolean) };
      }),
      experience: { work: exp(e.work), education: exp(e.education) },
      projectsIntro: str(raw.projectsIntro),
      contact: { title: str(c.title), lead: str(c.lead) }
    };
  }

  function sectionVisible(site, id) {
    return site.sections.some(function (s) { return s.id === id && s.show; });
  }

  /*==================== HEADER MENU ====================*/
  function navItems(site, hasProjects) {
    var items = [{ id: 'home', label: 'Home', icon: 'uil-estate' }];
    site.sections.forEach(function (s) {
      if (!s.show) return;
      if (s.id === 'portfolio' && !hasProjects) return;
      items.push({ id: s.id, label: site.labels[s.id], icon: SECTION_INFO[s.id].icon });
    });
    return items;
  }

  function mountNav(site, hasProjects) {
    var ul = document.getElementById('nav-list');
    if (ul) {
      ul.textContent = '';
      navItems(site, hasProjects).forEach(function (item) {
        var li = el('li');
        var a = el('a', 'nav_link');
        a.href = '#' + item.id;
        a.appendChild(icon(item.icon, 'nav_icon'));
        a.appendChild(document.createTextNode(item.label));
        li.appendChild(a);
        ul.appendChild(li);
      });
    }
    var logo = document.querySelector('.nav_logo[data-site-name]');
    if (logo && site.profile.name) logo.textContent = site.profile.name;
  }

  /*==================== HERO ====================*/
  function nameNode(name) {
    var h1 = el('h1', 'hero_name');
    var words = name.trim().split(/\s+/).filter(Boolean);
    var lines = words.length > 1 ? [words.slice(0, -1).join(' '), words[words.length - 1]] : [name];
    lines.forEach(function (text, i) {
      if (i) h1.appendChild(document.createTextNode(' '));
      var line = el('span', 'line');
      line.appendChild(el('span', null, text));
      h1.appendChild(line);
    });
    return h1;
  }

  function cvButton(site, className) {
    var cv = safeCv(site.profile.cv);
    if (!cv) return null;
    var a = el('a', className);
    a.href = cv;
    a.setAttribute('download', (site.profile.name || 'CV').replace(/\s+/g, '-') + '-CV.pdf');
    a.appendChild(icon('uil-download-alt'));
    a.appendChild(document.createTextNode(site.labels.downloadCv));
    return a;
  }

  function heroLinks(site) {
    var ul = el('ul', 'hero_links');
    [
      [safeWebUrl(site.links.linkedin), 'LinkedIn profile', 'uil-linkedin-alt', true],
      [safeWebUrl(site.links.github), 'GitHub profile', 'uil-github-alt', true],
      [safeEmail(site.links.email) ? 'mailto:' + safeEmail(site.links.email) : '', 'Send an email', 'uil-envelope', false]
    ].forEach(function (item) {
      if (!item[0]) return;
      var li = el('li');
      var a = el('a', 'icon-btn icon-btn--line');
      a.href = item[0];
      if (item[3]) { a.target = '_blank'; a.rel = 'noopener'; }
      a.setAttribute('aria-label', item[1]);
      a.appendChild(icon(item[2]));
      li.appendChild(a);
      ul.appendChild(li);
    });
    return ul.children.length ? ul : null;
  }

  // The two screenshots of the newest project (its "cover"), floating beside the text.
  function stackNode(projects) {
    var P = root && root.SAZProjects;
    if (!P || !P.coverOf || !projects.length) return null;
    var project = projects[0];
    var covers = P.coverOf(project);
    if (!covers.length) return null;
    var stack = el('div', covers.length > 1 ? 'stack' : 'stack stack--one');
    covers.slice(0, 2).forEach(function (c, i) {
      var frame = P.coverFrame(c, project, i === 0 ? 'frame--a' : 'frame--b');
      frame.style.setProperty('--i', String(i));
      stack.appendChild(frame);
    });
    return stack;
  }

  function heroNode(site, projects) {
    var section = el('section', 'hero');
    section.id = 'home';
    var grid = el('div', 'container hero_grid');
    var copy = el('div', 'hero_copy');

    copy.appendChild(nameNode(site.profile.name || 'Your name'));
    copy.appendChild(el('p', 'hero_role', site.profile.role));

    var build = el('p', 'hero_build');
    if (site.profile.words.length) {
      if (site.profile.buildPrefix) build.appendChild(document.createTextNode(site.profile.buildPrefix + ' '));
      var swap = el('span', 'swap');
      site.profile.words.forEach(function (word, i) {
        var w = el('span', i === 0 ? 'swap_word is-on' : 'swap_word', word);
        if (i) w.setAttribute('aria-hidden', 'true');
        swap.appendChild(w);
      });
      build.appendChild(swap);
    } else if (site.profile.buildPrefix) {
      build.textContent = site.profile.buildPrefix;
    }
    copy.appendChild(build);
    copy.appendChild(el('p', 'hero_lead', site.profile.lead));

    var actions = el('div', 'hero_actions');
    var see = el('a', 'btn btn-primary', site.labels.seeProjects);
    see.href = '#portfolio';
    if (projects.length && sectionVisible(site, 'portfolio')) actions.appendChild(see);
    var cv = cvButton(site, 'btn btn-ghost');
    if (cv) actions.appendChild(cv);
    copy.appendChild(actions);

    var links = heroLinks(site);
    if (links) copy.appendChild(links);

    grid.appendChild(copy);
    var stack = stackNode(projects);
    if (stack) grid.appendChild(stack);
    section.appendChild(grid);
    return section;
  }

  // Fades the words in turn. (Called only on the live page, the admin preview keeps the first word.)
  function startSwap(scope) {
    var words = Array.prototype.slice.call((scope || document).querySelectorAll('.swap_word'));
    if (words.length < 2) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var current = 0;
    setInterval(function () {
      var prev = words[current];
      current = (current + 1) % words.length;
      prev.classList.remove('is-on');
      prev.classList.add('is-out');
      words[current].classList.add('is-on');
      setTimeout(function () { prev.classList.remove('is-out'); }, 800);
    }, 2500);
  }

  /*==================== TECH STRIP ====================*/
  function marqueeNode(site) {
    if (!site.marquee.length) return null;
    var wrap = el('div', 'marquee');
    wrap.setAttribute('aria-hidden', 'true');
    var track = el('div', 'marquee_track');
    for (var n = 0; n < 2; n++) {
      var ul = el('ul');
      site.marquee.forEach(function (name) { ul.appendChild(el('li', null, name)); });
      track.appendChild(ul);
    }
    wrap.appendChild(track);
    return wrap;
  }

  /*==================== SECTIONS ====================*/
  function splitSection(id, title) {
    var section = el('section', 'block');
    section.id = id;
    var box = el('div', 'container split');
    var head = el('div', 'split_head');
    head.appendChild(el('h2', 'h2', title));
    box.appendChild(head);
    section.appendChild(box);
    return { section: section, box: box };
  }

  function aboutNode(site) {
    var a = site.about;
    if (!a.paragraphs.length && !a.stats.length && !a.facts.length) return null;
    var s = splitSection('about', site.labels.about);
    var body = el('div', 'split_body prose about_grid');

    var avatar = el('div', 'avatar');
    var orbit = el('span', 'avatar_orbit');
    orbit.setAttribute('aria-hidden', 'true');
    var mono = el('span', 'avatar_mono', initials(site.profile.name));
    mono.setAttribute('aria-hidden', 'true');
    avatar.appendChild(orbit);
    avatar.appendChild(mono);
    var photo = safePhoto(a.photo);
    if (photo) {
      var img = el('img');
      img.src = photo;
      img.alt = site.profile.name;
      img.onerror = function () { img.remove(); };   // a missing picture falls back to the initials
      avatar.appendChild(img);
    }
    body.appendChild(avatar);

    a.paragraphs.forEach(function (text, i) { body.appendChild(el('p', i === 0 ? 'lead' : '', text)); });

    var stats = a.stats.filter(function (x) { return x.label; });
    if (stats.length) {
      var ul = el('ul', 'stats');
      stats.forEach(function (x) {
        var li = el('li');
        var b = el('b', 'count', x.value + x.suffix);
        b.setAttribute('data-to', String(x.value));
        if (x.suffix) b.setAttribute('data-suffix', x.suffix);
        li.appendChild(b);
        li.appendChild(el('span', null, x.label));
        ul.appendChild(li);
      });
      body.appendChild(ul);
    }

    var facts = a.facts.filter(function (x) { return x.label && x.value; });
    if (facts.length) {
      var dl = el('dl', 'facts');
      facts.forEach(function (x) {
        var row = el('div');
        row.appendChild(el('dt', null, x.label));
        row.appendChild(el('dd', null, x.value));
        dl.appendChild(row);
      });
      body.appendChild(dl);
    }

    var cv = cvButton(site, 'btn btn-primary');
    if (cv) {
      var actions = el('div', 'actions');
      actions.appendChild(cv);
      body.appendChild(actions);
    }
    s.box.appendChild(body);
    return s.section;
  }

  function skillCard(group, n) {
    var article = el('article', group.open ? 'skill is-open' : 'skill');
    var btn = el('button', 'skill_head');
    btn.type = 'button';
    btn.id = 'sk-' + n + '-btn';
    btn.setAttribute('aria-expanded', String(group.open));
    btn.setAttribute('aria-controls', 'sk-' + n);
    var ic = el('span', 'skill_icon');
    ic.appendChild(icon(safeIcon(group.icon)));
    var text = el('span', 'skill_text');
    text.appendChild(el('span', 'skill_title', group.title));
    if (group.sub) text.appendChild(el('span', 'skill_sub', group.sub));
    btn.appendChild(ic);
    btn.appendChild(text);
    btn.appendChild(icon('uil-angle-down', 'skill_arrow'));
    article.appendChild(btn);

    var panel = el('div', 'skill_panel');
    panel.id = 'sk-' + n;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', btn.id);
    var inner = el('div', 'skill_inner');
    var body = el('div', 'skill_body');
    var chips = el('ul', 'chips');
    group.items.forEach(function (name) { chips.appendChild(el('li', 'chip', name)); });
    body.appendChild(chips);
    inner.appendChild(body);
    panel.appendChild(inner);
    article.appendChild(panel);
    return article;
  }

  function skillsNode(site) {
    var groups = site.skills.filter(function (g) { return g.title; });
    if (!groups.length) return null;
    var s = splitSection('skills', site.labels.skills);
    var body = el('div', 'split_body');
    var grid = el('div', 'skills_grid');
    var half = Math.ceil(groups.length / 2);
    var cols = [el('div', 'skills_col'), el('div', 'skills_col')];
    groups.forEach(function (g, i) { cols[i < half ? 0 : 1].appendChild(skillCard(g, i)); });
    cols.forEach(function (c) { if (c.children.length) grid.appendChild(c); });
    body.appendChild(grid);
    s.box.appendChild(body);
    return s.section;
  }

  function trunkNode(items, id, tabId, hidden) {
    var ol = el('ol', 'trunk');
    ol.id = id;
    ol.setAttribute('role', 'tabpanel');
    ol.setAttribute('aria-labelledby', tabId);
    if (hidden) ol.hidden = true;
    items.forEach(function (item) {
      var li = el('li', /present|now|current/i.test(item.when) ? 'leaf leaf--now' : 'leaf');
      var node = el('span', 'leaf_node');
      node.setAttribute('aria-hidden', 'true');
      li.appendChild(node);
      var card = el('article', 'leaf_card');
      if (item.when) card.appendChild(el('p', 'leaf_when', item.when));
      card.appendChild(el('h3', 'leaf_title', item.title));
      if (item.role) card.appendChild(el('p', 'leaf_role', item.role));
      if (item.text) card.appendChild(el('p', 'leaf_text', item.text));
      li.appendChild(card);
      ol.appendChild(li);
    });
    return ol;
  }

  function experienceNode(site) {
    var work = site.experience.work.filter(function (x) { return x.title; });
    var edu = site.experience.education.filter(function (x) { return x.title; });
    if (!work.length && !edu.length) return null;
    var s = splitSection('experience', site.labels.experience);
    var body = el('div', 'split_body');

    var kinds = [];
    if (work.length) kinds.push({ key: 'work', label: site.labels.tabWork, icon: 'uil-briefcase-alt', items: work });
    if (edu.length) kinds.push({ key: 'edu', label: site.labels.tabEdu, icon: 'uil-graduation-cap', items: edu });

    if (kinds.length > 1) {
      var tabs = el('div', 'tabs');
      tabs.setAttribute('role', 'tablist');
      tabs.setAttribute('aria-label', 'Work or education');
      kinds.forEach(function (k, i) {
        var t = el('button', 'tab');
        t.type = 'button';
        t.setAttribute('role', 'tab');
        t.id = 'tab-' + k.key;
        t.setAttribute('aria-selected', String(i === 0));
        t.setAttribute('aria-controls', 'tree-' + k.key);
        if (i) t.tabIndex = -1;
        t.appendChild(icon(k.icon));
        t.appendChild(document.createTextNode(k.label));
        tabs.appendChild(t);
      });
      body.appendChild(tabs);
    }
    kinds.forEach(function (k, i) {
      var tabId = kinds.length > 1 ? 'tab-' + k.key : undefined;
      var ol = trunkNode(k.items, 'tree-' + k.key, tabId || 'tab-' + k.key, i > 0);
      if (!tabId) ol.removeAttribute('aria-labelledby');
      body.appendChild(ol);
    });
    s.box.appendChild(body);
    return s.section;
  }

  function projectsNode(site, projects) {
    if (!projects.length) return null;
    var section = el('section', 'block');
    section.id = 'portfolio';
    var box = el('div', 'container');
    var top = el('div', 'section_top');
    top.appendChild(el('h2', 'h2 section_h', site.labels.portfolio));
    if (site.projectsIntro) top.appendChild(el('p', 'section_lead', site.projectsIntro));
    box.appendChild(top);
    var slot = el('div');
    slot.id = 'feature-slot';
    box.appendChild(slot);
    box.appendChild(el('div', 'cards'));
    section.appendChild(box);
    return section;
  }

  function contactNode(site) {
    var links = site.links;
    var email = safeEmail(links.email);
    var cards = [];
    var phone = safePhone(links.phone);
    if (phone) cards.push({ href: 'tel:' + phone, icon: 'uil-phone', label: 'Phone', value: links.phoneShown || links.phone });
    var li = safeWebUrl(links.linkedin);
    if (li) cards.push({ href: li, icon: 'uil-linkedin-alt', label: 'LinkedIn', value: handleOf(li), external: true });
    var gh = safeWebUrl(links.github);
    if (gh) cards.push({ href: gh, icon: 'uil-github-alt', label: 'GitHub', value: handleOf(gh), external: true });
    if (links.location) cards.push({ icon: 'uil-map-marker', label: 'Location', value: links.location });
    if (!email && !cards.length && !site.contact.title) return null;

    var section = el('section', 'block');
    section.id = 'contact';
    var box = el('div', 'container');
    var panel = el('div', 'contact_panel');
    var main = el('div', 'contact_main');
    main.appendChild(el('h2', 'contact_title', site.contact.title || 'Say hello'));
    if (site.contact.lead) main.appendChild(el('p', 'contact_lead', site.contact.lead));
    if (email) {
      var row = el('div', 'mail_row');
      var a = el('a', 'mail', email);
      a.href = 'mailto:' + email;
      row.appendChild(a);
      var copy = el('button', 'copy');
      copy.type = 'button';
      copy.setAttribute('data-copy', email);
      copy.appendChild(icon('uil-copy'));
      copy.appendChild(el('span', null, 'Copy email'));
      row.appendChild(copy);
      main.appendChild(row);
    }
    panel.appendChild(main);

    if (cards.length) {
      var ul = el('ul', 'contact_cards');
      cards.forEach(function (c) {
        var item = el('li');
        var card = el(c.href ? 'a' : 'div', 'ccard');
        if (c.href) {
          card.href = c.href;
          if (c.external) { card.target = '_blank'; card.rel = 'noopener'; }
        }
        var ic = el('span', 'ccard_icon');
        ic.setAttribute('aria-hidden', 'true');
        ic.appendChild(icon(c.icon));
        var text = el('span', 'ccard_text');
        text.appendChild(el('span', 'ccard_label', c.label));
        text.appendChild(el('span', 'ccard_value', c.value));
        card.appendChild(ic);
        card.appendChild(text);
        item.appendChild(card);
        ul.appendChild(item);
      });
      panel.appendChild(ul);
    }
    box.appendChild(panel);
    section.appendChild(box);
    return section;
  }

  /*==================== WHOLE HOME PAGE ====================*/
  // Returns a fragment: hero, tech strip, then the sections in the order (and visibility) set in site.json.
  function buildHome(site, projects) {
    site = normalize(site);
    projects = projects || [];
    var out = document.createDocumentFragment();
    out.appendChild(heroNode(site, projects));
    var strip = marqueeNode(site);
    if (strip) out.appendChild(strip);
    var builders = {
      about: function () { return aboutNode(site); },
      skills: function () { return skillsNode(site); },
      experience: function () { return experienceNode(site); },
      portfolio: function () { return projectsNode(site, projects); },
      contact: function () { return contactNode(site); }
    };
    site.sections.forEach(function (s) {
      if (!s.show) return;
      var node = builders[s.id]();
      if (node) out.appendChild(node);
    });
    return out;
  }

  /*==================== FOOTER ====================*/
  function footerNode(site, projects, onHome) {
    site = normalize(site);
    var prefix = onHome ? '' : 'index.html';
    var out = document.createDocumentFragment();
    var grid = el('div', 'container footer_grid');

    var brand = el('div', 'footer_brand');
    var nameLink = el('a', 'footer_name', site.profile.name || 'Portfolio');
    nameLink.href = onHome ? '#home' : 'index.html';
    brand.appendChild(nameLink);
    if (site.profile.footerText) brand.appendChild(el('p', 'footer_role', site.profile.footerText));
    var social = el('ul', 'footer_social');
    [
      [safeWebUrl(site.links.linkedin), 'LinkedIn profile', 'uil-linkedin-alt', true],
      [safeWebUrl(site.links.github), 'GitHub profile', 'uil-github-alt', true],
      [safeEmail(site.links.email) ? 'mailto:' + safeEmail(site.links.email) : '', 'Send an email', 'uil-envelope', false]
    ].forEach(function (item) {
      if (!item[0]) return;
      var li = el('li');
      var a = el('a');
      a.href = item[0];
      if (item[3]) { a.target = '_blank'; a.rel = 'noopener'; }
      a.setAttribute('aria-label', item[1]);
      a.appendChild(icon(item[2]));
      li.appendChild(a);
      social.appendChild(li);
    });
    if (social.children.length) brand.appendChild(social);
    grid.appendChild(brand);

    var explore = el('nav', 'footer_col');
    explore.setAttribute('aria-label', 'Sections of the home page');
    explore.appendChild(el('p', 'footer_head', 'Explore'));
    var exploreList = el('ul');
    navItems(site, projects.length > 0).slice(1).forEach(function (item) {
      var li = el('li');
      var a = el('a', null, item.label);
      a.href = prefix + '#' + item.id;
      li.appendChild(a);
      exploreList.appendChild(li);
    });
    explore.appendChild(exploreList);
    grid.appendChild(explore);

    if (projects.length) {
      var pnav = el('nav', 'footer_col');
      pnav.setAttribute('aria-label', 'Project pages');
      pnav.appendChild(el('p', 'footer_head', site.labels.portfolio));
      var plist = el('ul');
      projects.forEach(function (project) {
        var li = el('li');
        var a = el('a', null, project.title);
        a.href = 'project.html?id=' + encodeURIComponent(project.id);
        li.appendChild(a);
        plist.appendChild(li);
      });
      pnav.appendChild(plist);
      grid.appendChild(pnav);
    }

    var touch = el('div', 'footer_col');
    touch.appendChild(el('p', 'footer_head', 'Get in touch'));
    var tl = el('ul');
    var email = safeEmail(site.links.email);
    if (email) { var le = el('li'); var ae = el('a', null, email); ae.href = 'mailto:' + email; le.appendChild(ae); tl.appendChild(le); }
    var phone = safePhone(site.links.phone);
    if (phone) { var lp = el('li'); var ap = el('a', null, site.links.phoneShown || site.links.phone); ap.href = 'tel:' + phone; lp.appendChild(ap); tl.appendChild(lp); }
    var cv = safeCv(site.profile.cv);
    if (cv) {
      var lc = el('li');
      var ac = el('a', null, site.labels.downloadCv);
      ac.href = cv;
      ac.setAttribute('download', (site.profile.name || 'CV').replace(/\s+/g, '-') + '-CV.pdf');
      lc.appendChild(ac);
      tl.appendChild(lc);
    }
    touch.appendChild(tl);
    grid.appendChild(touch);
    out.appendChild(grid);

    var bar = el('div', 'container footer_bar');
    bar.appendChild(el('p', null, '© ' + new Date().getFullYear() + ' ' + site.profile.name + '. All rights reserved.'));
    if (site.labels.footerNote) bar.appendChild(el('p', null, site.labels.footerNote));
    out.appendChild(bar);
    return out;
  }

  // Page title and description (browser tab, and search engines that run scripts).
  function applyMeta(site) {
    var title = site.meta.title || (site.profile.name + (site.profile.role ? ' | ' + site.profile.role : ''));
    if (title.trim()) document.title = title;
    [['meta[name="description"]', site.meta.description], ['meta[property="og:title"]', title], ['meta[property="og:description"]', site.meta.description]].forEach(function (pair) {
      var node = document.querySelector(pair[0]);
      if (node && pair[1]) node.setAttribute('content', pair[1]);
    });
  }

  /*==================== LOADING ====================*/
  function load() {
    return fetch(DATA_URL, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('site.json ' + res.status);
      return res.json();
    }).then(normalize);
  }

  var api = {
    normalize: normalize, buildHome: buildHome, footerNode: footerNode, navItems: navItems,
    load: load, startSwap: startSwap, safePhoto: safePhoto, safeCv: safeCv, safeEmail: safeEmail,
    safeWebUrl: safeWebUrl, SECTION_INFO: SECTION_INFO
  };

  /*==================== PAGE START (index.html and project.html only) ====================*/
  if (root && typeof document !== 'undefined') {
    var main = document.getElementById('main');
    var homeMode = !!(main && main.hasAttribute('data-home'));
    var footerHost = document.getElementById('site-footer');

    var loadMainScript = function () {
      var s = document.createElement('script');
      s.src = 'assets/js/main.js';
      document.body.appendChild(s);
    };

    if (homeMode || footerHost) {
      var P = root.SAZProjects;
      var projectsPromise = (P ? P.load() : Promise.resolve([])).catch(function () { return []; });
      Promise.all([load(), projectsPromise]).then(function (results) {
        var site = results[0], projects = results[1];
        if (footerHost) footerHost.appendChild(footerNode(site, projects, homeMode));
        if (homeMode) {
          mountNav(site, projects.length > 0);
          main.textContent = '';
          main.appendChild(buildHome(site, projects));
          if (P && P.mountHome) P.mountHome(projects);
          applyMeta(site);
          startSwap(main);
          loadMainScript();
        }
      }, function () {
        if (homeMode) {
          main.textContent = '';
          var box = el('div', 'container');
          box.style.padding = '8rem 0 6rem';
          box.appendChild(el('h1', 'page_title', 'The page could not be loaded'));
          box.appendChild(el('p', 'section_lead', 'Please refresh. If it keeps happening, check your connection.'));
          main.appendChild(box);
          loadMainScript();
        }
      });
    }
  }

  return api;
});
