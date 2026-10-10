// builds the launch transaction: pump.fun create_v2 with the coin's CREATOR set to the chosen sanctuary's public fund
// wallet, so every creator fee the coin earns accrues to that wallet on-chain. Optional first buy by the launcher.
// The launcher's wallet pays and signs; the browser adds the mint keypair's signature. No keys on this server.
const { send, body, funds, sdk } = require('./_util');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const b = await body(req);
    const F = funds();
    const charity = String(b.charity || '');
    if (!F[charity]) return send(res, 409, { error: 'that sanctuary’s fund wallet is not published yet, so launches for it are closed' });
    const { PublicKey, TransactionMessage, VersionedTransaction, ComputeBudgetProgram } = require('@solana/web3.js');
    const BN = require('bn.js');
    const { P, conn, online, offline } = sdk();
    const user = new PublicKey(b.user), mint = new PublicKey(b.mint), creator = new PublicKey(F[charity]);
    const name = String(b.name || '').trim().slice(0, 32), symbol = String(b.symbol || '').trim().replace(/^\$/, '').slice(0, 10);
    const uri = String(b.uri || '');
    if (!name || !symbol) return send(res, 400, { error: 'name and ticker are required' });
    if (!/^https:\/\//.test(uri)) return send(res, 400, { error: 'metadata is missing' });
    const buySol = Math.max(0, Math.min(10, Number(b.buy) || 0));
    let ixs;
    if (buySol > 0) {
      const [global, feeConfig] = await Promise.all([online.fetchGlobal(), online.fetchFeeConfig().catch(() => null)]);
      const solAmount = new BN(Math.round(buySol * 1e9));
      const amount = P.getBuyTokenAmountFromSolAmount({ global, feeConfig, mintSupply: null, bondingCurve: null, amount: solAmount,
        quoteMint: new PublicKey('So11111111111111111111111111111111111111112') });
      ixs = await offline.createV2AndBuyInstructions({ global, mint, name, symbol, uri, creator, user, amount, solAmount, mayhemMode: false });
    } else {
      ixs = [await offline.createV2Instruction({ mint, name, symbol, uri, creator, user, mayhemMode: false })];
    }
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
    // a create + first buy sits right at Solana's 1232-byte packet limit, so the compute-budget instructions are
    // dropped one at a time until it fits (without them the runtime's default compute limit still covers the launch)
    const limit = ComputeBudgetProgram.setComputeUnitLimit({ units: buySol > 0 ? 450000 : 300000 }), price = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 150000 });
    let tx = null;
    for (const pre of [[limit, price], [price], []]) {
      const t = new VersionedTransaction(new TransactionMessage({ payerKey: user, recentBlockhash: blockhash, instructions: [...pre, ...ixs] }).compileToV0Message());
      if (t.serialize().length <= 1232) { tx = t; break; }
    }
    if (!tx) return send(res, 400, { error: 'this launch is too large for one Solana transaction: shorten the name or launch without a first buy' });
    const sim = await conn.simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: true }).catch((e) => ({ value: { err: String(e.message) } }));
    if (sim.value && sim.value.err) {
      const logs = (sim.value.logs || []).slice(-4).join(' | ');
      if (!/insufficient|0x1\b/i.test(JSON.stringify(sim.value.err) + logs)) return send(res, 400, { error: 'pump.fun would reject this launch: ' + JSON.stringify(sim.value.err).slice(0, 120), logs: logs.slice(0, 300) });
    }
    send(res, 200, { tx: Buffer.from(tx.serialize()).toString('base64'), creator: creator.toBase58(), charity, buy: buySol, lastValidBlockHeight });
  } catch (e) { send(res, 500, { error: String(e.message || e).slice(0, 220) }); }
};
