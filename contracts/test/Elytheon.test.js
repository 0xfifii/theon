const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const E = (n) => ethers.parseEther(String(n));
const UNI_FACTORY = require("@uniswap/v2-core/build/UniswapV2Factory.json");
const UNI_PAIR = require("@uniswap/v2-core/build/UniswapV2Pair.json");
const UNI_ROUTER = require("@uniswap/v2-periphery/build/UniswapV2Router02.json");
const WETH9 = require("@uniswap/v2-periphery/build/WETH9.json");
const DEAD = "0x000000000000000000000000000000000000dEaD";

function meta(name = "Zeus Coin", symbol = "ZEUS") {
  return {
    name,
    symbol,
    imageURI: "ipfs://zeus.png",
    description: "King of the Pantheon",
    website: "https://example.com",
    twitter: "https://x.com/zeus",
    telegram: "",
  };
}

async function deployDex(deployer) {
  const weth = await new ethers.ContractFactory(WETH9.abi, WETH9.bytecode, deployer).deploy();
  const factory = await new ethers.ContractFactory(UNI_FACTORY.abi, UNI_FACTORY.bytecode, deployer).deploy(deployer.address);
  const router = await new ethers.ContractFactory(UNI_ROUTER.abi, UNI_ROUTER.bytecode, deployer).deploy(
    await factory.getAddress(),
    await weth.getAddress()
  );
  return { weth, factory, router };
}

async function setup({ withRouter = true } = {}) {
  const [owner, treasury, creator, alice, bob, carol, ...rest] = await ethers.getSigners();
  const dex = await deployDex(owner);
  const Launchpad = await ethers.getContractFactory("ElytheonLaunchpad");
  const lp = await Launchpad.deploy(treasury.address, withRouter ? await dex.router.getAddress() : ethers.ZeroAddress);
  return { lp, dex, owner, treasury, creator, alice, bob, carol, rest };
}

