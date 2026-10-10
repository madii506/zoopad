// public settings from Vercel environment variables: the sanctuary fund wallets, the $ZOOPAD mint, the X handle.
const { send, funds, B58 } = require('./_util');
module.exports = (req, res) => {
  const E = (k) => String(process.env[k] || '').trim();
  const handle = (v) => v.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, '').replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 15);
  send(res, 200, { ok: true, funds: funds(), ca: B58.test(E('ZOOPAD_CA')) ? E('ZOOPAD_CA') : '', x: handle(E('ZOOPAD_X')) },
    'public, s-maxage=60, stale-while-revalidate=300');
};
