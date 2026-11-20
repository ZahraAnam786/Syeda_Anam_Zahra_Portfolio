/* admin.html: add, edit, reorder and delete projects without touching any code.
   (The rest of the site, like the hero, About, Skills and Contact, is edited by admin-site.js.)
   Flow: connect with a GitHub token -> fill the form -> Publish.
   Publish saves data/projects.json and the screenshots to the repository as one commit,
   and GitHub Pages then rebuilds the site (usually within 1 to 2 minutes). */
(function () {
  'use strict';

  var P = window.SAZProjects;
  var G = window.SAZGithub;
  var M = window.SAZModel;

  var DATA_PATH = 'data/projects.json';
  var IMG_DIR = 'assets/img/projects/';
  var MAX_SHOTS = 30;
  var MAX_WIDTH = 1600;
  var PALETTE = ['#5B3FD6', '#E4789A', '#4DB6E8', '#8B7CF6', '#2BB5A0', '#F4B63A', '#F2784B', '#3F8F5B'];
  var KEY_TOKEN = 'saz-admin-token';
  var KEY_REPO = 'saz-admin-repo';
  var CROPS = [
    ['plain', 'Show the whole picture'],
    ['screen', 'Full-screen capture (hides browser tabs and taskbar)'],
    ['sq', 'Full-screen capture, square screen'],
    ['c62', 'Full-screen capture, short crop']
  ];
  var BLOCK_LABEL = { text: 'Text', points: 'Highlights', shots: 'Screenshots', rows: 'Table' };
  var BLOCK_HINT = {
    text: 'Write paragraphs. Leave an empty line between paragraphs.',
    points: 'One per line. Write "Title: what it does" (the title becomes bold) or just plain text.',
    rows: 'One per line, like "Language: Python 3.11". The left part becomes the label.'
  };

  var session = { gh: null, owner: '', repo: '', branch: 'main', projects: [] };
  var editing = null;   // the project being edited, or null for a new one
  var secs = [];        // the sections in the form (see model.js)
  var tint = PALETTE[0];
  var busy = false;

  function $(id) { return document.getElementById(id); }

  function store(kind, key, value) {
    try {
      var area = kind === 'local' ? localStorage : sessionStorage;
      if (value === undefined) return area.getItem(key);
      if (value === null) area.removeItem(key); else area.setItem(key, value);
    } catch (e) { /* storage blocked: the page still works, it just forgets */ }
    return null;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /*==================== STATUS MESSAGE ====================*/
  function setStatus(message, kind, link) {
    var box = $('status');
    box.textContent = message;
    if (link) {
      box.appendChild(document.createTextNode(' '));
      var a = document.createElement('a');
      a.href = link.href;
      a.textContent = link.text;
      a.target = '_blank';
      a.rel = 'noopener';
      box.appendChild(a);
    }
    box.dataset.kind = kind || 'info';
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function clearStatus() { $('status').hidden = true; }

  /*==================== TOAST (small popup that tells what is needed) ====================*/
  var toastTimer = null;

  function dismissToast() {
    clearTimeout(toastTimer);
    var old = document.getElementById('toast');
    if (old) old.remove();
  }

  // opts: { kind: 'info' | 'error' | 'ok', title, groups: [ { label, items: [] } ], ms }
  function toast(opts) {
    dismissToast();
    var box = el('div', 'toast toast--' + (opts.kind || 'info'));
    box.id = 'toast';
    box.setAttribute('role', opts.kind === 'error' ? 'alert' : 'status');

    var head = el('div', 'toast_head');
    head.appendChild(el('strong', null, opts.title));
    var close = el('button', 'toast_close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close this message');
    close.addEventListener('click', dismissToast);
    head.appendChild(close);
    box.appendChild(head);

    (opts.groups || []).forEach(function (group) {
      if (!group.items.length) return;
      box.appendChild(el('p', 'toast_label toast_label--' + group.kind, group.label));
      var ul = el('ul', 'toast_list');
      group.items.forEach(function (item) { ul.appendChild(el('li', null, item)); });
      box.appendChild(ul);
    });

    document.body.appendChild(box);
    toastTimer = setTimeout(dismissToast, opts.ms || 14000);
  }

  // Looks at the form and says what is still missing (required) and what could still be added (optional).
  function checkForm() {
    var required = [];
    var optional = [];
    if (!$('f-title').value.trim()) required.push('Project name');
    if (!$('f-summary').value.trim()) required.push('Short description');

    var titled = 0, hasText = false, hasPoints = false, uncaptioned = 0, shotCount = 0;
    secs.forEach(function (s) {
      if (s.title.trim()) titled++;
      s.blocks.forEach(function (b) {
        if (b.type === 'text' && b.text.trim()) hasText = true;
        if (b.type === 'points' && b.text.trim()) hasPoints = true;
        if (b.type === 'shots') b.items.forEach(function (i) { shotCount++; if (!(i.caption || '').trim()) uncaptioned++; });
      });
    });
    var hasCover = !!(editing && editing.cover && editing.cover.length);
    if (!titled) required.push('At least one section with a title (for example "About")');
    if (!shotCount && !hasCover) required.push('At least one screenshot. The first one is the cover picture on the home page');

    if (!$('f-lead').value.trim()) optional.push('Intro on the project page (if empty, the short description is used)');
    if (!$('f-tech').value.trim()) optional.push('Technologies (small tags on the card, like React, Node.js)');
    if (!$('f-live').value.trim()) optional.push('Live site link (adds an "Open live site" button)');
    if (!$('f-code').value.trim()) optional.push('Source code link (adds a "View source code" button)');
    if (!hasText) optional.push('A Text block that explains the project');
    if (!hasPoints) optional.push('A Highlights block with the main features');
    if (uncaptioned) optional.push('Captions for your screenshots (' + uncaptioned + ' without a caption)');
    return { required: required, optional: optional };
  }

  function showRequirements() {
    toast({
      kind: 'info',
      title: 'Which fields are needed?',
      ms: 20000,
      groups: [
        { kind: 'required', label: 'Required (marked with *)', items: ['Project name', 'Short description', 'At least one section with a title', 'At least one screenshot (the first one is the cover picture)'] },
        { kind: 'optional', label: 'Optional (you can leave these empty)', items: [
          'Intro on the project page', 'Technologies', 'Live site link', 'Source code link', 'Card colour',
          'Small line under a section title', 'Text, Highlights and Table blocks', 'Screenshot captions'] }
      ]
    });
  }

  function setBusy(on, label) {
    busy = on;
    ['connect-btn', 'publish-btn', 'preview-btn', 'new-project', 'site-save', 'site-preview'].forEach(function (id) {
      var b = $(id);
      if (b) b.disabled = on;
    });
    if (label) $('publish-btn').textContent = label;
  }

  /*==================== SMALL HELPERS ====================*/
  function uniqueId(title) {
    var taken = {};
    session.projects.forEach(function (p) { taken[p.id] = true; });
    return M.uniqueSlug(M.slugify(title) || 'project', taken);
  }

  function randomTag() { return Math.random().toString(36).slice(2, 6); }

  function parseData(text) {
    if (text === null) return { projects: [] };
    var data;
    try { data = JSON.parse(text); } catch (e) { throw new Error('data/projects.json in the repository is not valid JSON, so nothing was changed.'); }
    if (!data || !Array.isArray(data.projects)) throw new Error('data/projects.json has an unexpected shape, so nothing was changed.');
    return data;
  }

  function toJson(data) { return JSON.stringify(data, null, 2) + '\n'; }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result).split(',')[1]); };
      reader.onerror = function () { reject(new Error('Could not read an image file.')); };
      reader.readAsDataURL(blob);
    });
  }

  // Shrinks a picked image to at most 1600px wide and saves it as JPEG.
  function processImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, MAX_WIDTH / img.naturalWidth);
        var w = Math.max(1, Math.round(img.naturalWidth * scale));
        var h = Math.max(1, Math.round(img.naturalHeight * scale));
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(function (blob) {
          URL.revokeObjectURL(url);
          if (blob) resolve({ blob: blob, w: w, h: h }); else reject(new Error('Could not convert ' + file.name));
        }, 'image/jpeg', 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error(file.name + ' is not an image the browser can open.')); };
      img.src = url;
    });
  }

  function countShots() {
    var n = 0;
    secs.forEach(function (s) { s.blocks.forEach(function (b) { if (b.type === 'shots') n += b.items.length; }); });
    return n;
  }

  function releaseShots() {
    secs.forEach(function (s) {
      s.blocks.forEach(function (b) { if (b.type === 'shots') b.items.forEach(function (i) { if (i.blob) URL.revokeObjectURL(i.src); }); });
    });
  }

  function move(list, i, dir) {
    var j = i + dir;
    if (j < 0 || j >= list.length) return;
    list.splice(j, 0, list.splice(i, 1)[0]);
  }

  /*==================== CONNECT ====================*/
  function parseRepo(text) {
    var clean = String(text).trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/$/, '');
    var m = clean.match(/^([\w.-]+)\/([\w.-]+)$/);
    if (!m) throw new Error('Write the repository like owner/name, for example ZahraAnam786/Syeda_Anam_Zahra_Portfolio.');
    return { owner: m[1], repo: m[2] };
  }

  function connect(token, repoText, remember) {
    var target;
    try { target = parseRepo(repoText); } catch (err) { setStatus(err.message, 'error'); return Promise.resolve(); }
    var gh = G.create({ owner: target.owner, repo: target.repo, token: token, branch: 'main' });
    setBusy(true);
    setStatus('Connecting...', 'info');
    return gh.verify().then(function (info) {
      session.branch = info.defaultBranch || 'main';
      session.gh = G.create({ owner: target.owner, repo: target.repo, token: token, branch: session.branch });
      session.owner = target.owner;
      session.repo = target.repo;
      return session.gh.readFile(DATA_PATH);
    }).then(function (text) {
      session.projects = parseData(text).projects;
      store('local', KEY_REPO, repoText);
      if (remember) { store('local', KEY_TOKEN, token); store('session', KEY_TOKEN, null); }
      else { store('session', KEY_TOKEN, token); store('local', KEY_TOKEN, null); }
      showWorkspace();
      document.dispatchEvent(new CustomEvent('saz:connected'));
      setStatus('Connected.', 'ok');
    }).catch(function (err) {
      session.gh = null;
      setStatus(err.message, 'error');
    }).then(function () { setBusy(false); });
  }

  function disconnect() {
    session.gh = null;
    store('local', KEY_TOKEN, null);
    store('session', KEY_TOKEN, null);
    $('token').value = '';
    $('workspace').hidden = true;
    $('connect').hidden = false;
    closeForm();
    clearStatus();
    document.dispatchEvent(new CustomEvent('saz:disconnected'));
  }

  function showWorkspace() {
    $('connect').hidden = true;
    $('workspace').hidden = false;
    $('connected-to').textContent = session.owner + '/' + session.repo + ' (branch ' + session.branch + ')';
    renderList();
  }

  /*==================== PROJECT LIST ====================*/
  function listButton(text, label, disabled, fn) {
    var b = el('button', 'btn btn-ghost btn--sm', text);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.disabled = disabled;
    b.addEventListener('click', fn);
    return b;
  }

  function renderList() {
    var list = $('project-list');
    list.textContent = '';
    $('list-empty').hidden = session.projects.length > 0;
    session.projects.forEach(function (project, i) {
      var li = el('li');
      var name = el('span', 'plist_name', project.title);
      if (i === 0) name.appendChild(el('span', 'badge', 'Latest'));
      var btns = el('span', 'plist_btns');
      btns.appendChild(listButton('↑', 'Move ' + project.title + ' up', i === 0, function () { moveProject(project, -1); }));
      btns.appendChild(listButton('↓', 'Move ' + project.title + ' down', i === session.projects.length - 1, function () { moveProject(project, 1); }));
      btns.appendChild(listButton('Edit', 'Edit ' + project.title, false, function () { openForm(project); }));
      btns.appendChild(listButton('Delete', 'Delete ' + project.title, false, function () { removeProject(project); }));
      li.appendChild(name);
      li.appendChild(btns);
      list.appendChild(li);
    });
  }

  /*==================== FORM: COLOUR ====================*/
  function renderSwatches() {
    var box = $('swatches');
    box.textContent = '';
    PALETTE.forEach(function (color) {
      var b = el('button', 'swatch');
      b.type = 'button';
      b.style.background = color;
      b.setAttribute('aria-label', 'Colour ' + color);
      b.setAttribute('aria-pressed', String(color.toLowerCase() === tint.toLowerCase()));
      b.addEventListener('click', function () { tint = color; renderSwatches(); });
      box.appendChild(b);
    });
  }

  /*==================== FORM: SECTIONS EDITOR ====================*/
  function mini(row, text, label, disabled, fn) {
    var b = el('button', 'mini', text);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.disabled = disabled;
    b.addEventListener('click', fn);
    row.appendChild(b);
  }

  function textField(labelText, value, onInput, multiline, placeholder) {
    var wrap = el('label', 'field');
    wrap.appendChild(el('span', 'field_label', labelText));
    var input = el(multiline ? 'textarea' : 'input');
    if (multiline) input.rows = multiline; else input.type = 'text';
    input.value = value;
    if (placeholder) input.placeholder = placeholder;
    input.addEventListener('input', function () { onInput(input.value); });
    wrap.appendChild(input);
    return wrap;
  }

  function shotsEditor(block) {
    var box = el('div', 'shots_editor');

    var layout = el('label', 'field');
    layout.appendChild(el('span', 'field_label', 'Layout'));
    var select = el('select');
    [['grid', 'Side by side (grid)'], ['one', 'One big picture']].forEach(function (o) {
      var opt = el('option', null, o[1]);
      opt.value = o[0];
      select.appendChild(opt);
    });
    select.value = block.layout === 'one' ? 'one' : 'grid';
    select.addEventListener('change', function () { block.layout = select.value; });
    layout.appendChild(select);
    box.appendChild(layout);

    var pick = el('label', 'field');
    pick.appendChild(el('span', 'field_label', 'Add screenshots'));
    var file = el('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.multiple = true;
    file.addEventListener('change', function () { addFiles(block, file); });
    pick.appendChild(file);
    box.appendChild(pick);

    var list = el('ul', 'shots_list');
    block.items.forEach(function (shot, i) {
      var li = el('li');
      var img = el('img');
      img.src = shot.src;
      img.alt = '';
      var side = el('div', 'shot_side');

      var caption = el('input');
      caption.type = 'text';
      caption.maxLength = 80;
      caption.placeholder = 'Caption, like "Sign in page"';
      caption.value = shot.caption || '';
      caption.setAttribute('aria-label', 'Caption for screenshot ' + (i + 1));
      caption.addEventListener('input', function () { shot.caption = caption.value; });

      var crop = el('select');
      var known = {};
      CROPS.forEach(function (c) { known[c[0]] = true; });
      var options = CROPS.slice();
      if (shot.crop && !known[shot.crop]) options.push([shot.crop, 'Current crop (' + shot.crop + ')']);
      options.forEach(function (c) { var o = el('option', null, c[1]); o.value = c[0]; crop.appendChild(o); });
      crop.value = shot.crop || 'plain';
      crop.setAttribute('aria-label', 'Crop for screenshot ' + (i + 1));
      crop.addEventListener('change', function () { shot.crop = crop.value; });

      var row = el('div', 'shot_row');
      mini(row, 'Move up', 'Move up screenshot ' + (i + 1), i === 0, function () { move(block.items, i, -1); renderSections(); });
      mini(row, 'Move down', 'Move down screenshot ' + (i + 1), i === block.items.length - 1, function () { move(block.items, i, 1); renderSections(); });
      mini(row, 'Remove', 'Remove screenshot ' + (i + 1), false, function () {
        if (shot.blob) URL.revokeObjectURL(shot.src);
        block.items.splice(i, 1);
        renderSections();
      });

      side.appendChild(caption);
      side.appendChild(crop);
      side.appendChild(row);
      li.appendChild(img);
      li.appendChild(side);
      list.appendChild(li);
    });
    box.appendChild(list);
    return box;
  }

  function addFiles(block, input) {
    var files = Array.prototype.slice.call(input.files);
    input.value = '';
    var room = Math.max(MAX_SHOTS - countShots(), 0);
    if (files.length > room) {
      setStatus('A project can have up to ' + MAX_SHOTS + ' screenshots. Only the first ' + room + ' new ones were used.', 'error');
      files = files.slice(0, room);
    }
    files.reduce(function (chain, file) {
      return chain.then(function () {
        return processImage(file).then(function (img) {
          var name = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
          block.items.push({ src: URL.createObjectURL(img.blob), blob: img.blob, caption: name.length <= 40 ? name : '', w: img.w, h: img.h, crop: 'plain' });
        });
      });
    }, Promise.resolve()).catch(function (err) { setStatus(err.message, 'error'); }).then(renderSections);
  }

  function renderSections() {
    var host = $('sections');
    host.textContent = '';
    secs.forEach(function (section, si) {
      var card = el('div', 'sec');
      var head = el('div', 'sec_head');
      head.appendChild(el('strong', null, 'Section ' + (si + 1)));
      var tools = el('span', 'shot_row');
      mini(tools, 'Move up', 'Move section ' + (si + 1) + ' up', si === 0, function () { move(secs, si, -1); renderSections(); });
      mini(tools, 'Move down', 'Move section ' + (si + 1) + ' down', si === secs.length - 1, function () { move(secs, si, 1); renderSections(); });
      mini(tools, 'Remove section', 'Remove section ' + (si + 1), false, function () {
        if (!window.confirm('Remove this whole section?')) return;
        section.blocks.forEach(function (b) { if (b.type === 'shots') b.items.forEach(function (i) { if (i.blob) URL.revokeObjectURL(i.src); }); });
        secs.splice(si, 1);
        renderSections();
      });
      head.appendChild(tools);
      card.appendChild(head);

      var grid = el('div', 'grid2');
      grid.appendChild(textField('Section title *', section.title, function (v) { section.title = v; }, 0, 'for example Overview'));
      grid.appendChild(textField('Small line under the title (optional)', section.sub, function (v) { section.sub = v; }, 0, 'optional, for example What it does'));
      card.appendChild(grid);

      section.blocks.forEach(function (block, bi) {
        var b = el('div', 'blk');
        var bh = el('div', 'sec_head');
        bh.appendChild(el('span', 'blk_label', BLOCK_LABEL[block.type]));
        var bt = el('span', 'shot_row');
        mini(bt, 'Up', 'Move block ' + (bi + 1) + ' up', bi === 0, function () { move(section.blocks, bi, -1); renderSections(); });
        mini(bt, 'Down', 'Move block ' + (bi + 1) + ' down', bi === section.blocks.length - 1, function () { move(section.blocks, bi, 1); renderSections(); });
        mini(bt, 'Remove', 'Remove block ' + (bi + 1), false, function () {
          if (block.type === 'shots') block.items.forEach(function (i) { if (i.blob) URL.revokeObjectURL(i.src); });
          section.blocks.splice(bi, 1);
          renderSections();
        });
        bh.appendChild(bt);
        b.appendChild(bh);
        if (block.type === 'shots') {
          b.appendChild(shotsEditor(block));
        } else {
          var f = textField('', block.text, function (v) { block.text = v; }, block.type === 'text' ? 5 : 4);
          f.insertBefore(el('span', 'field_hint', BLOCK_HINT[block.type]), f.lastChild);
          b.appendChild(f);
        }
        card.appendChild(b);
      });

      var add = el('div', 'shot_row');
      add.appendChild(el('span', 'field_hint', 'Add a block:'));
      [['text', 'Text'], ['points', 'Highlights'], ['shots', 'Screenshots'], ['rows', 'Table']].forEach(function (t) {
        mini(add, '+ ' + t[1], 'Add a ' + t[1] + ' block to section ' + (si + 1), false, function () {
          section.blocks.push(t[0] === 'shots' ? { type: 'shots', layout: 'grid', items: [] } : { type: t[0], text: '' });
          renderSections();
        });
      });
      card.appendChild(add);
      host.appendChild(card);
    });
  }

  function defaultSections() {
    return [
      { id: '', title: 'About', sub: 'What it is', blocks: [{ type: 'text', text: '' }, { type: 'points', text: '' }] },
      { id: '', title: 'Screens', sub: 'How it looks', blocks: [{ type: 'shots', layout: 'grid', items: [] }] }
    ];
  }

  /*==================== FORM: OPEN, CLOSE, FILL ====================*/
  function openForm(project, quiet) {
    editing = project || null;
    releaseShots();
    $('form-title').textContent = project ? 'Edit: ' + project.title : 'New project';
    $('publish-btn').textContent = project ? 'Save changes' : 'Publish';
    $('f-title').value = project ? project.title : '';
    $('f-summary').value = project ? project.summary : '';
    $('f-lead').value = project && project.lead ? project.lead : '';
    $('f-tech').value = project ? (project.tech || []).join(', ') : '';
    $('f-live').value = project && project.links ? project.links.live || '' : '';
    $('f-code').value = project && project.links ? project.links.code || '' : '';
    tint = project && project.tint ? project.tint : PALETTE[0];
    secs = project ? M.sectionsToState(project.sections) : defaultSections();
    renderSwatches();
    renderSections();
    $('preview').hidden = true;
    $('project-form').hidden = false;
    $('project-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('f-title').focus({ preventScroll: true });
    if (!quiet) showRequirements();
  }

  function closeForm() {
    dismissToast();
    editing = null;
    releaseShots();
    secs = [];
    $('project-form').hidden = true;
    $('preview').hidden = true;
  }

  // Reads the form into a project object. Throws an Error with a plain message if something is missing.
  function collect(forPreview) {
    var title = $('f-title').value.trim();
    var summary = $('f-summary').value.trim();
    if (!title) throw new Error('Please write the project name.');
    if (!summary) throw new Error('Please write the short description.');

    var live = $('f-live').value.trim();
    var code = $('f-code').value.trim();
    if (live && !P.safeUrl(live)) throw new Error('The live site link must start with http:// or https://');
    if (code && !P.safeUrl(code)) throw new Error('The source code link must start with http:// or https://');

    var seen = {};
    var tech = $('f-tech').value.split(',').map(function (t) { return t.trim(); }).filter(function (t) {
      var key = t.toLowerCase();
      if (!t || seen[key]) return false;
      seen[key] = true;
      return true;
    });

    var id = editing ? editing.id : uniqueId(title);
    var uploads = [];
    var counter = 0;
    var sections = M.stateToSections(secs, function (item) {
      var src = item.src;
      if (item.blob && !forPreview) {
        src = IMG_DIR + id + '/' + (++counter) + '-' + randomTag() + '.jpg';
        uploads.push({ path: src, blob: item.blob });
      }
      return { src: src, w: item.w, h: item.h, crop: item.crop, caption: item.caption, alt: item.alt };
    });
    if (!sections.length) throw new Error('Please add at least one section with some content.');

    var project = {
      id: id, title: title, summary: summary, tech: tech, tint: tint,
      links: { live: live, code: code }, sections: sections,
      added: editing && editing.added ? editing.added : new Date().toISOString().slice(0, 10)
    };
    var lead = $('f-lead').value.trim();
    if (lead) project.lead = lead;

    // A cover set earlier (for example by the first import) stays, unless its picture was removed.
    var srcs = M.allSrcs(project);
    var hasShots = Object.keys(srcs).length > 0;
    if (editing && editing.cover && editing.cover.length) {
      var cover = editing.cover.filter(function (c) { return c.src.indexOf(IMG_DIR) !== 0 || srcs[c.src]; });
      if (cover.length) { project.cover = cover; hasShots = true; }
    }
    if (!hasShots) throw new Error('Please add at least one screenshot. The first one is the cover picture on the home page.');
    return { project: project, uploads: uploads };
  }

  /*==================== PREVIEW ====================*/
  function preview() {
    var result;
    var check = checkForm();
    if (check.required.length) {
      toast({ kind: 'error', title: 'Please add this first', groups: [{ kind: 'required', label: 'Required, still missing', items: check.required }] });
      return;
    }
    try { result = collect(true); } catch (err) { toast({ kind: 'error', title: 'Please fix this', groups: [{ kind: 'required', label: 'Problem', items: [err.message] }] }); return; }
    clearStatus();
    if (check.optional.length) {
      toast({ kind: 'info', title: 'Looks good. You can still add:', ms: 16000, groups: [{ kind: 'optional', label: 'Optional, not filled yet', items: check.optional }] });
    } else {
      dismissToast();
    }
    var feature = $('preview-feature'), card = $('preview-card'), page = $('preview-page');
    feature.textContent = '';
    card.textContent = '';
    page.textContent = '';
    feature.appendChild(P.featureNode(result.project, '#preview'));
    card.appendChild(P.cardNode(result.project, '#preview'));
    page.appendChild(P.detailNode(result.project, { instant: true }));
    $('preview').hidden = false;
    $('preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /*==================== PUBLISH / MOVE / DELETE ====================*/
  function refresh() {
    return session.gh.readFile(DATA_PATH).then(function (text) {
      session.projects = parseData(text).projects;
      renderList();
    });
  }

  // Only pictures this admin screen uploaded are ever deleted. The original site pictures stay put.
  function ownedPictures(srcs) {
    return Object.keys(srcs).filter(function (s) { return s.indexOf(IMG_DIR) === 0; });
  }

  function publish(event) {
    event.preventDefault();
    if (busy) return;
    var result;
    var check = checkForm();
    if (check.required.length) {
      toast({ kind: 'error', title: 'Please add this before publishing', groups: [{ kind: 'required', label: 'Required, still missing', items: check.required }] });
      return;
    }
    try { result = collect(false); } catch (err) { toast({ kind: 'error', title: 'Please fix this', groups: [{ kind: 'required', label: 'Problem', items: [err.message] }] }); return; }
    dismissToast();
    var project = result.project;
    var isEdit = !!editing;

    setBusy(true, isEdit ? 'Saving...' : 'Publishing...');
    setStatus('Uploading to GitHub. Please wait, do not close this page...', 'info');

    Promise.all(result.uploads.map(function (u) {
      return blobToBase64(u.blob).then(function (b64) { return { path: u.path, base64: b64 }; });
    })).then(function (imageFiles) {
      return session.gh.commit(function (read) {
        return read(DATA_PATH).then(function (text) {
          var data = parseData(text);
          var index = -1;
          data.projects.forEach(function (p, i) { if (p.id === project.id) index = i; });
          if (!isEdit && index >= 0) {
            throw new Error('A project with this name was just added from somewhere else. Reload this page and try again.');
          }
          var deletes = [];
          if (index >= 0) {
            var keep = M.allSrcs(project);
            ownedPictures(M.allSrcs(data.projects[index])).forEach(function (s) { if (!keep[s]) deletes.push(s); });
            data.projects[index] = project;
          } else {
            data.projects.unshift(project);
          }
          return {
            message: (isEdit ? 'Update project: ' : 'Add project: ') + project.title,
            files: [{ path: DATA_PATH, text: toJson(data) }].concat(imageFiles),
            deletes: deletes
          };
        });
      });
    }).then(function () {
      closeForm();
      return refresh();
    }).then(function () {
      setStatus('Done! Your project is saved. The site updates in about 1 to 2 minutes (GitHub Pages is rebuilding).', 'ok',
        { href: 'project.html?id=' + encodeURIComponent(project.id), text: 'Open the project page' });
    }).catch(function (err) {
      setStatus(err.message, 'error');
    }).then(function () {
      setBusy(false);
      $('publish-btn').textContent = editing ? 'Save changes' : 'Publish';
    });
  }

  function moveProject(project, dir) {
    if (busy) return;
    setBusy(true);
    setStatus('Changing the order...', 'info');
    session.gh.commit(function (read) {
      return read(DATA_PATH).then(function (text) {
        var data = parseData(text);
        var i = -1;
        data.projects.forEach(function (p, n) { if (p.id === project.id) i = n; });
        if (i < 0) throw new Error('That project is already gone. The list was refreshed.');
        move(data.projects, i, dir);
        return { message: 'Reorder projects: ' + project.title, files: [{ path: DATA_PATH, text: toJson(data) }], deletes: [] };
      });
    }).then(refresh).then(function () {
      setStatus('Order saved. The first project is the big "Latest project" panel. The site updates in about 1 to 2 minutes.', 'ok');
    }).catch(function (err) {
      refresh().catch(function () { /* keep the old list */ });
      setStatus(err.message, 'error');
    }).then(function () { setBusy(false); });
  }

  function removeProject(project) {
    if (busy) return;
    if (!window.confirm('Delete "' + project.title + '" from your portfolio? This cannot be undone from here.')) return;
    setBusy(true);
    setStatus('Deleting...', 'info');
    session.gh.commit(function (read) {
      return read(DATA_PATH).then(function (text) {
        var data = parseData(text);
        var found = data.projects.filter(function (p) { return p.id === project.id; })[0];
        if (!found) throw new Error('That project is already gone. The list was refreshed.');
        data.projects = data.projects.filter(function (p) { return p.id !== project.id; });
        return {
          message: 'Delete project: ' + project.title,
          files: [{ path: DATA_PATH, text: toJson(data) }],
          deletes: ownedPictures(M.allSrcs(found))
        };
      });
    }).then(function () {
      if (editing && editing.id === project.id) closeForm();
      return refresh();
    }).then(function () {
      setStatus('Deleted. The site updates in about 1 to 2 minutes.', 'ok');
    }).catch(function (err) {
      refresh().catch(function () { /* keep the old list */ });
      setStatus(err.message, 'error');
    }).then(function () { setBusy(false); });
  }

  /*==================== SAMPLE ====================*/
  // A drawn app screen, so the sample needs no image file. (data:image is allowed by SAZProjects.safeImage)
  function sampleShot(color, label) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">' +
      '<rect width="1600" height="900" fill="#f6f5fb"/><rect width="1600" height="90" fill="' + color + '"/>' +
      '<text x="130" y="58" font-family="Arial" font-size="34" font-weight="700" fill="#fff">BookNest</text>' +
      '<text x="130" y="190" font-family="Arial" font-size="48" font-weight="700" fill="#17132e">' + label + '</text>' +
      [0, 1, 2, 3].map(function (i) {
        var x = 130 + i * 335;
        return '<rect x="' + x + '" y="250" width="305" height="420" rx="18" fill="#fff" stroke="#e2dff0"/>' +
          '<rect x="' + (x + 22) + '" y="272" width="261" height="250" rx="12" fill="' + color + '" opacity="' + (0.25 + i * 0.18) + '"/>' +
          '<rect x="' + (x + 22) + '" y="556" width="190" height="20" rx="8" fill="#17132e" opacity=".8"/>' +
          '<rect x="' + (x + 22) + '" y="596" width="110" height="16" rx="8" fill="#5b5676" opacity=".5"/>';
      }).join('') + '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  var SAMPLE = {
    title: 'Online Bookstore',
    summary: 'A web store where customers browse books, add them to a cart and pay online.',
    lead: 'A full shopping flow: catalogue, cart, secure payment and order tracking, with a separate dashboard for the shop owner.',
    tech: 'React, Node.js, Express, MongoDB, Stripe, JWT',
    live: 'https://example.com/bookstore',
    code: 'https://github.com/your-name/online-bookstore',
    tint: '#E4789A',
    about: 'Customers can search by title or author, read details and reviews, and check out with a card. Admins manage books, stock and orders from a separate dashboard.\n\nI built it to practise a full shopping flow: product catalogue, cart, payments and order tracking.',
    points: 'Catalogue: search and filter thousands of books.\nCart: add, remove and change quantities.\nPayments: secure checkout with Stripe.\nAdmin: manage books, stock and orders.',
    table: 'Frontend: React with hooks\nBackend: Node.js and Express\nDatabase: MongoDB\nPayments: Stripe'
  };

  function sampleProject() {
    return {
      id: 'sample', title: SAMPLE.title, summary: SAMPLE.summary, lead: SAMPLE.lead,
      tech: SAMPLE.tech.split(',').map(function (t) { return t.trim(); }),
      links: { live: SAMPLE.live, code: SAMPLE.code }, tint: SAMPLE.tint,
      sections: [
        { id: 'about', title: 'About', sub: 'What it is', blocks: [
          { type: 'p', text: SAMPLE.about.split(/\n\n/)[0] }, { type: 'p', text: SAMPLE.about.split(/\n\n/)[1] },
          { type: 'points', items: M.textToPoints(SAMPLE.points) } ] },
        { id: 'screens', title: 'Screens', sub: 'How it looks', blocks: [
          { type: 'shots', layout: 'grid', items: [
            { src: sampleShot('#E4789A', 'Home page'), caption: 'Home page', w: 1600, h: 900, crop: 'plain' },
            { src: sampleShot('#4DB6E8', 'Shopping cart'), caption: 'Shopping cart', w: 1600, h: 900, crop: 'plain' } ] } ] },
        { id: 'stack', title: 'Tech stack', blocks: [{ type: 'rows', items: M.textToRows(SAMPLE.table) }] }
      ]
    };
  }

  function renderSample() {
    var rows = [
      ['Project name', 'The name people will see. Keep it short.', SAMPLE.title, 'Card title and the big heading of the page'],
      ['Short description', 'One or two sentences: what it does.', SAMPLE.summary, 'Text on the home page card (or big panel)'],
      ['Intro on the project page', 'Optional. Leave empty to reuse the short description.', SAMPLE.lead, 'Line under the big heading of the project page'],
      ['Technologies', 'Names separated by commas.', SAMPLE.tech, 'Small tags. The card shows the first 4, the page shows all'],
      ['Live site link', 'Optional. Full link starting with https://', SAMPLE.live, '"Open live site" button. Empty = no button'],
      ['Source code link', 'Optional. Full link starting with https://', SAMPLE.code, '"View source code" button. Empty = no button'],
      ['Card colour', 'Pick any colour you like.', 'Pink', 'Glow behind the card picture'],
      ['Section title', 'A heading for one part of the project page.', 'About\nScreens\nTech stack', 'Big heading on the left. 3 or more sections also add a menu at the top'],
      ['Small line under the title', 'Optional. A few words.', 'What it is\nHow it looks', 'Grey line under the section title'],
      ['Block: Text', 'Paragraphs. Empty line = new paragraph.', 'Customers can search by title or author...', 'Paragraphs inside the section'],
      ['Block: Highlights', 'One per line: Title: what it does.', 'Cart: add, remove and change quantities.', 'Bullet list. The part before the colon is bold'],
      ['Block: Screenshots', 'PNG or JPG of the app. Add a caption. Choose a layout.', 'Home page\nShopping cart', 'Pictures in a browser frame. The first one is the cover on the home page'],
      ['Block: Table', 'One per line: Label: value.', 'Frontend: React with hooks', 'Two-column table, good for a tech stack']
    ];
    var body = $('sample-rows');
    body.textContent = '';
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      row.forEach(function (cell) { var td = document.createElement('td'); td.textContent = cell; tr.appendChild(td); });
      body.appendChild(tr);
    });
    var project = sampleProject();
    $('sample-feature').appendChild(P.featureNode(project, '#sample'));
    $('sample-card').appendChild(P.cardNode(project, '#sample'));
    $('sample-page').appendChild(P.detailNode(project, { instant: true }));
  }

  function fillSample() {
    openForm(null, true);
    var sample = sampleProject();
    $('f-title').value = SAMPLE.title;
    $('f-summary').value = SAMPLE.summary;
    $('f-lead').value = SAMPLE.lead;
    $('f-tech').value = SAMPLE.tech;
    $('f-live').value = SAMPLE.live;
    $('f-code').value = SAMPLE.code;
    tint = SAMPLE.tint;
    secs = M.sectionsToState(sample.sections);
    // The drawn sample pictures are not real files, so remove them. Your own screenshots are required to publish.
    secs.forEach(function (s) { s.blocks.forEach(function (b) { if (b.type === 'shots') b.items = []; }); });
    renderSwatches();
    renderSections();
    setStatus('The form is filled with a sample. Replace each field with your own project and add your own screenshots. Do not publish the sample.', 'info');
  }

  // Used by admin-site.js (the editor for the rest of the site).
  window.SAZAdmin = {
    session: session, setStatus: setStatus, clearStatus: clearStatus, setBusy: setBusy,
    isBusy: function () { return busy; }, el: el, move: move, store: store,
    blobToBase64: blobToBase64, toJson: toJson, randomTag: randomTag
  };

  /*==================== WIRING ====================*/
  $('connect-form').addEventListener('submit', function (event) {
    event.preventDefault();
    if (busy) return;
    var token = $('token').value.trim();
    if (!token) { setStatus('Paste your GitHub token first.', 'error'); return; }
    connect(token, $('repo').value, $('remember').checked);
  });

  $('disconnect').addEventListener('click', disconnect);
  $('new-project').addEventListener('click', function () { openForm(null); });
  $('cancel-btn').addEventListener('click', function () { closeForm(); clearStatus(); });
  $('preview-btn').addEventListener('click', preview);
  $('project-form').addEventListener('submit', publish);
  $('fill-sample').addEventListener('click', fillSample);
  $('show-help').addEventListener('click', showRequirements);
  $('add-section').addEventListener('click', function () {
    secs.push({ id: '', title: '', sub: '', blocks: [{ type: 'text', text: '' }] });
    renderSections();
  });

  var themeButton = $('theme-button');
  themeButton.addEventListener('click', function () {
    var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store('local', 'selected-theme', next);
    themeButton.setAttribute('aria-label', next === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    themeButton.querySelector('i').className = next === 'dark' ? 'uil uil-sun' : 'uil uil-moon';
  });

  renderSample();

  // Come back already connected if the token was remembered (or this tab is still open).
  var savedRepo = store('local', KEY_REPO);
  if (savedRepo) $('repo').value = savedRepo;
  var savedToken = store('local', KEY_TOKEN);
  var remembered = !!savedToken;
  if (!savedToken) savedToken = store('session', KEY_TOKEN);
  if (savedToken) {
    $('token').value = savedToken;
    $('remember').checked = remembered;
    connect(savedToken, $('repo').value, remembered);
  }
})();
