// shared helpers for the ZOOPAD API: JSON replies, body parsing, the pump.fun SDK, and the sanctuary fund wallets.
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const IDS = ['bigcatrescue', 'turpentine', 'gorillafund', 'bornfreeusa', 'fourpaws'];
const RPC = (process.env.RPC_URL || 'https://solana-rpc.publicnode.com').split(',')[0].trim();

function send(res, code, obj, cache) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', cache || 'no-store');
  res.end(JSON.stringify(obj));
}
async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const c = []; for await (const x of req) c.push(x);
  try { return JSON.parse(Buffer.concat(c).toString() || '{}'); } catch { return {}; }
}
// fund wallets: ZOOPAD_FUNDS='{"bigcatrescue":"<address>",...}' and/or ZOOPAD_FUND_BIGCATRESCUE=<address>
function funds() {
  const out = {};
  try {
    const j = JSON.parse(process.env.ZOOPAD_FUNDS || '{}');
    for (const id of IDS) if (j && B58.test(String(j[id] || '').trim())) out[id] = String(j[id]).trim();
  } catch (e) {}
  for (const id of IDS) {
    const v = String(process.env['ZOOPAD_FUND_' + id.toUpperCase()] || '').trim();
    if (B58.test(v)) out[id] = v;
  }
  return out;
}
function sdk() {
  const P = require('@pump-fun/pump-sdk');
  const { Connection } = require('@solana/web3.js');
  const conn = new Connection(RPC, 'confirmed');
  return { P, conn, online: new P.OnlinePumpSdk(conn), offline: P.PUMP_SDK || new P.PumpSdk() };
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
module.exports = { send, body, funds, sdk, withTimeout, IDS, B58, RPC };
