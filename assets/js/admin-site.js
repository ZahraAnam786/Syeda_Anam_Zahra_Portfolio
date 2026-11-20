/* admin.html, "Site content" tab: edit everything on the home page except the projects.
   Name, rotating words, links, photo, CV, About, Skills, Experience, Contact, the tech strip and the
   order of the sections. Every list has arrows to swap items, plus Add and Remove.
   Save writes data/site.json (and a new photo or CV file) to the repository as one commit.
   Uses window.SAZAdmin (admin.js) for the GitHub connection and SAZSite (site.js) for the preview. */
(function () {
  'use strict';

  var A = window.SAZAdmin;
  var S = window.SAZSite;
  if (!A || !S) return;

  var SITE_PATH = 'data/site.json';
  var PHOTO_DIR = 'assets/img/site/';
  var CV_PREFIX = 'assets/pdf/CV-';
  var PHOTO_SIZE = 720;
  var MAX_CV_BYTES = 4 * 1024 * 1024;
  var ICONS = [
    ['uil-brackets-curly', 'Code brackets'], ['uil-server-network', 'Server'], ['uil-database', 'Database'],
    ['uil-cloud', 'Cloud'], ['uil-processor', 'Chip (AI)'], ['uil-wrench', 'Wrench (tools)'],
    ['uil-desktop', 'Desktop'], ['uil-mobile-android', 'Mobile'], ['uil-palette', 'Design'],
    ['uil-chart-bar', 'Chart'], ['uil-shield-check', 'Security'], ['uil-rocket', 'Rocket'],
    ['uil-layers', 'Layers'], ['uil-bolt', 'Lightning'], ['uil-code-branch', 'Git branch'],
    ['uil-analytics', 'Analytics'], ['uil-android', 'Android'], ['uil-react', 'React']
  ];

  var site = null;          // the data being edited (see site.js)
  var pending = { photo: null, photoUrl: '', cv: null, cvUrl: '', cvName: '' };

  var el = A.el;
  function $(id) { return document.getElementById(id); }

  /*==================== TABS ====================*/
  var tabButtons = [$('atab-projects'), $('atab-site')];
  function selectTab(button) {
    tabButtons.forEach(function (b) {
      var on = b === button;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      $(b.getAttribute('aria-controls')).hidden = !on;
    });
  }
  tabButtons.forEach(function (b, i) {
    b.addEventListener('click', function () { selectTab(b); });
    b.addEventListener('keydown', function (event) {
      var next = null;
      if (event.key === 'ArrowRight') next = tabButtons[(i + 1) % tabButtons.length];
      if (event.key === 'ArrowLeft') next = tabButtons[(i - 1 + tabButtons.length) % tabButtons.length];
      if (next) { event.preventDefault(); next.focus(); selectTab(next); }
    });
  });

  /*==================== FORM PIECES ====================*/
  function field(labelText, hint, control) {
    var wrap = el('label', 'field');
    if (labelText) wrap.appendChild(el('span', 'field_label', labelText));
    if (hint) wrap.appendChild(el('span', 'field_hint', hint));
    wrap.appendChild(control);
    return wrap;
  }

  // A text box bound to obj[key].
  function bound(obj, key, opts) {
    opts = opts || {};
    var input = el(opts.rows ? 'textarea' : 'input');
    if (opts.rows) input.rows = opts.rows; else input.type = opts.type || 'text';
    if (opts.placeholder) input.placeholder = opts.placeholder;
    if (opts.max) input.maxLength = opts.max;
    input.value = obj[key] === undefined || obj[key] === null ? '' : obj[key];
    input.addEventListener('input', function () { obj[key] = input.value; });
    if (opts.label) input.setAttribute('aria-label', opts.label);
    return input;
  }

  function labeled(obj, key, label, opts) {
    opts = opts || {};
    return field(label, opts.hint, bound(obj, key, opts));
  }

  function mini(row, text, label, disabled, fn) {
    var b = el('button', 'mini', text);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.disabled = disabled;
    b.addEventListener('click', fn);
    row.appendChild(b);
  }

  function panel(title, hint, open) {
    var d = el('details', 'panel site_panel');
    if (open) d.open = true;
    d.appendChild(el('summary', 'panel_title', title));
    if (hint) d.appendChild(el('p', 'muted', hint));
    var body = el('div', 'aform');
    d.appendChild(body);
    return { node: d, body: body };
  }

  /* A list the person can add to, remove from and reorder.
     opts: items (array, edited in place), make() -> new item, row(item, i) -> node, noun, min */
  function listEditor(opts) {
    var host = el('div', 'lst');
    function draw() {
      host.textContent = '';
      opts.items.forEach(function (item, i) {
        var box = el('div', 'lst_item');
        var head = el('div', 'sec_head');
        head.appendChild(el('strong', null, (opts.noun || 'Item') + ' ' + (i + 1)));
        var tools = el('span', 'shot_row');
        mini(tools, 'Up', 'Move ' + (opts.noun || 'item') + ' ' + (i + 1) + ' up', i === 0, function () { A.move(opts.items, i, -1); draw(); });
        mini(tools, 'Down', 'Move ' + (opts.noun || 'item') + ' ' + (i + 1) + ' down', i === opts.items.length - 1, function () { A.move(opts.items, i, 1); draw(); });
        mini(tools, 'Remove', 'Remove ' + (opts.noun || 'item') + ' ' + (i + 1), false, function () { opts.items.splice(i, 1); draw(); });
        head.appendChild(tools);
        box.appendChild(head);
        box.appendChild(opts.row(opts.items[i], i));
        host.appendChild(box);
      });
      var add = el('div');
      var b = el('button', 'btn btn-ghost btn--sm');
      b.type = 'button';
      b.appendChild(el('i', 'uil uil-plus'));
      b.appendChild(document.createTextNode('Add ' + (opts.noun || 'item').toLowerCase()));
      b.addEventListener('click', function () { opts.items.push(opts.make()); draw(); });
      add.appendChild(b);
      host.appendChild(add);
    }
    draw();
    return host;
  }

  /* A list of plain words (rotating words, tech strip): one box per word, with arrows. */
  function wordList(items, noun, placeholder) {
    var host = el('div', 'lst');
    function draw() {
      host.textContent = '';
      items.forEach(function (word, i) {
        var row = el('div', 'lrow');
        var input = el('input');
        input.type = 'text';
        input.value = word;
        input.maxLength = 60;
        input.placeholder = placeholder || '';
        input.setAttribute('aria-label', noun + ' ' + (i + 1));
        input.addEventListener('input', function () { items[i] = input.value; });
        row.appendChild(input);
        var tools = el('span', 'shot_row');
        mini(tools, '↑', 'Move ' + noun + ' ' + (i + 1) + ' up', i === 0, function () { A.move(items, i, -1); draw(); });
        mini(tools, '↓', 'Move ' + noun + ' ' + (i + 1) + ' down', i === items.length - 1, function () { A.move(items, i, 1); draw(); });
        mini(tools, '✕', 'Remove ' + noun + ' ' + (i + 1), false, function () { items.splice(i, 1); draw(); });
        row.appendChild(tools);
        host.appendChild(row);
      });
      var add = el('div');
      var b = el('button', 'btn btn-ghost btn--sm');
      b.type = 'button';
      b.appendChild(el('i', 'uil uil-plus'));
      b.appendChild(document.createTextNode('Add ' + noun));
      b.addEventListener('click', function () { items.push(''); draw(); var inputs = host.querySelectorAll('input'); if (inputs.length) inputs[inputs.length - 1].focus(); });
      add.appendChild(b);
      host.appendChild(add);
    }
    draw();
    return host;
  }

  /*==================== PICTURES AND FILES ====================*/
  // Cuts the middle square out of a picked photo and saves it as a JPEG.
  function squarePhoto(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var side = Math.min(img.naturalWidth, img.naturalHeight);
        var size = Math.min(PHOTO_SIZE, side);
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
        canvas.toBlob(function (blob) {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob); else reject(new Error('Could not convert the photo.'));
        }, 'image/jpeg', 0.88);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error(file.name + ' is not an image the browser can open.')); };
      img.src = url;
    });
  }

  function dropPending(kind) {
    if (kind === 'photo' && pending.photoUrl) URL.revokeObjectURL(pending.photoUrl);
    if (kind === 'cv' && pending.cvUrl) URL.revokeObjectURL(pending.cvUrl);
    if (kind === 'photo') { pending.photo = null; pending.photoUrl = ''; }
    if (kind === 'cv') { pending.cv = null; pending.cvUrl = ''; pending.cvName = ''; }
  }

  function photoField() {
    var wrap = el('div', 'field');
    wrap.appendChild(el('span', 'field_label', 'Your photo'));
    wrap.appendChild(el('span', 'field_hint', 'Shown in a circle in the About section. A square-ish picture of your face works best. Without a photo your initials are shown.'));
    var row = el('div', 'photo_row');
    var show = pending.photoUrl || S.safePhoto(site.about.photo);
    if (show) {
      var img = el('img', 'photo_thumb');
      img.src = show;
      img.alt = 'Current photo';
      row.appendChild(img);
    }
    var side = el('div', 'shot_side');
    var file = el('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.setAttribute('aria-label', 'Choose a photo');
    file.addEventListener('change', function () {
      var f = file.files[0];
      if (!f) return;
      squarePhoto(f).then(function (blob) {
        dropPending('photo');
        pending.photo = blob;
        pending.photoUrl = URL.createObjectURL(blob);
        drawEditor();
      }, function (err) { A.setStatus(err.message, 'error'); });
    });
    side.appendChild(file);
    if (show) {
      var r = el('div', 'shot_row');
      mini(r, 'Remove photo', 'Remove the photo', false, function () { dropPending('photo'); site.about.photo = ''; drawEditor(); });
      side.appendChild(r);
    }
    row.appendChild(side);
    wrap.appendChild(row);
    return wrap;
  }

  function cvField() {
    var wrap = el('div', 'field');
    wrap.appendChild(el('span', 'field_label', 'CV (PDF)'));
    var current = pending.cvName ? 'New file ready: ' + pending.cvName + ' (it is uploaded when you save).' :
      (site.profile.cv ? 'Current CV: ' + site.profile.cv : 'No CV yet. The Download CV buttons are hidden until you add one.');
    wrap.appendChild(el('span', 'field_hint', current + ' Choose a PDF up to 4 MB to replace it.'));
    var file = el('input');
    file.type = 'file';
    file.accept = 'application/pdf,.pdf';
    file.setAttribute('aria-label', 'Choose a CV PDF');
    file.addEventListener('change', function () {
      var f = file.files[0];
      if (!f) return;
      if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { A.setStatus('The CV must be a PDF file.', 'error'); file.value = ''; return; }
      if (f.size > MAX_CV_BYTES) { A.setStatus('That PDF is bigger than 4 MB. Please use a smaller file.', 'error'); file.value = ''; return; }
      dropPending('cv');
      pending.cv = f;
      pending.cvUrl = URL.createObjectURL(f);
      pending.cvName = f.name;
      drawEditor();
    });
    wrap.appendChild(file);
    if (site.profile.cv || pending.cv) {
      var r = el('div', 'shot_row');
      mini(r, 'Remove CV', 'Remove the CV', false, function () { dropPending('cv'); site.profile.cv = ''; drawEditor(); });
      wrap.appendChild(r);
    }
    return wrap;
  }

  /*==================== THE EDITOR ====================*/
  var SECTION_NAMES = { about: 'About', skills: 'Skills', experience: 'Experience', portfolio: 'Projects', contact: 'Contact' };

  function experienceRow(item) {
    var box = el('div', 'aform');
    var grid = el('div', 'grid2');
    grid.appendChild(labeled(item, 'title', 'Company or school *', { placeholder: 'for example Pace Tech' }));
    grid.appendChild(labeled(item, 'role', 'Role or degree', { placeholder: 'for example ASP.NET Core Developer' }));
    grid.appendChild(labeled(item, 'when', 'When', { placeholder: 'Jun 2023 – Jul 2025', hint: 'Writing "Present" in it marks the item as current.' }));
    box.appendChild(grid);
    box.appendChild(labeled(item, 'text', 'Extra line (optional)', { rows: 2 }));
    return box;
  }

  function skillRow(group) {
    var box = el('div', 'aform');
    var grid = el('div', 'grid2');
    grid.appendChild(labeled(group, 'title', 'Group title *', { placeholder: 'for example Backend developer' }));
    grid.appendChild(labeled(group, 'sub', 'Small line under the title', { placeholder: 'ASP.NET Core, C#, Web API' }));
    box.appendChild(grid);

    var select = el('select');
    var known = false;
    ICONS.forEach(function (i) {
      var o = el('option', null, i[1]);
      o.value = i[0];
      if (i[0] === group.icon) known = true;
      select.appendChild(o);
    });
    if (!known) {
      if (!group.icon) group.icon = ICONS[0][0];
      else { var o = el('option', null, 'Current icon (' + group.icon + ')'); o.value = group.icon; select.appendChild(o); }
    }
    select.value = group.icon;
    select.addEventListener('change', function () { group.icon = select.value; });
    var g2 = el('div', 'grid2');
    g2.appendChild(field('Icon', '', select));

    var openWrap = el('label', 'check');
    var openBox = el('input');
    openBox.type = 'checkbox';
    openBox.checked = group.open;
    openBox.addEventListener('change', function () { group.open = openBox.checked; });
    openWrap.appendChild(openBox);
    openWrap.appendChild(document.createTextNode(' Open by default on the page'));
    g2.appendChild(openWrap);
    box.appendChild(g2);

    // The skills are edited as one comma separated line, like the technologies of a project.
    var items = el('textarea');
    items.rows = 3;
    items.value = group.items.join(', ');
    items.addEventListener('input', function () {
      group.items = items.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
    });
    box.appendChild(field('Skills', 'Separate with commas, like Angular, React, TypeScript. They show as small tags.', items));
    return box;
  }

  function drawEditor() {
    var host = $('site-editor');
    var scroll = window.scrollY;
    host.textContent = '';
    var p = site.profile, l = site.links;

    // 1. Name and hero
    var hero = panel('Name and top of the page', 'The first thing visitors see.', true);
    var g = el('div', 'grid2');
    g.appendChild(labeled(p, 'name', 'Your name *', { max: 60 }));
    g.appendChild(labeled(p, 'role', 'Line under the name', { max: 80, placeholder: 'Full-stack developer in Lahore' }));
    hero.body.appendChild(g);
    hero.body.appendChild(labeled(p, 'buildPrefix', 'Words before the rotating words', { max: 30, placeholder: 'I build', hint: 'The page shows: "I build" then each word below, one after the other.' }));
    hero.body.appendChild(field('Rotating words', 'They fade in one by one. Use the arrows to change their order. Leave empty to turn this off.', wordList(site.profile.words, 'word', 'for example web apps')));
    hero.body.appendChild(labeled(p, 'lead', 'Short introduction', { rows: 3, hint: 'Two or three sentences under the rotating words.' }));
    hero.body.appendChild(cvField());
    host.appendChild(hero.node);

    // 2. Links and contact details
    var contact = panel('Contact details and links', 'Used in the top of the page, the Contact section and the footer. Leave a box empty to hide it.');
    var cg = el('div', 'grid2');
    cg.appendChild(labeled(l, 'email', 'Email', { type: 'email', placeholder: 'name@example.com' }));
    cg.appendChild(labeled(l, 'location', 'Location', { placeholder: 'Lahore, Pakistan' }));
    cg.appendChild(labeled(l, 'phone', 'Phone (for the call link)', { placeholder: '+923101495507', hint: 'With the country code, no spaces.' }));
    cg.appendChild(labeled(l, 'phoneShown', 'Phone (as people read it)', { placeholder: '0310-1495507' }));
    cg.appendChild(labeled(l, 'linkedin', 'LinkedIn link', { type: 'url', placeholder: 'https://www.linkedin.com/in/...' }));
    cg.appendChild(labeled(l, 'github', 'GitHub link', { type: 'url', placeholder: 'https://github.com/...' }));
    contact.body.appendChild(cg);
    var cg2 = el('div', 'grid2');
    cg2.appendChild(labeled(site.contact, 'title', 'Contact heading', { max: 40, placeholder: 'Say hello' }));
    cg2.appendChild(labeled(site.contact, 'lead', 'Contact text', { rows: 2 }));
    contact.body.appendChild(cg2);
    host.appendChild(contact.node);

    // 3. About
    var about = panel('About', 'The text, photo, numbers and quick facts of the About section.');
    about.body.appendChild(photoField());
    about.body.appendChild(field('Paragraphs', 'The first paragraph is shown bigger. Use the arrows to swap them.', listEditor({
      items: site.about.paragraphs, noun: 'Paragraph', make: function () { return ''; },
      row: function (item, i) {
        var box = bound(site.about.paragraphs, i, { rows: 4, label: 'Paragraph ' + (i + 1) });
        return box;
      }
    })));
    about.body.appendChild(field('Numbers', 'Big counting numbers, like 3+ years of experience.', listEditor({
      items: site.about.stats, noun: 'Number', make: function () { return { value: 0, suffix: '', label: '' }; },
      row: function (item) {
        var grid = el('div', 'grid3');
        grid.appendChild(labeled(item, 'value', 'Number', { type: 'number' }));
        grid.appendChild(labeled(item, 'suffix', 'After the number', { placeholder: '+', max: 3 }));
        grid.appendChild(labeled(item, 'label', 'Label', { placeholder: 'years of experience' }));
        return grid;
      }
    })));
    about.body.appendChild(field('Quick facts', 'Small table: Based in, Languages, How I work...', listEditor({
      items: site.about.facts, noun: 'Fact', make: function () { return { label: '', value: '' }; },
      row: function (item) {
        var grid = el('div', 'grid2');
        grid.appendChild(labeled(item, 'label', 'Label', { placeholder: 'Based in' }));
        grid.appendChild(labeled(item, 'value', 'Value', { placeholder: 'Lahore, Pakistan' }));
        return grid;
      }
    })));
    host.appendChild(about.node);

    // 4. Skills
    var skills = panel('Skills', 'Each group is a card on the page. The first half of the groups goes in the left column, the rest in the right column.');
    skills.body.appendChild(listEditor({
      items: site.skills, noun: 'Skill group', make: function () { return { icon: ICONS[0][0], title: '', sub: '', open: true, items: [] }; },
      row: skillRow
    }));
    host.appendChild(skills.node);

    // 5. Experience and education
    var exp = panel('Experience and education', 'The timeline. Newest first looks best. If one of the lists is empty its tab is hidden.');
    exp.body.appendChild(el('h3', 'sample_h', 'Work'));
    exp.body.appendChild(listEditor({
      items: site.experience.work, noun: 'Job', make: function () { return { when: '', title: '', role: '', text: '' }; }, row: experienceRow
    }));
    exp.body.appendChild(el('h3', 'sample_h', 'Education'));
    exp.body.appendChild(listEditor({
      items: site.experience.education, noun: 'School or course', make: function () { return { when: '', title: '', role: '', text: '' }; }, row: experienceRow
    }));
    host.appendChild(exp.node);

    // 6. Tech strip and projects text
    var strip = panel('Tech strip and Projects text', 'The scrolling list of technologies under the top of the page, and the sentence above your projects. (Add or edit the projects themselves in the Projects tab.)');
    strip.body.appendChild(field('Scrolling technologies', 'Use the arrows to change the order. Leave empty to hide the strip.', wordList(site.marquee, 'technology', 'for example React')));
    strip.body.appendChild(labeled(site, 'projectsIntro', 'Sentence above the projects', { rows: 2 }));
    host.appendChild(strip.node);

    // 7. Headings, buttons and page title
    var words = panel('Headings, buttons and page title', 'The small texts of the page. Change them to another language or wording. An empty box goes back to the default.');
    var lb = site.labels;
    var wg = el('div', 'grid2');
    wg.appendChild(labeled(lb, 'about', 'About heading (and menu)', { max: 30 }));
    wg.appendChild(labeled(lb, 'skills', 'Skills heading (and menu)', { max: 30 }));
    wg.appendChild(labeled(lb, 'experience', 'Experience heading (and menu)', { max: 30 }));
    wg.appendChild(labeled(lb, 'portfolio', 'Projects heading (and menu)', { max: 30 }));
    wg.appendChild(labeled(lb, 'contact', 'Contact (menu only)', { max: 30, hint: 'The big heading of the Contact section is "Contact heading" above.' }));
    wg.appendChild(labeled(lb, 'tabWork', 'Work tab', { max: 30 }));
    wg.appendChild(labeled(lb, 'tabEdu', 'Education tab', { max: 30 }));
    wg.appendChild(labeled(lb, 'seeProjects', 'Button to the projects', { max: 40 }));
    wg.appendChild(labeled(lb, 'downloadCv', 'Download CV button', { max: 40 }));
    words.body.appendChild(wg);
    words.body.appendChild(labeled(lb, 'footerNote', 'Last line of the footer', { max: 120, hint: 'Next to the copyright line. Empty goes back to the default text.' }));
    words.body.appendChild(labeled(site.meta, 'title', 'Page title (browser tab)', { max: 100, placeholder: 'Syeda Anam Zahra | Full-Stack Developer' }));
    words.body.appendChild(labeled(site.meta, 'description', 'Page description (for search engines)', { rows: 3, max: 300, hint: 'Shown in Google results. Search engines that do not run scripts still read the older text in index.html.' }));
    words.body.appendChild(labeled(p, 'footerText', 'Footer: about me line', { rows: 2 }));
    host.appendChild(words.node);

    // 8. Order of the sections
    var order = panel('Order of the sections', 'Swap the order of the sections on the home page (the menu and footer follow). Untick to hide a section.');
    var ol = el('div', 'lst');
    site.sections.forEach(function (s, i) {
      var row = el('div', 'lrow');
      var lab = el('label', 'check');
      var box = el('input');
      box.type = 'checkbox';
      box.checked = s.show;
      box.addEventListener('change', function () { s.show = box.checked; });
      lab.appendChild(box);
      lab.appendChild(document.createTextNode(' ' + SECTION_NAMES[s.id]));
      row.appendChild(lab);
      var tools = el('span', 'shot_row');
      mini(tools, '↑', 'Move ' + SECTION_NAMES[s.id] + ' up', i === 0, function () { A.move(site.sections, i, -1); drawEditor(); });
      mini(tools, '↓', 'Move ' + SECTION_NAMES[s.id] + ' down', i === site.sections.length - 1, function () { A.move(site.sections, i, 1); drawEditor(); });
      row.appendChild(tools);
      ol.appendChild(row);
    });
    order.body.appendChild(ol);
    host.appendChild(order.node);

    window.scrollTo(0, scroll);
  }

  /*==================== GUIDE TABLE ====================*/
  function brief(text, max) {
    text = String(text || '').replace(/\s+/g, ' ').trim();
    max = max || 90;
    return text.length > max ? text.slice(0, max) + '...' : text;
  }

  function listBrief(items, pick) {
    if (!items.length) return 'none';
    var names = items.slice(0, 3).map(pick).filter(Boolean).join(', ');
    return items.length + ': ' + brief(names, 70) + (items.length > 3 ? ', ...' : '');
  }

  // "On the site now" always shows the saved version, not what is half typed in the form.
  function renderGuide(saved) {
    var cvNow = saved.profile.cv ? saved.profile.cv.replace(/^assets\/(pdf|img)\//, '') : 'none (buttons hidden)';
    var rows = [
      ['Your name', 'Your full name.', 'Syeda Anam Zahra', 'Big handwritten name at the top, the menu logo and the footer', saved.profile.name],
      ['Line under the name', 'Your job and city.', 'Full-stack developer in Lahore', 'Under the name', saved.profile.role],
      ['Words before the rotating words', 'A few words that lead into the list below.', 'I build', 'Before the rotating word', saved.profile.buildPrefix],
      ['Rotating words', 'Short phrases, one per box. Swap with the arrows.', 'web apps, REST APIs, AI agents', 'Fade in one after another, after "I build"', listBrief(saved.profile.words, function (w) { return w; })],
      ['Short introduction', 'Two or three sentences about what you do.', 'I have 3+ years of experience with ASP.NET Core...', 'Paragraph under the rotating words', brief(saved.profile.lead)],
      ['CV (PDF)', 'A PDF up to 4 MB.', 'My-CV.pdf', 'Download CV buttons (top, About, footer)', cvNow],
      ['Email', 'Your email address. Empty = hidden.', 'name@example.com', 'Icon at the top, Contact section (with a Copy button), footer', saved.links.email || 'none'],
      ['Phone (for the call link)', 'With the country code, no spaces.', '+923101495507', 'The tap-to-call link', saved.links.phone || 'none'],
      ['Phone (as people read it)', 'How the number looks on the page.', '0310-1495507', 'Contact card and footer', saved.links.phoneShown || 'none'],
      ['LinkedIn and GitHub links', 'The full link starting with https://', 'https://github.com/your-name', 'Icons at the top and in the footer, cards in Contact', brief((saved.links.linkedin || 'no LinkedIn') + ' | ' + (saved.links.github || 'no GitHub'), 110)],
      ['Location', 'City and country.', 'Lahore, Pakistan', 'Location card in Contact', saved.links.location || 'none'],
      ['Contact heading and text', 'A short heading and one sentence.', 'Say hello / Have a project in mind? Send me an email.', 'Violet panel at the bottom', brief(saved.contact.title + ' / ' + saved.contact.lead)],
      ['Photo', 'A picture of your face (it is cut to a square).', 'photo.jpg', 'Circle in the About section. Empty = your initials', saved.about.photo ? saved.about.photo.replace('assets/img/', '') : 'none (initials shown)'],
      ['About paragraphs', 'One box per paragraph. The first one is bigger.', 'I use ASP.NET Core on the backend...', 'About section text', listBrief(saved.about.paragraphs, function (t) { return brief(t, 25); })],
      ['Numbers', 'A number, a sign after it, and a label.', '30  +  projects built', 'Big counting numbers in About', listBrief(saved.about.stats, function (x) { return x.value + x.suffix + ' ' + x.label; })],
      ['Quick facts', 'Label and value.', 'Based in: Lahore, Pakistan', 'Small table in About', listBrief(saved.about.facts, function (x) { return x.label; })],
      ['Skill group', 'Title, small line, icon, and skills separated by commas.', 'Backend developer: ASP.NET Core, C#, Web API', 'A card in Skills (click to open)', listBrief(saved.skills, function (g) { return g.title; })],
      ['Work and education', 'Company or school, role or degree, dates, optional extra line.', 'Pace Tech / ASP.NET Core Developer / Oct 2025 - Mar 2026', 'The timeline in Experience. "Present" in the dates marks it as current', 'Work ' + saved.experience.work.length + ', Education ' + saved.experience.education.length],
      ['Scrolling technologies', 'One technology per box.', 'React', 'Moving strip under the top of the page', listBrief(saved.marquee, function (w) { return w; })],
      ['Sentence above the projects', 'One sentence.', 'From a chat app to a team of AI agents.', 'Under the Projects heading', brief(saved.projectsIntro)],
      ['Headings, buttons, page title', 'Change the small texts or use another language.', 'Projects, See my projects, Download CV', 'Section headings, menu, buttons, browser tab', brief(saved.labels.portfolio + ', ' + saved.labels.seeProjects + ', ' + saved.labels.downloadCv + ' | tab: ' + (saved.meta.title || 'default'), 100)],
      ['Order of the sections', 'Move up or down, or untick to hide.', 'Skills before About', 'The order of the home page, the menu and the footer', saved.sections.map(function (x) { return x.show ? saved.labels[x.id] : saved.labels[x.id] + ' (hidden)'; }).join(' > ')]
    ];
    var body = $('site-sample-rows');
    body.textContent = '';
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      row.forEach(function (cell, i) {
        var td = document.createElement('td');
        td.textContent = cell === undefined || cell === '' ? (i === 4 ? 'empty' : '') : cell;
        if (i === 4) td.className = 'now_cell';
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    $('site-sample').hidden = false;
  }

  /*==================== READ THE FORM ====================*/
  function clean(text) { return String(text === undefined || text === null ? '' : text).trim(); }

  // Returns the object to save. Throws an Error with a plain message when something is wrong.
  // forPreview keeps the temporary picture and CV links so the preview can show them.
  function collect(forPreview) {
    var out = S.normalize(JSON.parse(JSON.stringify(site)));
    var uploads = [];

    if (!clean(out.profile.name)) throw new Error('Please write your name.');
    out.profile.name = clean(out.profile.name);
    ['role', 'buildPrefix', 'lead', 'footerText'].forEach(function (k) { out.profile[k] = clean(out.profile[k]); });

    var l = out.links;
    Object.keys(l).forEach(function (k) { l[k] = clean(l[k]); });
    if (l.email && !S.safeEmail(l.email)) throw new Error('The email does not look right.');
    if (l.linkedin && !S.safeWebUrl(l.linkedin)) throw new Error('The LinkedIn link must start with http:// or https://');
    if (l.github && !S.safeWebUrl(l.github)) throw new Error('The GitHub link must start with http:// or https://');
    if (l.phone && !/^[+\d][\d\s()-]{4,}$/.test(l.phone)) throw new Error('The phone number may only have digits, +, spaces, brackets and dashes.');
    if (l.phone) l.phone = l.phone.replace(/[^\d+]/g, '');

    out.profile.words = out.profile.words.map(clean).filter(Boolean);
    out.marquee = out.marquee.map(clean).filter(Boolean);
    out.about.paragraphs = out.about.paragraphs.map(clean).filter(Boolean);
    out.about.stats = out.about.stats.filter(function (x) { return clean(x.label); }).map(function (x) {
      return { value: Math.max(0, Math.min(99999, parseInt(x.value, 10) || 0)), suffix: clean(x.suffix), label: clean(x.label) };
    });
    out.about.facts = out.about.facts.map(function (x) { return { label: clean(x.label), value: clean(x.value) }; })
      .filter(function (x) { return x.label && x.value; });

    out.skills = out.skills.map(function (g) {
      return { icon: g.icon, title: clean(g.title), sub: clean(g.sub), open: !!g.open, items: g.items.map(clean).filter(Boolean) };
    }).filter(function (g) {
      if (!g.title && g.items.length) throw new Error('A skill group has skills but no title. Please give it a title or remove it.');
      return g.title;
    });

    ['work', 'education'].forEach(function (kind) {
      out.experience[kind] = out.experience[kind].map(function (x) {
        return { when: clean(x.when), title: clean(x.title), role: clean(x.role), text: clean(x.text) };
      }).filter(function (x) {
        if (!x.title && (x.role || x.when || x.text)) throw new Error('An item in "' + (kind === 'work' ? 'Work' : 'Education') + '" has no company or school name.');
        return x.title;
      });
    });

    Object.keys(out.labels).forEach(function (k) { out.labels[k] = clean(out.labels[k]); });
    out.labels = S.normalize({ labels: out.labels }).labels;
    out.meta.title = clean(out.meta.title);
    out.meta.description = clean(out.meta.description);
    out.projectsIntro = clean(out.projectsIntro);
    out.contact.title = clean(out.contact.title);
    out.contact.lead = clean(out.contact.lead);

    // New photo and CV files.
    if (pending.photo) {
      if (forPreview) out.about.photo = pending.photoUrl;
      else {
        var photoPath = PHOTO_DIR + 'me-' + A.randomTag() + '.jpg';
        out.about.photo = photoPath;
        uploads.push({ path: photoPath, blob: pending.photo });
      }
    }
    if (pending.cv) {
      if (forPreview) out.profile.cv = pending.cvUrl;
      else {
        var cvPath = CV_PREFIX + A.randomTag() + '.pdf';
        out.profile.cv = cvPath;
        uploads.push({ path: cvPath, blob: pending.cv });
      }
    }
    return { data: out, uploads: uploads };
  }

  /*==================== PREVIEW ====================*/
  function preview() {
    var result;
    try { result = collect(true); } catch (err) { A.setStatus(err.message, 'error'); return; }
    A.clearStatus();
    var page = $('site-preview-page');
    page.textContent = '';
    page.appendChild(S.buildHome(result.data, A.session.projects));
    $('site-preview-box').hidden = false;
    $('site-preview-box').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /*==================== LOAD AND SAVE ====================*/
  function parseSite(text) {
    if (text === null) return {};
    var data;
    try { data = JSON.parse(text); } catch (e) { throw new Error('data/site.json in the repository is not valid JSON, so nothing was changed.'); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('data/site.json has an unexpected shape, so nothing was changed.');
    return data;
  }

  function loadSite() {
    $('site-loading').hidden = false;
    $('site-loading').textContent = 'Loading...';
    $('site-form').hidden = true;
    $('site-preview-box').hidden = true;
    dropPending('photo');
    dropPending('cv');
    return A.session.gh.readFile(SITE_PATH).then(function (text) {
      if (text === null) A.setStatus('data/site.json is not in the repository yet. Publish the new version of the site first, then reload this page.', 'error');
      site = S.normalize(parseSite(text));
      renderGuide(S.normalize(parseSite(text)));
      $('site-loading').hidden = true;
      $('site-form').hidden = false;
      drawEditor();
    }).catch(function (err) {
      $('site-loading').textContent = err.message;
      A.setStatus(err.message, 'error');
    });
  }

  function save(event) {
    event.preventDefault();
    if (A.isBusy()) return;
    var result;
    try { result = collect(false); } catch (err) { A.setStatus(err.message, 'error'); return; }
    var data = result.data;

    A.setBusy(true);
    $('site-save').textContent = 'Saving...';
    A.setStatus('Uploading to GitHub. Please wait, do not close this page...', 'info');

    Promise.all(result.uploads.map(function (u) {
      return A.blobToBase64(u.blob).then(function (b64) { return { path: u.path, base64: b64 }; });
    })).then(function (files) {
      return A.session.gh.commit(function (read) {
        return read(SITE_PATH).then(function (text) {
          var remote = parseSite(text);
          var old = S.normalize(remote);
          var deletes = [];
          // Only files this screen uploaded earlier are ever removed.
          if (old.about.photo && old.about.photo !== data.about.photo && old.about.photo.indexOf(PHOTO_DIR) === 0) deletes.push(old.about.photo);
          if (old.profile.cv && old.profile.cv !== data.profile.cv && old.profile.cv.indexOf(CV_PREFIX) === 0) deletes.push(old.profile.cv);
          Object.keys(data).forEach(function (k) { remote[k] = data[k]; });
          return {
            message: 'Update site content',
            files: [{ path: SITE_PATH, text: A.toJson(remote) }].concat(files),
            deletes: deletes
          };
        });
      });
    }).then(function () {
      return loadSite();
    }).then(function () {
      A.setStatus('Done! Your changes are saved. The site updates in about 1 to 2 minutes (GitHub Pages is rebuilding).', 'ok',
        { href: 'index.html', text: 'Open the home page' });
    }).catch(function (err) {
      A.setStatus(err.message, 'error');
    }).then(function () {
      A.setBusy(false);
      $('site-save').textContent = 'Save and publish';
    });
  }

  /*==================== WIRING ====================*/
  $('site-form').addEventListener('submit', save);
  $('site-preview').addEventListener('click', preview);
  $('site-reload').addEventListener('click', function () {
    if (!window.confirm('Throw away what you changed here and load the saved version again?')) return;
    A.clearStatus();
    loadSite();
  });

  document.addEventListener('saz:connected', function () { loadSite(); });
  document.addEventListener('saz:disconnected', function () {
    site = null;
    dropPending('photo');
    dropPending('cv');
    $('site-editor').textContent = '';
    $('site-form').hidden = true;
    $('site-sample').hidden = true;
    $('site-preview-box').hidden = true;
    selectTab(tabButtons[0]);
  });

  if (A.session.gh) loadSite();
})();
