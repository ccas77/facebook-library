'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import postsData from '../posts.json';

type Post = {
  r: number; d: string; t: 'photo' | 'reel';
  l: number; c: number; s: number; v: number; e: number;
  cap: string; ocr: string; img: string; url: string; id: string;
};

const posts = postsData as Post[];

type SortKey = 'r' | 'l' | 'c' | 's' | 'v' | 'd';
type SortDir = 'asc' | 'desc';

const OCR_CACHE_KEY = 'fblib-ocr-cache-v1';
const fmt = (n: number) => n.toLocaleString();
const proxied = (u: string) => u ? `/api/img?u=${encodeURIComponent(u)}` : '';

const genres = [
  'cozy fantasy', 'sci-fi space opera', 'cyberpunk', 'cottagecore',
  'gothic horror', 'historical mystery', 'thriller', 'literary fiction',
  'YA contemporary', 'urban fantasy', 'paranormal romance', 'western',
];

export default function Page() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'photo' | 'reel'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('l');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Post | null>(null);
  const [genre, setGenre] = useState(genres[0]);
  const [customGenre, setCustomGenre] = useState('');

  const [ocrCache, setOcrCache] = useState<Record<string, string>>({});
  const [ocrStatus, setOcrStatus] = useState<Record<string, 'running' | 'error'>>({});
  const [batchSize, setBatchSize] = useState(10);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const batchAbort = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(OCR_CACHE_KEY);
      if (stored) setOcrCache(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(OCR_CACHE_KEY, JSON.stringify(ocrCache));
    } catch {}
  }, [ocrCache]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let arr = posts;
    if (filterType !== 'all') arr = arr.filter(p => p.t === filterType);
    if (q) {
      arr = arr.filter(p =>
        p.cap.toLowerCase().includes(q) ||
        p.ocr.toLowerCase().includes(q) ||
        (ocrCache[p.id] || '').toLowerCase().includes(q)
      );
    }
    arr = [...arr].sort((a, b) => {
      const av = a[sortKey] as any;
      const bv = b[sortKey] as any;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [search, filterType, sortKey, sortDir, ocrCache]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(k);
      setSortDir('desc');
    }
  }

  function arrow(k: SortKey) {
    if (sortKey !== k) return null;
    return <span className="arrow">{sortDir === 'desc' ? '▼' : '▲'}</span>;
  }

  const ocrOne = useCallback(async (post: Post): Promise<boolean> => {
    if (!post.img || ocrCache[post.id]) return true;
    setOcrStatus(s => ({ ...s, [post.id]: 'running' }));
    try {
      const Tesseract = await import('tesseract.js');
      const { data: { text } } = await Tesseract.recognize(proxied(post.img), 'eng');
      const cleaned = text.replace(/\s+/g, ' ').trim();
      setOcrCache(c => ({ ...c, [post.id]: cleaned || '(no text detected)' }));
      setOcrStatus(s => { const x = { ...s }; delete x[post.id]; return x; });
      return true;
    } catch (e) {
      setOcrStatus(s => ({ ...s, [post.id]: 'error' }));
      return false;
    }
  }, [ocrCache]);

  async function runBatch(e: React.MouseEvent) {
    e.stopPropagation();
    if (batchProgress) return;
    const targets = filtered.filter(p => p.img && !ocrCache[p.id]).slice(0, batchSize);
    if (targets.length === 0) return;
    batchAbort.current = false;
    setBatchProgress({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      if (batchAbort.current) break;
      await ocrOne(targets[i]);
      setBatchProgress({ done: i + 1, total: targets.length });
    }
    setBatchProgress(null);
  }

  function cancelBatch() {
    batchAbort.current = true;
  }

  function clearCache() {
    if (confirm('Clear all OCR results? This cannot be undone.')) {
      setOcrCache({});
      try { localStorage.removeItem(OCR_CACHE_KEY); } catch {}
    }
  }

  function escapeCsv(v: any) {
    const s = String(v ?? '');
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  function downloadOcrCsv() {
    const rows: any[][] = [];
    rows.push(['rank', 'likes', 'comments', 'shares', 'views', 'type', 'date', 'caption', 'ocr_text', 'post_url', 'image_url']);
    for (const p of filtered) {
      const ocr = ocrCache[p.id];
      if (!ocr) continue;
      rows.push([p.r, p.l, p.c, p.s, p.v, p.t, p.d, p.cap, ocr, p.url, p.img]);
    }
    if (rows.length <= 1) {
      alert('No OCR text in the current view to download. Run OCR on some posts first, or adjust your filters.');
      return;
    }
    const csv = '\uFEFF' + rows.map(r => r.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facebook-library-ocr-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function openRewrite() {
    if (!selected) return;
    const targetGenre = customGenre.trim() || genre;
    const source = ocrCache[selected.id] || selected.cap || '(no text on this post)';
    const prompt = `I'm building social posts for a book account. Below is a post from a romantasy/dark-romance book page. Rewrite it for a "${targetGenre}" book account instead — keep the same emotional hook, format, and tone, but swap genre references so it fits ${targetGenre}.

Original post text:
"""
${source}
"""

Give me 3 variations I can choose from.`;
    const url = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
    window.open(url, '_blank');
  }

  const currentIdx = selected ? filtered.findIndex(p => p.id === selected.id) : -1;
  const canGoPrev = currentIdx > 0;
  const canGoNext = currentIdx >= 0 && currentIdx < filtered.length - 1;

  const goPrev = useCallback(() => {
    if (canGoPrev) setSelected(filtered[currentIdx - 1]);
  }, [canGoPrev, currentIdx, filtered]);

  const goNext = useCallback(() => {
    if (canGoNext) setSelected(filtered[currentIdx + 1]);
  }, [canGoNext, currentIdx, filtered]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (batchProgress) cancelBatch();
        else setSelected(null);
        return;
      }
      if (selected && (e.metaKey || e.ctrlKey)) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          goNext();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goPrev();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [batchProgress, selected, goNext, goPrev]);

  const cachedCount = Object.keys(ocrCache).length;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus the OCR textarea whenever a post is opened or we navigate
  useEffect(() => {
    if (selected && ocrCache[selected.id] !== undefined && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      // Place cursor at end without selecting all
      const len = ta.value.length;
      ta.setSelectionRange(len, len);
    }
  }, [selected, ocrCache]);

  return (
    <>
      <div className="header">
        <h1>The Library</h1>
        <div className="sub">My Dark Romantasy — 999 posts, ranked &amp; ready</div>
      </div>

      <div className="controls">
        <label>Search</label>
        <input
          type="text"
          placeholder="caption or image text…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <label>Type</label>
        <select value={filterType} onChange={e => setFilterType(e.target.value as any)}>
          <option value="all">All</option>
          <option value="photo">Photos</option>
          <option value="reel">Reels</option>
        </select>

        <div className="batch-controls">
          <label>OCR next</label>
          <select value={batchSize} onChange={e => setBatchSize(Number(e.target.value))} disabled={!!batchProgress}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          {!batchProgress ? (
            <button onClick={runBatch}>Run OCR</button>
          ) : (
            <>
              <span className="batch-status">OCR {batchProgress.done}/{batchProgress.total}…</span>
              <button onClick={cancelBatch} className="cancel">Stop</button>
            </>
          )}
          {cachedCount > 0 && (
            <>
              <button onClick={downloadOcrCsv} className="download-btn" title="Download OCR text as CSV (respects current filter)">
                ↓ CSV
              </button>
              <button onClick={clearCache} className="ghost" title="Clear OCR cache">Reset OCR</button>
            </>
          )}
        </div>

        <div className="count">{filtered.length} of {posts.length} · {cachedCount} OCR'd</div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="rank-cell sortable" onClick={() => toggleSort('r')}>#{arrow('r')}</th>
              <th className="thumb-cell"></th>
              <th className="sortable num" onClick={() => toggleSort('l')}>Likes{arrow('l')}</th>
              <th className="sortable num" onClick={() => toggleSort('c')}>Comments{arrow('c')}</th>
              <th className="sortable num" onClick={() => toggleSort('s')}>Shares{arrow('s')}</th>
              <th className="sortable num" onClick={() => toggleSort('v')}>Views{arrow('v')}</th>
              <th>Type</th>
              <th className="sortable" onClick={() => toggleSort('d')}>Date{arrow('d')}</th>
              <th>Caption</th>
              <th>Text in image (OCR)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10}><div className="empty-state">Nothing matches.</div></td></tr>
            )}
            {filtered.map((p) => {
              const ocrText = ocrCache[p.id];
              const status = ocrStatus[p.id];
              return (
                <tr key={p.id || p.r} onClick={() => setSelected(p)}>
                  <td className="rank-cell">{p.r}</td>
                  <td>
                    {p.img ? <img className="thumb" src={proxied(p.img)} alt="" loading="lazy" /> : null}
                  </td>
                  <td className="num num-big">{fmt(p.l)}</td>
                  <td className="num">{fmt(p.c)}</td>
                  <td className="num">{fmt(p.s)}</td>
                  <td className="num">{p.v ? fmt(p.v) : '—'}</td>
                  <td><span className={`type-badge ${p.t}`}>{p.t}</span></td>
                  <td className="date">{p.d}</td>
                  <td><div className="cap">{p.cap || <em style={{color:'var(--ink-soft)'}}>—</em>}</div></td>
                  <td>
                    {ocrText ? (
                      <div className="ocr">{ocrText}</div>
                    ) : status === 'running' ? (
                      <span className="ocr-status">running…</span>
                    ) : status === 'error' ? (
                      <button className="ocr-btn" onClick={(e) => { e.stopPropagation(); ocrOne(p); }}>retry</button>
                    ) : p.img ? (
                      <button className="ocr-btn" onClick={(e) => { e.stopPropagation(); ocrOne(p); }}>OCR</button>
                    ) : (
                      <em style={{color:'var(--ink-soft)'}}>—</em>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="detail">
            <div className="close">
              <div className="header-left">
                <h2>Post #{selected.r}</h2>
                <span className="position">{currentIdx + 1} of {filtered.length}</span>
              </div>
              <div className="nav-buttons">
                <button onClick={goPrev} disabled={!canGoPrev} title="Previous (⌘←)" className="nav-btn">←</button>
                <button onClick={goNext} disabled={!canGoNext} title="Next (⌘→)" className="nav-btn">→</button>
                <button onClick={() => setSelected(null)} aria-label="Close" className="close-btn">✕</button>
              </div>
            </div>

            <div className="edit-pane">
              {selected.img && (
                <a href={selected.url} target="_blank" rel="noopener" className="detail-img-wrap" title="Open the original Facebook post">
                  <img className="detail-img" src={proxied(selected.img)} alt="" />
                </a>
              )}

              <div className="ocr-pane">
                <div className="section-label">
                  Text in image (OCR){' '}
                  {!ocrCache[selected.id] && selected.img && ocrStatus[selected.id] !== 'running' && (
                    <button className="ocr-btn-inline" onClick={() => ocrOne(selected)}>
                      {ocrStatus[selected.id] === 'error' ? 'Retry OCR' : 'Run OCR'}
                    </button>
                  )}
                  {ocrCache[selected.id] && (
                    <button
                      className="ocr-btn-inline"
                      onClick={() => {
                        if (confirm('Re-run OCR on this post? Your edits will be lost.')) {
                          setOcrCache(c => { const x = { ...c }; delete x[selected.id]; return x; });
                          ocrOne(selected);
                        }
                      }}
                    >
                      Re-OCR
                    </button>
                  )}
                  {ocrStatus[selected.id] === 'running' && <span className="ocr-status"> running…</span>}
                </div>
                {ocrCache[selected.id] !== undefined ? (
                  <textarea
                    ref={textareaRef}
                    className="ocr-textarea"
                    value={ocrCache[selected.id]}
                    onChange={(e) =>
                      setOcrCache(c => ({ ...c, [selected.id]: e.target.value }))
                    }
                    spellCheck={true}
                    placeholder="OCR text — edit freely, saves as you type"
                  />
                ) : (
                  <div className={`body ocr-body empty`}>
                    {selected.img ? '(click Run OCR above)' : '(no image)'}
                  </div>
                )}
              </div>
            </div>

            <div className="stats-row compact">
              <div className="stat"><div className="v">{fmt(selected.l)}</div><div className="l">Likes</div></div>
              <div className="stat"><div className="v">{fmt(selected.c)}</div><div className="l">Comments</div></div>
              <div className="stat"><div className="v">{fmt(selected.s)}</div><div className="l">Shares</div></div>
              {selected.v > 0 && <div className="stat"><div className="v">{fmt(selected.v)}</div><div className="l">Views</div></div>}
              <div className="stat type-stat">
                <div className="v" style={{textTransform:'capitalize'}}>{selected.t}</div>
                <div className="l">{selected.d}</div>
              </div>
            </div>

            <div className="section">
              <div className="section-label">Caption</div>
              <div className={`body ${!selected.cap ? 'empty' : ''}`}>{selected.cap || '(no caption)'}</div>
            </div>

            <div className="rewrite-box">
              <h3>Rewrite for another genre</h3>
              <p>Uses the OCR text if available, otherwise the caption. Opens Claude in a new tab.</p>
              <div className="rewrite-controls">
                <select value={genre} onChange={(e) => { setGenre(e.target.value); setCustomGenre(''); }}>
                  {genres.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="…or type a custom genre"
                  value={customGenre}
                  onChange={(e) => setCustomGenre(e.target.value)}
                />
                <button onClick={openRewrite}>Rewrite</button>
              </div>
            </div>

            <a className="original-link" href={selected.url} target="_blank" rel="noopener">View original on Facebook →</a>
          </div>
        </div>
      )}
    </>
  );
}
