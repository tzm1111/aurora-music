const VERSION = /\b(?:live|re[\s-]?master(?:ed)?|demo|acoustic|instrumental|cover|karaoke|remix|edit|version|ver|mono|stereo|deluxe|session|sessions|feat|featuring|originally performed)\b|\bfrom\s+["'“]|现场|演唱会|重制|重录|翻唱|伴奏|纯音乐版|吉他版|钢琴版|试听|特别版/iu;
function normalize(text) {
  return String(text || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}
export function songKey(track) {
  const title = String(track.title || '').normalize('NFKC')
    .replace(/\([^)]*\)|\[[^\]]*\]|【[^】]*】/gu, part => VERSION.test(part) ? '' : part)
    .replace(/\s+[-–—]\s+(.+)$/u, (part, suffix) => VERSION.test(suffix) ? '' : part);
  return normalize(title) || String(track.id || '');
}
export function artistKeys(track) {
  return [...new Set(String(track.artist || '').split(/\s*\/\s*|、|;|\s+(?:feat\.?|featuring|ft\.?)\s+/iu).map(normalize)
    .filter(key => key && !['variousartists', '群星', '未知艺术家', 'unknownartist'].includes(key)))];
}
export function dedupeSongs(tracks, excludedTracks = []) {
  const seen = new Set(excludedTracks.map(songKey));
  return tracks.filter(track => { const key = songKey(track); if (seen.has(key)) return false; seen.add(key); return true; });
}
export function selectDiverseTracks(tracks, { limit = 10, recentTracks = [], maxPerArtist = 2 } = {}) {
  const recentArtists = new Set(recentTracks.flatMap(artistKeys));
  const ranked = [...tracks].sort((a, b) => Number(Boolean(a.preview)) - Number(Boolean(b.preview))
    || Number(artistKeys(a).some(key => recentArtists.has(key))) - Number(artistKeys(b).some(key => recentArtists.has(key)))
    || Number(VERSION.test(a.title)) - Number(VERSION.test(b.title)));
  const candidates = dedupeSongs(ranked, recentTracks);
  const counts = new Map(), selected = [], used = new Set();
  // 第一轮尽量每位歌手只选一首；不足时最多两首，不靠重复作品凑满。
  for (let cap = 1; cap <= maxPerArtist && selected.length < limit; cap++) {
    for (const track of candidates) {
      if (used.has(track)) continue;
      const artists = artistKeys(track);
      if (artists.some(key => (counts.get(key) || 0) >= cap)) continue;
      selected.push(track); used.add(track);
      artists.forEach(key => counts.set(key, (counts.get(key) || 0) + 1));
      if (selected.length >= limit) break;
    }
  }
  return selected;
}
