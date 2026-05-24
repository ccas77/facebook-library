'use client';

import { useState, useMemo, useEffect } from 'react';
import postsData from '../posts.json';

type Post = {
  r: number; d: string; t: 'photo' | 'reel';
  l: number; c: number; s: number; v: number; e: number;
  cap: string; ocr: string; img: string; url: string; id: string;
};

const posts = postsData as Post[];

type SortKey = 'r' | 'e' | 'l' | 'c' | 's' | 'v' | 'd';
type SortDir = 'asc' | 'desc';

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
  const [sortKey, setSortKey] = useState<SortKey>('e');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Post | null>(null);
  const [genre, setGenre] = useState(genres[0]);
  const [customGenre, setCustomGenre] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let arr = posts;
    if (filterType !== 'all') arr = arr.filter(p => p.t === filterType);
    if (q) {
      arr = arr.filter(p =>
        p.cap.toLowerCase().includes(q) ||
        p.ocr.toLowerCase().includes(q)
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
  }, [search, filterType, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(k);
      setSortDir(k === 'd' ? 'desc' : 'desc');
    }
  }

  function arrow(k: SortKey) {
    if (sortKey !== k) return null;
    return <span className="arrow">{sortDir === 'desc' ? '▼' : '▲'}</span>;
  }

  function openRewrite() {
    if (!selected) return;
    const targetGenre = customGenre.trim() || genre;
    const source = selected.ocr || selected.cap || '(no text on this post)';
    const prompt = `I'm building social posts for a book account. Below is a post from a romantasy/dark-romance book page. Rewrite it for a "${targetGenre}" book account instead — keep the same emotional hook, format, and tone, but swap genre references so it fits ${targetGenre}.

Original post text:
"""
${source}
"""

Give me 3 variations I can choose from.`;
    const url = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
    window.open(url, '_blank');
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelected(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
        <div className="count">{filtered.length} of {posts.length} posts</div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="rank-cell sortable" onClick={() => toggleSort('r')}>#{arrow('r')}</th>
              <th className="thumb-cell"></th>
              <th className="sortable num" onClick={() => toggleSort('e')}>Engagement{arrow('e')}</th>
              <th className="sortable num" onClick={() => toggleSort('l')}>Likes{arrow('l')}</th>
              <th className="sortable num" onClick={() => toggleSort('c')}>Comments{arrow('c')}</th>
              <th className="sortable num" onClick={() => toggleSort('s')}>Shares{arrow('s')}</th>
              <th className="sortable num" onClick={() => toggleSort('v')}>Views{arrow('v')}</th>
              <th>Type</th>
              <th className="sortable" onClick={() => toggleSort('d')}>Date{arrow('d')}</th>
              <th>Caption</th>
              <th>Text in image</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={11}><div className="empty-state">Nothing matches.</div></td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id || p.r} onClick={() => setSelected(p)}>
                <td className="rank-cell">{p.r}</td>
                <td>
                  {p.img ? <img className="thumb" src={proxied(p.img)} alt="" loading="lazy" /> : null}
                </td>
                <td className="num num-big">{fmt(p.e)}</td>
                <td className="num">{fmt(p.l)}</td>
                <td className="num">{fmt(p.c)}</td>
                <td className="num">{fmt(p.s)}</td>
                <td className="num">{p.v ? fmt(p.v) : '—'}</td>
                <td><span className={`type-badge ${p.t}`}>{p.t}</span></td>
                <td className="date">{p.d}</td>
                <td><div className="cap">{p.cap || <em style={{color:'var(--ink-soft)'}}>—</em>}</div></td>
                <td><div className="ocr">{p.ocr || <em style={{color:'var(--ink-soft)'}}>—</em>}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="detail">
            <div className="close">
              <h2>Post #{selected.r}</h2>
              <button onClick={() => setSelected(null)} aria-label="Close">✕</button>
            </div>

            {selected.img && (
              <img className="detail-img" src={proxied(selected.img)} alt="" />
            )}

            <div className="stats-row">
              <div className="stat"><div className="v">{fmt(selected.e)}</div><div className="l">Engagement</div></div>
              <div className="stat"><div className="v">{fmt(selected.l)}</div><div className="l">Likes</div></div>
              <div className="stat"><div className="v">{fmt(selected.c)}</div><div className="l">Comments</div></div>
              <div className="stat"><div className="v">{fmt(selected.s)}</div><div className="l">Shares</div></div>
              {selected.v > 0 && <div className="stat"><div className="v">{fmt(selected.v)}</div><div className="l">Views</div></div>}
            </div>

            <div className="section">
              <div className="section-label">Caption</div>
              <div className={`body ${!selected.cap ? 'empty' : ''}`}>{selected.cap || '(no caption)'}</div>
            </div>

            <div className="section">
              <div className="section-label">Text in image</div>
              <div className={`body ocr-body ${!selected.ocr ? 'empty' : ''}`}>{selected.ocr || '(no text detected in the image)'}</div>
            </div>

            <div className="rewrite-box">
              <h3>Rewrite for another genre</h3>
              <p>Opens Claude with this post's text pre-loaded and a rewrite prompt for the genre you pick.</p>
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
