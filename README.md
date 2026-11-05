# Elytheon — The Pantheon of Elysium

A fair-launch token launchpad for **Elysium** (Kinetiq's Hyperliquid L2, gas in HYPE).

- **Forge**: anyone launches a token in one click. 1B supply, 800M sold on a HYPE bonding curve, 200M kept for DEX liquidity. No presale, no team tokens.
- **Sniper shield**: for the first 60 seconds every wallet is capped at 2% of supply, and buys pay a sniper tax that starts at 20% and falls to 0. The tax stays in the curve, which raises the price for holders.
- **Creator rewards**: 0.5% of every trade goes to the token's creator (claim on "My Altar"). 0.5% goes to the platform.
- **Ascension**: when the curve sells out, the token "ascends to the Pantheon". Liquidity is added to a Uniswap-V2-style DEX automatically and the LP tokens are burned forever.

```
elytheon/
├── contracts/   Solidity smart contracts + tests + deploy scripts (Hardhat)
└── web/         The website (Next.js, royal blue & white, very interactive)
```

---

## 1. Run the website on your computer (demo mode)

You need **Node.js 20+** (nodejs.org).

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000. With no contract address set, the site runs in **demo mode**: a simulated market using the exact same math as the smart contract, with 100 play HYPE in a demo wallet. You can launch tokens, buy, sell, watch tokens ascend, and claim creator fees.

## 2. Test the smart contracts

```bash
cd contracts
npm install
npm test
```

15 tests cover: on-chain comments, creating tokens, buys and sells matching quotes, fees, slippage, the sniper tax and wallet cap, blocking anyone from seeding the DEX pool early, selling out and ascending to a **real Uniswap V2** DEX (LP burned, price continuous, DEX trading afterwards), a broken DEX not trapping funds, owner-only settings, and a 120-trade stress test proving the contract always holds enough HYPE for everyone to exit.

## 3. Deploy on Elysium testnet — from the website (no command line)

1. Put the site online first (step 5 below), or run it on your computer.
2. In MetaMask/Rabby, get free testnet HYPE from the **faucet** (https://elysium.kinetiq.xyz/testnet-faucet) and bridge it to Elysium (https://elysium.kinetiq.xyz/testnet-bridge).
3. Open **/deploy** on your site (also linked in the footer), connect the wallet that should own the launchpad, and click **Deploy**.
   - "Elytheon DEX" (default) also deploys a Uniswap-V2 DEX so tokens can ascend today. When Nest launches a V2-compatible router, switch to it on **/admin**.
   - Your wallet asks you to confirm 4 transactions. If it stops halfway, click Deploy again — finished steps are skipped.
4. Click **Try it now in this browser** to test right away, and copy the 3 settings it shows.

## 4. Point everyone at your contract

In **Vercel → your project → Settings → Environment Variables**, add the 3 values from the deploy page:

```
NEXT_PUBLIC_LAUNCHPAD_ADDRESS=0x...
NEXT_PUBLIC_DEPLOY_BLOCK=12345
NEXT_PUBLIC_CHAIN_ID=99801
```

Then **Deployments → ⋯ → Redeploy**. The badge in the top bar changes from **Demo market** to **Elysium live**, and every button sends real transactions.

(Advanced alternative: `cd contracts && npm run deploy:testnet` with `PRIVATE_KEY` in `contracts/.env`.)

## Admin page (/admin)

Connect the owner wallet to: withdraw platform fees, pause/resume new launches, set or switch the DEX router (e.g. to Nest), push a sold-out token to the DEX, change fees, the sniper shield and the curve for new launches.

## What works on-chain

Launch a token (image stored on-chain) · buy/sell on the bonding curve · sniper shield · creator fees + claim · on-chain comments · real holder list from transfers · full trade history and charts · automatic ascension to the DEX with LP burned · buying/selling ascended tokens on the DEX right on the token page.

## 5. Put the website online (Vercel)

1. Push the project to GitHub.
2. On vercel.com: **Add New → Project**, pick the repo, set **Root Directory = `web`**.
3. Under **Environment Variables**, add the same `NEXT_PUBLIC_...` values from step 4.
4. Click **Deploy**. Add your domain under **Settings → Domains**.

---

## DEX router (graduation)

When a token sells out, the contract adds liquidity through a **Uniswap-V2-compatible router**. Before mainnet, find out whether Nest or Dawn (the Elysium DEXs) offer a V2-style router (`addLiquidityETH`, `factory()`, `WETH()`). Then run:

```bash
LAUNCHPAD=0x... ROUTER=0x... npx hardhat run scripts/set-router.js --network elysiumTestnet
```

- If no router is set, tokens still launch and trade. A sold-out token waits safely, and anyone can call `migrate(token)` once the router is set.
- Set the router **before** going public. Tokens created while a router is set have their DEX pool locked from the first second, so nobody can pre-seed it at a fake price.
- If the DEX ever rejects the liquidity, the buy still succeeds and the funds wait for a retry (tested).

## Mainnet (Elysium launches November 9, 2026)

When Kinetiq publishes the mainnet chain ID and RPC, fill `ELYSIUM_MAINNET_RPC` and `ELYSIUM_MAINNET_CHAIN_ID` in `contracts/.env`, run `npm run deploy:mainnet`, then update the website's environment variables (chain ID, RPC, explorer, contract address, deploy block) on Vercel.

## Owner settings (all have safety limits)

| Function | What it changes | Limit |
|---|---|---|
| `setFees(platform, creator, graduation, creationFee)` | trade fees in bps, ascension fee, launch fee | platform + creator ≤ 3%, graduation ≤ 10% |
| `setProtection(taxStart, window, maxWallet)` | sniper shield | tax ≤ 50%, window ≤ 10 min, cap ≥ 0.1% |
| `setCurve(virtualHype, virtualToken)` | curve shape for **new** launches only | — |
| `setRouter`, `setTreasury`, `setCreationPaused` | DEX, fee wallet, pause launches | — |
| `withdrawProtocolFees()` | sends platform fees to the treasury | — |

Default curve: starts at about 28 HYPE market cap and ascends at about 88 HYPE raised (≈ 430 HYPE market cap). Change it with `setCurve` to fit the HYPE price at launch.

## Local test chain (optional)

```bash
cd contracts
npx hardhat node                                              # terminal 1
npx hardhat run scripts/local-demo.js --network localhost     # terminal 2
```

Paste the printed values into `web/.env.local` (plus `NEXT_PUBLIC_CHAIN_ID=31337` and `NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545`) to run the website live against your own local chain.

## Before real money

- **Get an audit.** The contracts are tested, but they have not been audited. At minimum, get a community review before promoting the mainnet launch.
- Token pages load their full history straight from the chain (from the token's launch block). The home feed shows roughly the last 11 hours. At large scale, add an indexer (Goldsky, Envio, Hypedexer) later.
- The anti-sniper cap is per wallet. A determined bot can split across wallets, but the decaying tax still makes sniping expensive.
- Elytheon is independent and not affiliated with Kinetiq or Hyperliquid.
