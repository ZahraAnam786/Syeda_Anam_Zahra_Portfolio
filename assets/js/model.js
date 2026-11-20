/* Converts between a project in data/projects.json and what the admin form edits.
   Kept free of any page code so it can be tested on its own.

   In the file a section holds blocks: p, points, shots, rows.
   In the form the same section holds blocks the person edits as text:
     text    (one or more paragraphs, separated by an empty line)
     points  (one per line, "Title: text" or just "text")
     shots   (pictures with captions)
     rows    (one per line, "Label: value") */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SAZModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function slugify(text) {
    var s = String(text).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
    return s.replace(/-+$/, '');
  }

  function uniqueSlug(base, taken) {
    var id = base || 'item', n = 2;
    while (taken[id]) id = (base || 'item') + '-' + n++;
    taken[id] = true;
    return id;
  }

  /*==================== TEXT <-> BLOCK CONTENT ====================*/
  function pointsToText(items) {
    // A plain item whose text itself looks like "Title: text" gets a leading ": " so it stays plain.
    return (items || []).map(function (p) {
      if (p.title) return p.title + ': ' + p.text;
      return /^[^:]{1,40}:\s*\S/.test(p.text) ? ': ' + p.text : p.text;
    }).join('\n');
  }

  function textToPoints(text) {
    return String(text || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (line) {
      if (line.charAt(0) === ':') return { text: line.slice(1).trim() };
      var m = line.match(/^([^:]{1,40}):\s*(.+)$/);
      return m ? { title: m[1].trim(), text: m[2].trim() } : { text: line };
    });
  }

  function rowsToText(items) {
    return (items || []).map(function (r) { return r.label + ': ' + r.value; }).join('\n');
  }

  function textToRows(text) {
    return String(text || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (line) {
      var m = line.match(/^([^:]+):\s*(.+)$/);
      if (!m) throw new Error('A table line needs a colon, like "Language: Python". Problem line: "' + line.slice(0, 40) + '"');
      return { label: m[1].trim(), value: m[2].trim() };
    });
  }

  function paragraphsToText(paragraphs) { return paragraphs.join('\n\n'); }

  function textToParagraphs(text) {
    return String(text || '').split(/\n\s*\n/).map(function (p) { return p.replace(/\s*\n\s*/g, ' ').trim(); }).filter(Boolean);
  }

  /*==================== FILE -> FORM ====================*/
  function sectionsToState(sections) {
    return (sections || []).map(function (section) {
      var blocks = [];
      (section.blocks || []).forEach(function (block) {
        var last = blocks[blocks.length - 1];
        if (block.type === 'p') {
          if (last && last.type === 'text') last.paragraphs.push(block.text);
          else blocks.push({ type: 'text', paragraphs: [block.text] });
        } else if (block.type === 'points') {
          blocks.push({ type: 'points', text: pointsToText(block.items) });
        } else if (block.type === 'rows') {
          blocks.push({ type: 'rows', text: rowsToText(block.items) });
        } else if (block.type === 'shots') {
          blocks.push({
            type: 'shots', layout: block.layout === 'one' ? 'one' : 'grid',
            items: (block.items || []).map(function (s) { return JSON.parse(JSON.stringify(s)); })
          });
        }
      });
      blocks.forEach(function (b) { if (b.type === 'text') { b.text = paragraphsToText(b.paragraphs); delete b.paragraphs; } });
      var out = { id: section.id || '', title: section.title || '', sub: section.sub || '', blocks: blocks };
      ['icon', 'nav', 'navLabel'].forEach(function (k) { if (section[k] !== undefined) out[k] = section[k]; });
      return out;
    });
  }

  /*==================== FORM -> FILE ====================*/
  // mapShot(item) lets the caller swap a freshly picked picture for its final file path.
  function stateToSections(state, mapShot) {
    var takenIds = {};
    var result = [];
    state.forEach(function (section) {
      var title = section.title.trim();
      var blocks = [];
      section.blocks.forEach(function (block) {
        if (block.type === 'text') {
          textToParagraphs(block.text).forEach(function (t) { blocks.push({ type: 'p', text: t }); });
        } else if (block.type === 'points') {
          var items = textToPoints(block.text);
          if (items.length) blocks.push({ type: 'points', items: items });
        } else if (block.type === 'rows') {
          var rows = textToRows(block.text);
          if (rows.length) blocks.push({ type: 'rows', items: rows });
        } else if (block.type === 'shots') {
          if (!block.items.length) return;
          blocks.push({
            type: 'shots', layout: block.layout === 'one' ? 'one' : 'grid',
            items: block.items.map(function (item) {
              var out = mapShot(item);
              var clean = { src: out.src, w: out.w, h: out.h, crop: out.crop || 'plain' };
              if (out.caption && out.caption.trim()) clean.caption = out.caption.trim();
              if (out.alt) clean.alt = out.alt;
              return clean;
            })
          });
        }
      });
      if (!title && !blocks.length) return;   // an empty section is dropped
      if (!title) throw new Error('Every section needs a title. One section has content but no title.');
      var id = section.id && !takenIds[section.id] ? section.id : slugify(title) || 'section';
      id = uniqueSlug(id, takenIds);
      var out = { id: id, title: title };
      if (section.sub && section.sub.trim()) out.sub = section.sub.trim();
      ['icon', 'nav', 'navLabel'].forEach(function (k) { if (section[k] !== undefined) out[k] = section[k]; });
      out.blocks = blocks;
      result.push(out);
    });
    return result;
  }

  // All picture paths a project uses (sections and cover).
  function allSrcs(project) {
    var set = {};
    (project.sections || []).forEach(function (s) {
      (s.blocks || []).forEach(function (b) { if (b.type === 'shots') (b.items || []).forEach(function (i) { set[i.src] = true; }); });
    });
    (project.cover || []).forEach(function (c) { set[c.src] = true; });
    return set;
  }

  return {
    slugify: slugify, uniqueSlug: uniqueSlug, pointsToText: pointsToText, textToPoints: textToPoints,
    rowsToText: rowsToText, textToRows: textToRows, textToParagraphs: textToParagraphs,
    sectionsToState: sectionsToState, stateToSections: stateToSections, allSrcs: allSrcs
  };
});
