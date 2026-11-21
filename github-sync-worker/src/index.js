import { createRemoteJWKSet, jwtVerify } from 'jose';

const allowedOrigins = new Set(['https://futboldraft.com.tr', 'https://www.futboldraft.com.tr', 'https://ardahan86.github.io']);
function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : 'https://futboldraft.com.tr',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}
function base64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ ok: false, error: 'Yalnızca POST desteklenir.' }, 405, cors);

    const origin = request.headers.get('Origin');
    if (origin && !allowedOrigins.has(origin)) return json({ ok: false, error: 'Bu alan adından istek kabul edilmiyor.' }, 403, cors);

    if (!env.GITHUB_TOKEN) return json({ ok: false, error: 'Cloudflare Worker GITHUB_TOKEN secret ayarlanmamış.' }, 500, cors);
    const auth = request.headers.get('Authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (!match) return json({ ok: false, error: 'Firebase oturum anahtarı gerekli.' }, 401, cors);

    try {
      const { payload } = await jwtVerify(match[1], jwks, {
        issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
        audience: env.FIREBASE_PROJECT_ID
      });
      if (payload.sub !== env.ADMIN_UID || payload.user_id !== env.ADMIN_UID) return json({ ok: false, error: 'Yönetici yetkisi doğrulanamadı.' }, 403, cors);

      const body = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ ok: false, error: 'Geçerli bir istek gövdesi gönderilmedi.' }, 400, cors);
      const isPlayers = body.type === 'players';
      let document, targetPath, commitMessage;
      if (isPlayers) {
        const playersDoc = body.players;
        if (!playersDoc || typeof playersDoc !== 'object' || Array.isArray(playersDoc) || !Array.isArray(playersDoc.players)) return json({ ok: false, error: 'Geçerli bir players.json nesnesi gönderilmedi.' }, 400, cors);
        if (playersDoc.players.length < 1 || playersDoc.players.length > 2000) return json({ ok: false, error: 'Oyuncu sayısı izin verilen aralığın dışında.' }, 400, cors);
        const valid = playersDoc.players.every(p => p && typeof p === 'object' && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.club === 'string' && typeof p.position === 'string' && Number.isFinite(Number(p.overall)) && Number.isFinite(Number(p.attack)) && Number.isFinite(Number(p.defense)));
        if (!valid) return json({ ok: false, error: 'Oyuncu kayıtlarında id, name, club, position, overall, attack ve defense alanları bulunmalı.' }, 400, cors);
        playersDoc.playersCount = playersDoc.players.length;
        document = JSON.stringify(playersDoc, null, 2) + '\n';
        targetPath = env.PLAYERS_PATH || 'players.json';
        commitMessage = 'Yönetici paneli: oyuncu kadrolarını güncelle';
        if (new TextEncoder().encode(document).length > 1_500_000) return json({ ok: false, error: 'Oyuncu dosyası izin verilen boyutu aşıyor.' }, 413, cors);
      } else {
        if (typeof body.config !== 'object' || body.config === null || Array.isArray(body.config)) return json({ ok: false, error: 'Geçerli bir config nesnesi gönderilmedi.' }, 400, cors);
        document = JSON.stringify({ config: body.config }, null, 2) + '\n';
        targetPath = env.CONFIG_PATH || 'site-config.json';
        commitMessage = 'Yönetici paneli: site tasarım ayarlarını senkronize et';
        if (new TextEncoder().encode(document).length > 250_000) return json({ ok: false, error: 'Ayar dosyası izin verilen boyutu aşıyor.' }, 413, cors);
      }

      const { GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH = 'main' } = env;
      if (!GITHUB_OWNER || !GITHUB_REPO) return json({ ok: false, error: 'GitHub depo ayarları eksik.' }, 500, cors);
      const apiBase = `https://api.github.com/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/contents/${targetPath.split('/').map(encodeURIComponent).join('/')}`;
      const headers = {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Futbol-Draft-CMS'
      };
      let sha;
      const current = await fetch(`${apiBase}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, { headers });
      if (current.ok) sha = (await current.json()).sha;
      else if (current.status !== 404) {
        const detail = await current.text();
        return json({ ok: false, error: `GitHub dosyası okunamadı (${current.status}): ${detail.slice(0, 300)}` }, 502, cors);
      }

      const update = await fetch(apiBase, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: commitMessage,
          content: base64Utf8(document),
          branch: GITHUB_BRANCH,
          ...(sha ? { sha } : {})
        })
      });
      const result = await update.json().catch(() => ({}));
      if (!update.ok) return json({ ok: false, error: `GitHub dosyası güncellenemedi (${update.status}): ${result.message || 'Bilinmeyen hata'}` }, 502, cors);
      return json({ ok: true, commit: result.commit?.sha || null, commitUrl: result.commit?.html_url || null, path: targetPath }, 200, cors);
    } catch (error) {
      return json({ ok: false, error: error?.message || 'İstek işlenemedi.' }, 401, cors);
    }
  }
};
