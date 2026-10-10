// every published sanctuary fund wallet, read live: SOL in the wallet and creator fees still waiting in pump.fun's
// vaults (bonding curve + PumpSwap, via the official SDK), plus the SOL price. A failed read comes back as null.
const { send, funds, sdk, withTimeout } = require('./_util');
const SOL_MINT = 'So11111111111111111111111111111111111111112';
module.exports = async (req, res) => {
  const t0 = Date.now(), F = funds(), ids = Object.keys(F);
  if (!ids.length) return send(res, 200, { ok: true, funds: {}, published: 0 }, 'public, s-maxage=30');
  try {
    const { PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
    const { conn, online } = sdk();
    const price = withTimeout(fetch('https://lite-api.jup.ag/price/v3?ids=' + SOL_MINT).then((r) => r.json()).then((j) => {
      const p = j && j[SOL_MINT] && Number(j[SOL_MINT].usdPrice); return p > 0 ? p : null; }), 5000).catch(() => null);
    const rows = await Promise.all(ids.map(async (id) => {
      const pk = new PublicKey(F[id]);
      const [bal, unc] = await Promise.allSettled([
        withTimeout(conn.getBalance(pk, 'confirmed'), 8000),
        withTimeout(online.getCreatorVaultBalanceBothPrograms(pk), 9000),
      ]);
      return [id, {
        wallet: F[id],
        sol: bal.status === 'fulfilled' ? bal.value / LAMPORTS_PER_SOL : null,
        waiting: unc.status === 'fulfilled' ? Number(unc.value.toString()) / LAMPORTS_PER_SOL : null,
      }];
    }));
    send(res, 200, { ok: true, funds: Object.fromEntries(rows), published: ids.length, solUsd: await price, ms: Date.now() - t0 },
      'public, s-maxage=15, stale-while-revalidate=60');
  } catch (e) {
    send(res, 200, { ok: false, error: String(e.message || e).slice(0, 200), ms: Date.now() - t0 });
  }
};
