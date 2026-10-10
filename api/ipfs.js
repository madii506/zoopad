// coin metadata: forwards the image and fields to pump.fun's metadata upload and returns the metadata URI.
// With ?check=1 it only reports whether the upload service answers (no coin is made).
const { send, body } = require('./_util');
module.exports = async (req, res) => {
  const site = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host || 'zoopad.vercel.app');
  if (req.method === 'GET') {
    try {
      const r = await fetch('https://pump.fun/api/ipfs', { method: 'POST', body: new FormData(), headers: { 'user-agent': 'Mozilla/5.0 zoopad', origin: 'https://pump.fun', referer: 'https://pump.fun/create' }, signal: AbortSignal.timeout(12000) });
      return send(res, 200, { ok: true, status: r.status, reachable: r.status < 500 });
    } catch (e) { return send(res, 200, { ok: false, reachable: false, error: String(e.message || e).slice(0, 160) }); }
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const b = await body(req);
    const m = /^data:(image\/(png|jpe?g|gif|webp));base64,(.+)$/i.exec(b.image || '');
    if (!m) return send(res, 400, { error: 'add a PNG, JPG, GIF or WEBP image' });
    const buf = Buffer.from(m[3], 'base64');
    if (buf.length > 4.2e6) return send(res, 400, { error: 'image is over 4 MB' });
    const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
    const fd = new FormData();
    fd.append('file', new Blob([buf], { type: m[1] }), 'image.' + (m[2] === 'jpeg' ? 'jpg' : m[2]));
    fd.append('name', clean(b.name, 32)); fd.append('symbol', clean(b.symbol, 10)); fd.append('description', clean(b.description, 600));
    if (b.twitter) fd.append('twitter', clean(b.twitter, 200));
    fd.append('website', site); fd.append('showName', 'true');
    const r = await fetch('https://pump.fun/api/ipfs', { method: 'POST', body: fd, headers: { 'user-agent': 'Mozilla/5.0 zoopad', origin: 'https://pump.fun', referer: 'https://pump.fun/create' }, signal: AbortSignal.timeout(25000) });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
    if (!r.ok || !j || !j.metadataUri) return send(res, 502, { error: 'pump.fun metadata upload failed (' + r.status + ')', detail: t.slice(0, 160) });
    send(res, 200, { uri: j.metadataUri, image: j.metadata && j.metadata.image });
  } catch (e) { send(res, 500, { error: String(e.message || e).slice(0, 200) }); }
};
