/* Commander Tracker v1.8 — "Import from link": commanders (never the 99) from an Archidekt or Moxfield deck.
   Neither site sends CORS headers for this app, so deck links go through a tiny Supabase Edge Function
   (deck-commanders) that answers with only the commander names, colour identity, bracket and deck name.
   Fallback without a link: paste the deck's text export (the commander section / markers are detected) or type the
   commander's name; names are checked on Scryfall (which allows CORS) for spelling and colour identity. */
'use strict';
(function () {
  const PROXY = 'https://uxfcidiqagswxkntymmh.supabase.co/functions/v1/deck-commanders';
  const SCRYFALL = 'https://api.scryfall.com';
  const WUBRG = ['W', 'U', 'B', 'R', 'G'];
  const SITE = { archidekt: 'Archidekt', moxfield: 'Moxfield' };
  // Moxfield paths under /decks/ that are pages, not deck ids
  const MOX_RESERVED = new Set(['personal', 'public', 'following', 'liked', 'bookmarks', 'history', 'search', 'recent', 'new', 'create', 'import', 'shared']);
  const TIMEOUT = 12000;

  class ImportError extends Error { constructor(code, info = {}) { super(code); this.code = code; this.info = info; } }

  const lettersOf = (arr) => WUBRG.filter((c) => Array.isArray(arr) && arr.includes(c));
  const union = (...lists) => WUBRG.filter((c) => lists.some((l) => l.includes(c)));
  const ciString = (colors) => (colors && colors.length ? colors.join('') : 'C');
  const cleanName = (n) => String(n || '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const normBracket = (b) => { if (b == null || b === '' || typeof b === 'boolean') return null; const n = Number(b); return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null; };

  // ---------- links ----------
  // Canonical URL of an imported deck (also the only shape the database accepts for decks.link)
  const LINK_RE = /^https:\/\/(archidekt\.com\/decks\/[0-9]{1,10}|moxfield\.com\/decks\/[A-Za-z0-9_-]{8,32})$/;
  const cleanLink = (u) => (typeof u === 'string' && LINK_RE.test(u) ? u : '');
  const canonical = (source, id) => (source === 'archidekt' ? `https://archidekt.com/decks/${id}` : `https://moxfield.com/decks/${id}`);
  const linkSite = (u) => (/archidekt\.com/.test(u) ? 'Archidekt' : /moxfield\.com/.test(u) ? 'Moxfield' : '');

  // Returns null when the text doesn't contain a URL at all (so it may be a pasted deck list or a card name),
  // { source, id, url } for a deck link, or { error } for a link that can't be imported.
  function parseLink(text) {
    const s = String(text || '').trim();
    const m = s.match(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)*[a-z0-9-]+\.[a-z]{2,}(?::\d+)?(?:\/[^\s<>"']*)?/i);
    if (!m) return null;
    // a bare word with a dot inside a deck list ("Mr. House") is not a link: need a scheme, a www. or a path
    if (!/^(https?:\/\/|www\.)/i.test(m[0]) && !/\//.test(m[0])) return null;
    let u;
    try { u = new URL(/^https?:\/\//i.test(m[0]) ? m[0] : 'https://' + m[0]); } catch (e) { return { error: 'bad_url' }; }
    const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
    const parts = u.pathname.split('/').filter(Boolean);
    if (host === 'archidekt.com') {
      // /decks/<id>[/<slug>], also /api/decks/<id>/ and the old /decks/<id>#...
      const i = parts[0] === 'api' ? 1 : 0;
      if (parts[i] !== 'decks' || !parts[i + 1]) return { error: 'no_deck', site: 'Archidekt' };
      const id = (parts[i + 1].match(/^\d{1,10}/) || [])[0];
      if (!id) return { error: 'bad_url', site: 'Archidekt' };
      return { source: 'archidekt', id, url: canonical('archidekt', id) };
    }
    if (host === 'moxfield.com' || host === 'api2.moxfield.com') {
      const i = parts.indexOf('decks');
      let id = i >= 0 ? parts[i + 1] : '';
      if (id === 'all') id = parts[i + 2]; // api2 .../v3/decks/all/<id>
      if (!id || MOX_RESERVED.has(id.toLowerCase())) return { error: 'no_deck', site: 'Moxfield' };
      if (!/^[A-Za-z0-9_-]{8,32}$/.test(id)) return { error: 'bad_url', site: 'Moxfield' };
      return { source: 'moxfield', id, url: canonical('moxfield', id) };
    }
    return { error: 'unsupported', host };
  }

  // ---------- network helpers ----------
  const isOffline = () => navigator.onLine === false;
  async function getJson(url, init = {}) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), TIMEOUT);
    if (init.signal) { if (init.signal.aborted) ctl.abort(); else init.signal.addEventListener('abort', () => ctl.abort()); }
    let r;
    try { r = await fetch(url, { ...init, signal: ctl.signal, credentials: 'omit' }); } catch (e) {
      if (init.signal && init.signal.aborted) throw new ImportError('cancelled');
      throw new ImportError(ctl.signal.aborted ? 'timeout' : isOffline() ? 'offline' : 'network');
    } finally { clearTimeout(t); }
    let body = null; try { body = await r.json(); } catch (e) { /* not JSON */ }
    return { status: r.status, ok: r.ok, body };
  }

  // ---------- deck link -> commanders (through the proxy) ----------
  async function fetchDeck(ref, opts = {}) {
    if (isOffline()) throw new ImportError('offline');
    const site = SITE[ref.source];
    const { status, ok, body } = await getJson(`${PROXY}?source=${ref.source}&id=${encodeURIComponent(ref.id)}`, { signal: opts.signal });
    if (!ok || !body || body.error) {
      const code = (body && body.error) || (status === 404 ? 'not_found' : 'upstream');
      throw new ImportError(code === 'rate_limited' ? 'busy' : code, { site, name: body && body.name });
    }
    const commanders = (Array.isArray(body.commanders) ? body.commanders : []).slice(0, 2)
      .map((c) => ({ name: cleanName(c && c.name), colors: lettersOf(c && c.colors) })).filter((c) => c.name);
    if (!commanders.length) throw new ImportError('no_commander', { site });
    const deck = {
      source: ref.source, site, id: ref.id, url: canonical(ref.source, ref.id), name: cleanName(body.name).slice(0, 60),
      commanders, colors: union(lettersOf(body.colors), ...commanders.map((c) => c.colors)),
      bracket: normBracket(body.bracket), bracketAuto: !!body.bracketAuto && normBracket(body.bracket) != null, extra: Math.max(0, +body.extra || 0),
    };
    // no colour data at all from the site: ask Scryfall (a genuinely colourless commander stays colourless)
    if (!deck.colors.length) {
      try { const cards = await scryfallCards(commanders.map((c) => c.name), opts); deck.commanders = cards.map((c, i) => ({ name: commanders[i].name, colors: c.colors })); deck.colors = union(...cards.map((c) => c.colors)); } catch (e) { /* keep what we have */ }
    }
    return deck;
  }

  // ---------- Scryfall: validate names, colour identity ----------
  async function scryfallCard(name, opts = {}) {
    const { status, ok, body } = await getJson(`${SCRYFALL}/cards/named?fuzzy=${encodeURIComponent(name)}`, { signal: opts.signal, headers: { Accept: 'application/json' } });
    if (status === 404) throw new ImportError(body && body.type === 'ambiguous' ? 'ambiguous' : 'card_not_found', { name });
    if (!ok || !body || !body.name) throw new ImportError('scryfall', { name });
    const front = String(body.name).split(' // ')[0];
    return { name: cleanName(body.layout && /^(transform|modal_dfc|flip|adventure|split)$/.test(body.layout) ? front : body.name), colors: lettersOf(body.color_identity), legendary: /Legendary|Background/.test(body.type_line || '') };
  }
  async function scryfallCards(names, opts = {}) {
    const out = [];
    for (const n of names) { out.push(await scryfallCard(n, opts)); if (names.length > 1) await new Promise((r) => setTimeout(r, 90)); } // Scryfall asks for ~10 req/s max
    return out;
  }

  // ---------- pasted text (deck export) or typed names ----------
  // Recognised: a "Commander"/"Commanders" section (Arena / Moxfield / MTGO-style exports, "// Commander", "Commander:"),
  // Archidekt category tags "[Commander]" / "[Commander{top}]", and the *CMDR* / "# !Commander" markers.
  const HEADER = /^(?:\/\/\s*|#+\s*)?([a-z][a-z ()/0-9-]*?)\s*:?\s*(?:\(\d+\))?\s*$/i;
  const SECTION_NAMES = /^(commanders?|commander\(s\)|deck|main ?deck|mainboard|main|sideboard|side ?board|maybe ?board|maybe|considering|companions?|tokens?|creatures?|lands?|instants?|sorcer(y|ies)|artifacts?|enchantments?|planeswalkers?|battles?|others?|about|name .*)$/i;
  function cardName(line) {
    let s = line.replace(/\s+#.*$/, '').replace(/\*[A-Z]+\*/g, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/\^[^^]*\^/g, ' ');
    s = s.replace(/^\s*(?:SB:\s*)?\d+\s*x?\s+/i, ''); // quantity
    s = s.replace(/\s+\([A-Za-z0-9]{2,6}\)(\s+[A-Za-z0-9★-]+)?(\s+\*?[fFeE]\*?)?\s*$/, ''); // (SET) 123 [foil]
    s = s.replace(/\s+<[^>]*>\s*$/, '');
    return cleanName(s.split(' // ')[0].split(' / ')[0]);
  }
  function parseText(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n').map((l) => l.trim());
    const nonEmpty = lines.filter(Boolean);
    if (!nonEmpty.length) throw new ImportError('empty');
    const found = [];
    const add = (n) => { if (n && !found.some((x) => x.toLowerCase() === n.toLowerCase())) found.push(n); };
    let deckName = '';
    // markers on card lines
    for (const l of nonEmpty) {
      if (/\[[^\]]*\bcommanders?\b[^\]]*\]/i.test(l) || /\*CMDR\*/i.test(l) || /#\s*!commander\b/i.test(l)) add(cardName(l));
      const nm = l.match(/^name\s*[:=]\s*(.+)$/i); if (nm && !deckName) deckName = cleanName(nm[1]).slice(0, 60);
    }
    // a Commander section: every card line until the next header or blank line after cards
    if (!found.length) {
      let inCmd = false, seen = 0;
      for (const l of lines) {
        const h = !/^\s*\d/.test(l) && l.match(HEADER);
        if (h && SECTION_NAMES.test(h[1].trim())) { inCmd = /^commanders?$|^commander\(s\)$/i.test(h[1].trim()); seen = 0; continue; }
        if (!inCmd) continue;
        if (!l) { if (seen) inCmd = false; continue; }
        add(cardName(l)); seen++;
      }
    }
    // just one or two lines without quantities: typed commander names ("Atraxa" or "Tymna / Thrasios" on one line)
    if (!found.length && nonEmpty.length <= 2 && nonEmpty.every((l) => !/^\d+\s*x?\s/i.test(l) && l.length <= 90)) {
      const parts = nonEmpty.length === 1 && /\s(\+|&|\/|and)\s/i.test(nonEmpty[0]) && !nonEmpty[0].includes(' // ') ? nonEmpty[0].split(/\s(?:\+|&|\/|and)\s/i) : nonEmpty;
      parts.map(cleanName).filter(Boolean).forEach(add);
      if (found.length) return { commanders: found.slice(0, 2), typed: true, name: '' };
    }
    if (!found.length) throw new ImportError('text_no_commander');
    return { commanders: found.slice(0, 2), extra: Math.max(0, found.length - 2), name: deckName, typed: false };
  }
  async function fromText(text, opts = {}) {
    const parsed = parseText(text);
    if (isOffline()) throw new ImportError('offline');
    const cards = await scryfallCards(parsed.commanders, opts);
    return {
      source: 'text', site: parsed.typed ? 'Scryfall' : 'deck text', id: '', url: '', name: parsed.name || '',
      commanders: cards.map((c) => ({ name: c.name, colors: c.colors })), colors: union(...cards.map((c) => c.colors)),
      bracket: null, bracketAuto: false, extra: parsed.extra || 0, typed: parsed.typed,
    };
  }

  // One entry point for the import field: a link, a pasted deck export, or typed names.
  async function importAny(input, opts = {}) {
    const s = String(input || '').trim();
    if (!s) throw new ImportError('empty');
    const ref = parseLink(s);
    if (ref && ref.error) throw new ImportError(ref.error, { site: ref.site, host: ref.host });
    if (ref) return fetchDeck(ref, opts);
    return fromText(s, opts);
  }

  // Friendly message for an ImportError (HTML-safe: callers escape nothing, so only fixed text + escaped values here)
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function message(err) {
    const code = (err && err.code) || 'network'; const info = (err && err.info) || {}; const site = esc(info.site || 'The deck site');
    switch (code) {
      case 'offline': return 'Needs internet to import.';
      case 'network': return 'Couldn’t reach the import service. Needs internet to import. Check your connection and try again.';
      case 'empty': return 'Paste an Archidekt or Moxfield deck link first.';
      case 'bad_url': return `That isn’t a valid ${info.site ? site + ' ' : 'Archidekt or Moxfield '}deck link. Copy the link from the deck page and try again.`;
      case 'no_deck': return `That ${site} link doesn’t point to a deck. Open the deck itself and copy its link.`;
      case 'unsupported': return `Only Archidekt and Moxfield links can be imported${info.host ? ` (not ${esc(info.host)})` : ''}. You can also paste the deck’s text export.`;
      case 'not_found': return `Deck not found on ${site}. Check the link: the deck may have been deleted, or it’s private.`;
      case 'private': return `That deck is private on ${site}. Make it public or unlisted there, or paste its text export instead.`;
      case 'no_commander': return `Found the deck${info.name ? ` “${esc(info.name)}”` : ''}, but it has no commander set on ${site}.`;
      case 'blocked': return `${site} turned the request away just now (its bot protection). Try again in a minute, or paste the deck’s text export instead.`;
      case 'busy': return `${site} is busy right now. Try again in a minute.`;
      case 'timeout': return `${info.site ? site : 'The import'} took too long to answer. Try again.`;
      case 'text_no_commander': return 'Couldn’t find the commander in that text. Use an export with a “Commander” section, or just type the commander’s name.';
      case 'card_not_found': return `Scryfall doesn’t know a card called “${esc(info.name)}”. Check the spelling.`;
      case 'ambiguous': return `“${esc(info.name)}” matches several cards. Type more of the name.`;
      case 'scryfall': return 'Couldn’t check the card on Scryfall right now. Try again.';
      case 'cancelled': return '';
      default: return `Couldn’t read that deck from ${site} right now. Try again later.`;
    }
  }

  window.EDHImport = { parseLink, parseText, fetchDeck, fromText, importAny, message, cleanLink, linkSite, canonical, ciString, ImportError, PROXY, LINK_RE };
})();
