const HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>LinkShort Pro</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; }
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:#0b1020; color:#fff; }
    main { width:min(720px,92vw); padding:32px; border:1px solid #26304a; border-radius:20px; background:#121a2f; box-sizing:border-box; }
    h1 { margin-top:0; }
    p { color:#b8c2d9; }
    form { display:grid; gap:12px; }
    input, button { padding:14px 16px; border-radius:12px; border:1px solid #33405e; font-size:16px; box-sizing:border-box; }
    input { background:#0c1325; color:#fff; }
    button { cursor:pointer; background:#fff; color:#101522; font-weight:700; }
    #result { margin-top:18px; padding:14px; border-radius:12px; background:#0c1325; overflow-wrap:anywhere; }
    code { color:#dbe7ff; }
  </style>
</head>
<body>
<main>
  <h1>LinkShort Pro</h1>
  <p>اختصر روابطك بسرعة. النسخة الأولى تعمل على Cloudflare Workers + D1.</p>
  <form id="f">
    <input id="url" type="url" placeholder="https://example.com/long-url" required>
    <input id="slug" pattern="[A-Za-z0-9_-]{3,40}" placeholder="Alias اختياري: youtube" maxlength="40">
    <button>إنشاء الرابط المختصر</button>
  </form>
  <div id="result"></div>
</main>
<script>
const f = document.querySelector('#f');
const r = document.querySelector('#result');
f.addEventListener('submit', async e => {
  e.preventDefault();
  r.textContent = 'جاري الإنشاء...';
  const body = { url: url.value.trim(), slug: slug.value.trim() || undefined };
  try {
    const res = await fetch('/api/links', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'حدث خطأ');
    r.innerHTML = 'تم: <a href="' + data.short_url + '">' + data.short_url + '</a>';
  } catch (err) {
    r.textContent = err.message;
  }
});
</script>
</body>
</html>`;

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function randomSlug(length = 7) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map(b => ALPHABET[b % ALPHABET.length]).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {'content-type': 'application/json; charset=utf-8'}
  });
}

function isValidTarget(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

async function createLink(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({error:'Invalid JSON'}, 400); }

  const target = String(body?.url || '').trim();
  const custom = body?.slug ? String(body.slug).trim() : '';

  if (!isValidTarget(target)) return json({error:'Only valid http/https URLs are allowed'}, 400);

  let slug = custom;
  if (slug && !/^[A-Za-z0-9_-]{3,40}$/.test(slug)) {
    return json({error:'Slug must be 3-40 chars: letters, numbers, _ or -'}, 400);
  }

  if (!slug) slug = randomSlug();

  try {
    await env.DB.prepare(
      'INSERT INTO links (slug, target_url) VALUES (?, ?)'
    ).bind(slug, target).run();
  } catch (e) {
    if (String(e).includes('UNIQUE')) return json({error:'This alias is already in use'}, 409);
    return json({error:'Could not create link'}, 500);
  }

  const origin = new URL(request.url).origin;
  return json({ slug, short_url: origin + '/' + slug });
}

async function redirectLink(slug, env) {
  const row = await env.DB.prepare(
    'SELECT target_url, active FROM links WHERE slug = ? LIMIT 1'
  ).bind(slug).first();

  if (!row || !row.active) return new Response('Link not found', {status:404});

  // Click counting is intentionally lightweight for the first version.
  await env.DB.prepare(
    'UPDATE links SET clicks = clicks + 1, last_clicked_at = CURRENT_TIMESTAMP WHERE slug = ?'
  ).bind(slug).run();

  return Response.redirect(row.target_url, 302);
}

async function adminList(request, env) {
  const token = request.headers.get('authorization');
  if (!token || token !== `Bearer ${env.ADMIN_TOKEN}`) return json({error:'Unauthorized'}, 401);

  const rows = await env.DB.prepare(
    'SELECT slug, target_url, clicks, active, created_at, last_clicked_at FROM links ORDER BY id DESC LIMIT 200'
  ).all();

  return json(rows.results);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(HTML, {headers:{'content-type':'text/html; charset=utf-8'}});
    }

    if (request.method === 'POST' && url.pathname === '/api/links') {
      return createLink(request, env);
    }

    if (request.method === 'GET' && url.pathname === '/api/admin/links') {
      return adminList(request, env);
    }

    if (request.method === 'GET') {
      const slug = decodeURIComponent(url.pathname.slice(1));
      if (/^[A-Za-z0-9_-]{3,40}$/.test(slug)) return redirectLink(slug, env);
    }

    return new Response('Not found', {status:404});
  }
};