async function create(lp, signer, value = 0n, m = meta()) {
  const tx = await lp.connect(signer).createToken(m, 0, { value });
  const rc = await tx.wait();
  const ev = rc.logs.map((l) => { try { return lp.interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === "TokenCreated");
  const token = await ethers.getContractAt("ElytheonToken", ev.args.token);
  return token;
}

async function pastProtection() {
  await time.increase(61);
}

// Sum every HYPE the launchpad owes; its balance must always cover it.
async function owed(lp, creators, tokens) {
  let sum = await lp.protocolFees();
  for (const c of creators) sum += await lp.creatorFees(c);
  for (const t of tokens) {
    const c = await lp.curves(t);
    if (!c.migrated) sum += c.realHype;
  }
  return sum;
}

describe("Elytheon launchpad", function () {
  it("creates a token with fixed supply, metadata and a locked DEX pool", async () => {
    const { lp, dex, creator } = await setup();
    const token = await create(lp, creator);
    const addr = await token.getAddress();

    expect(await token.totalSupply()).to.equal(E(1_000_000_000));
    expect(await token.balanceOf(await lp.getAddress())).to.equal(E(1_000_000_000));
    expect(await token.name()).to.equal("Zeus Coin");
    const m = await lp.getMetadata(addr);
    expect(m.description).to.equal("King of the Pantheon");
    const pair = await dex.factory.getPair(addr, await dex.weth.getAddress());
    expect(pair).to.not.equal(ethers.ZeroAddress);
    expect(await token.pool()).to.equal(pair);
    expect(await lp.tokenCount()).to.equal(1n);
    const list = await lp.getTokens(0, 10);
    expect(list[0].symbol).to.equal("ZEUS");
  });

  it("records the launch block and supports on-chain comments", async () => {
    const { lp, creator, alice } = await setup();
    const token = await create(lp, creator);
    const addr = await token.getAddress();
    const info = await lp.getTokenInfo(addr);
    expect(info.launchBlock).to.be.gt(0n);
    await expect(lp.connect(alice).comment(addr, "to the Pantheon!"))
      .to.emit(lp, "Comment")
      .withArgs(addr, alice.address, "to the Pantheon!", (v) => v > 0n);
    await expect(lp.connect(alice).comment(addr, "")).to.be.revertedWithCustomError(lp, "BadComment");
    await expect(lp.connect(alice).comment(addr, "x".repeat(281))).to.be.revertedWithCustomError(lp, "BadComment");
    await expect(lp.connect(alice).comment(alice.address, "hi")).to.be.revertedWithCustomError(lp, "UnknownToken");
  });

  it("rejects bad names", async () => {
    const { lp, creator } = await setup();
    await expect(lp.connect(creator).createToken(meta("", "X"), 0)).to.be.revertedWithCustomError(lp, "BadName");
    await expect(lp.connect(creator).createToken(meta("Ok", "WAYTOOLONGSYM"), 0)).to.be.revertedWithCustomError(lp, "BadName");
  });

  it("buys match the quote and fees go to creator + platform", async () => {
    const { lp, creator, alice } = await setup();
    const token = await create(lp, creator);
    const addr = await token.getAddress();
    await pastProtection();

    const [q, used, fees, tax] = await lp.quoteBuy(addr, E(1));
    expect(tax).to.equal(0n);
    expect(used).to.equal(E(1));
    expect(fees).to.equal(E(0.01)); // 1% total
    await lp.connect(alice).buy(addr, q, { value: E(1) });
    expect(await token.balanceOf(alice.address)).to.equal(q);
    expect(await lp.creatorFees(creator.address)).to.equal(E(0.005));
    expect(await lp.protocolFees()).to.equal(E(0.005));
    expect((await lp.curves(addr)).realHype).to.equal(E(0.99));
  });

  it("sells return HYPE and keep the launchpad solvent", async () => {
    const { lp, creator, alice } = await setup();
    const token = await create(lp, creator);
    const addr = await token.getAddress();
    await pastProtection();
    await lp.connect(alice).buy(addr, 0, { value: E(5) });
    const bal = await token.balanceOf(alice.address);

    const [hypeOut] = await lp.quoteSell(addr, bal);
    await token.connect(alice).approve(await lp.getAddress(), bal);
    const before = await ethers.provider.getBalance(alice.address);
    const tx = await lp.connect(alice).sell(addr, bal, hypeOut);
    const rc = await tx.wait();
    const after = await ethers.provider.getBalance(alice.address);
    expect(after - before + rc.gasUsed * rc.gasPrice).to.equal(hypeOut);
    expect(await token.balanceOf(alice.address)).to.equal(0n);
    // round trip costs ~2% in fees, never more than you put in
    expect(hypeOut).to.be.lt(E(5));
    expect(hypeOut).to.be.gt(E(4.85));
    expect(await ethers.provider.getBalance(await lp.getAddress())).to.be.gte(await owed(lp, [creator.address], [addr]));
  });

  it("slippage protection reverts", async () => {
    const { lp, creator, alice } = await setup();
    const token = await create(lp, creator);
    const addr = await token.getAddress();
    await pastProtection();
    const [q] = await lp.quoteBuy(addr, E(1));
    await expect(lp.connect(alice).buy(addr, q + 1n, { value: E(1) })).to.be.revertedWithCustomError(lp, "Slippage");
  });

  it("anti-sniper: tax at launch decays to zero, and a wallet cap applies", async () => {
    const { lp, creator, alice, bob } = await setup();
    const token = await create(lp, creator);
    const addr = await token.getAddress();

    const taxNow = await lp.sniperTaxBps(addr);
    expect(taxNow).to.be.gt(1500n); // ~20% right after launch

    // Big buy during protection exceeds the 2% wallet cap
    await expect(lp.connect(alice).buy(addr, 0, { value: E(50) })).to.be.revertedWithCustomError(lp, "WalletCapExceeded");

    // Small buy pays sniper tax, which stays in the curve
    const tx = await lp.connect(bob).buy(addr, 0, { value: E(0.1) });
    const rc = await tx.wait();
    const trade = rc.logs.map((l) => { try { return lp.interface.parseLog(l); } catch { return null; } }).find((e) => e && e.name === "Trade");
    expect(trade.args.sniperTax).to.be.gt(0n);
    expect((await lp.curves(addr)).realHype).to.equal(E(0.1) - trade.args.fees);

    await time.increase(30);
    const taxHalf = await lp.sniperTaxBps(addr);
    expect(taxHalf).to.be.lt(taxNow);
    expect(taxHalf).to.be.gt(0n);

    await time.increase(31);
    expect(await lp.sniperTaxBps(addr)).to.equal(0n);
    await lp.connect(alice).buy(addr, 0, { value: E(50) }); // cap gone after protection
  });

  it("creator's first buy works inside createToken (respects the wallet cap)", async () => {
    const { lp, creator } = await setup();
    const token = await create(lp, creator, E(0.3));
    expect(await token.balanceOf(creator.address)).to.be.gt(0n);
    await expect(lp.connect(creator).createToken(meta("Big", "BIG"), 0, { value: E(40) })).to.be.revertedWithCustomError(lp, "WalletCapExceeded");
  });

  it("nobody can seed the DEX pool before the token ascends", async () => {
    const { lp, creator, alice } = await setup();
    const token = await create(lp, creator);
    await pastProtection();
    await lp.connect(alice).buy(await token.getAddress(), 0, { value: E(1) });
    const pool = await token.pool();
    await expect(token.connect(alice).transfer(pool, 1n)).to.be.revertedWithCustomError(token, "PoolLocked");
    // normal wallet-to-wallet transfers still work
    await token.connect(alice).transfer(creator.address, 1n);
  });

  it("sells out, ascends, adds liquidity on the DEX, burns LP, and trades on the DEX after", async () => {
    const { lp, dex, creator, alice, bob, carol, treasury } = await setup();
    const token = await create(lp, creator);
    const addr = await token.getAddress();
    await pastProtection();

    await lp.connect(alice).buy(addr, 0, { value: E(40) });
    await lp.connect(bob).buy(addr, 0, { value: E(30) });
    const priceBeforeLast = (await lp.getTokenInfo(addr)).price;

    // Overpay: the contract must take only what it needs and refund the rest
    const before = await ethers.provider.getBalance(carol.address);
    const tx = await lp.connect(carol).buy(addr, 0, { value: E(100) });
    const rc = await tx.wait();
    const spent = before - (await ethers.provider.getBalance(carol.address)) - rc.gasUsed * rc.gasPrice;
    expect(spent).to.be.lt(E(40));

    const names = rc.logs.map((l) => { try { return lp.interface.parseLog(l)?.name; } catch { return null; } }).filter(Boolean);
    expect(names).to.include("Ascended");
    expect(names).to.include("Migrated");

    const c = await lp.curves(addr);
    expect(c.complete).to.equal(true);
    expect(c.migrated).to.equal(true);
    expect(c.tokensSold).to.equal(E(800_000_000));
    expect(await token.graduated()).to.equal(true);

    // LP tokens are burned (held by dead address), launchpad holds no leftover tokens
    const pair = new ethers.Contract(await token.pool(), UNI_PAIR.abi, ethers.provider);
    expect(await pair.balanceOf(DEAD)).to.be.gt(0n);
    expect(await token.balanceOf(await lp.getAddress())).to.equal(0n);

    // DEX price ≈ final curve price (within 1%)
    const [r0, r1] = await pair.getReserves();
    const t0 = await pair.token0();
    const [rToken, rHype] = t0.toLowerCase() === addr.toLowerCase() ? [r0, r1] : [r1, r0];
    const dexPrice = (rHype * E(1)) / rToken;
    const finalCurvePrice = (await lp.getTokenInfo(addr)).price;
    expect(finalCurvePrice).to.be.gt(priceBeforeLast);
    const diff = dexPrice > finalCurvePrice ? dexPrice - finalCurvePrice : finalCurvePrice - dexPrice;
    expect(diff * 100n).to.be.lt(finalCurvePrice);

    // Curve trading is closed
    await expect(lp.connect(alice).buy(addr, 0, { value: E(1) })).to.be.revertedWithCustomError(lp, "CurveComplete");

    // Token now trades on the DEX
    const wethAddr = await dex.weth.getAddress();
    const dl = (await time.latest()) + 600;
    await dex.router.connect(alice).swapExactETHForTokens(0, [wethAddr, addr], alice.address, dl, { value: E(1) });
    const aBal = await token.balanceOf(alice.address);
    await token.connect(alice).approve(await dex.router.getAddress(), aBal);
    await dex.router.connect(alice).swapExactTokensForETH(aBal / 2n, 0, [addr, wethAddr], alice.address, dl);

    // Fees: creator claims, treasury receives platform fees; launchpad ends with ~0 HYPE
    await lp.connect(creator).claimCreatorFees();
    const tBefore = await ethers.provider.getBalance(treasury.address);
    const pf = await lp.protocolFees();
    await lp.withdrawProtocolFees();
    expect((await ethers.provider.getBalance(treasury.address)) - tBefore).to.equal(pf);
    expect(await ethers.provider.getBalance(await lp.getAddress())).to.equal(0n);
  });

  it("if no router is set, the token waits and can be migrated later", async () => {
    const { lp, dex, creator, alice } = await setup({ withRouter: false });
    const token = await create(lp, creator);
    const addr = await token.getAddress();
    await pastProtection();
    await lp.connect(alice).buy(addr, 0, { value: E(200) });
    let c = await lp.curves(addr);
    expect(c.complete).to.equal(true);
    expect(c.migrated).to.equal(false);
    await expect(lp.migrate(addr)).to.be.revertedWithCustomError(lp, "NoRouter");

    await lp.setRouter(await dex.router.getAddress());
    await lp.connect(alice).migrate(addr);
    c = await lp.curves(addr);
    expect(c.migrated).to.equal(true);
    await expect(lp.migrate(addr)).to.be.revertedWithCustomError(lp, "AlreadyMigrated");
  });

  it("if the DEX rejects liquidity, the last buy still succeeds and funds wait for a retry", async () => {
    const { lp, dex, creator, alice } = await setup();
    const Broken = await ethers.getContractFactory("BrokenRouter");
    const broken = await Broken.deploy(await dex.factory.getAddress(), await dex.weth.getAddress());
    const token = await create(lp, creator);
    const addr = await token.getAddress();
    await lp.setRouter(await broken.getAddress());
    await pastProtection();
    await expect(lp.connect(alice).buy(addr, 0, { value: E(200) })).to.emit(lp, "MigrationFailed");
    let c = await lp.curves(addr);
    expect(c.complete).to.equal(true);
    expect(c.migrated).to.equal(false);
    expect(await token.balanceOf(await lp.getAddress())).to.equal(E(200_000_000));
    await lp.setRouter(await dex.router.getAddress());
    await lp.migrate(addr);
    expect((await lp.curves(addr)).migrated).to.equal(true);
    expect(await token.graduated()).to.equal(true);
  });

  it("only the owner can change settings, and limits are enforced", async () => {
    const { lp, alice } = await setup();
    await expect(lp.connect(alice).setFees(10, 10, 10, 0)).to.be.revertedWithCustomError(lp, "OwnableUnauthorizedAccount");
    await expect(lp.setFees(200, 200, 0, 0)).to.be.revertedWithCustomError(lp, "BadParam");
    await lp.setCreationPaused(true);
    await expect(lp.connect(alice).createToken(meta(), 0)).to.be.revertedWithCustomError(lp, "CreationPaused");
  });

  it("creation fee is charged and the rest becomes the first buy", async () => {
    const { lp, creator } = await setup();
    await lp.setFees(50, 50, 300, E(0.05));
    await expect(lp.connect(creator).createToken(meta(), 0, { value: E(0.01) })).to.be.revertedWithCustomError(lp, "CreationFeeNotPaid");
    const token = await create(lp, creator, E(0.25));
    expect(await token.balanceOf(creator.address)).to.be.gt(0n);
    expect(await lp.protocolFees()).to.be.gte(E(0.05));
  });

  it("stress: random buys and sells by many wallets — always solvent, everyone can exit", async () => {
    const { lp, creator, rest } = await setup();
    const wallets = rest.slice(0, 8);
    const tokens = [];
    for (let i = 0; i < 3; i++) tokens.push(await create(lp, creator, 0n, meta(`God ${i}`, `G${i}`)));
    await pastProtection();
    const lpAddr = await lp.getAddress();

    let seed = 42;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

    for (let step = 0; step < 120; step++) {
      const w = wallets[Math.floor(rnd() * wallets.length)];
      const t = tokens[Math.floor(rnd() * tokens.length)];
      const addr = await t.getAddress();
      if ((await lp.curves(addr)).complete) continue;
      if (rnd() < 0.6) {
        const v = E((rnd() * 4 + 0.01).toFixed(4));
        await lp.connect(w).buy(addr, 0, { value: v });
      } else {
        const bal = await t.balanceOf(w.address);
        if (bal === 0n) continue;
        const amt = (bal * BigInt(Math.floor(rnd() * 100) + 1)) / 100n;
        await t.connect(w).approve(lpAddr, amt);
        await lp.connect(w).sell(addr, amt, 0);
      }
      const addrs = await Promise.all(tokens.map((x) => x.getAddress()));
      expect(await ethers.provider.getBalance(lpAddr)).to.be.gte(await owed(lp, [creator.address], addrs));
    }

    // Everyone exits fully
    for (const t of tokens) {
      const addr = await t.getAddress();
      if ((await lp.curves(addr)).complete) continue;
      for (const w of wallets) {
        const bal = await t.balanceOf(w.address);
        if (bal === 0n) continue;
        await t.connect(w).approve(lpAddr, bal);
        await lp.connect(w).sell(addr, bal, 0);
      }
      const c = await lp.curves(addr);
      expect(c.tokensSold).to.equal(0n);
    }
    const addrs = await Promise.all(tokens.map((x) => x.getAddress()));
    expect(await ethers.provider.getBalance(lpAddr)).to.be.gte(await owed(lp, [creator.address], addrs));
  });
});
