// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ElytheonToken} from "./ElytheonToken.sol";
import {IUniswapV2Router02, IUniswapV2Factory} from "./interfaces/IUniswapV2.sol";

/// @title Elytheon Launchpad — "The Pantheon of Elysium"
/// @notice Fair-launch tokens on a HYPE bonding curve. When a curve sells out the token
///         "ascends to the Pantheon": its liquidity is added to a Uniswap-V2-style DEX
///         and the LP tokens are burned forever.
/// @dev    Every launch has an anti-sniper window: a per-wallet buy cap plus a sniper tax that
///         decays to zero. The tax is left inside the curve, which raises the price for holders.
///         Elysium is an Arbitrum Orbit chain, so we use block.timestamp (block.number there
///         returns the parent-chain block number).
contract ElytheonLaunchpad is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ───────────────────────── errors ─────────────────────────
    error UnknownToken();
    error CurveComplete();
    error CurveNotComplete();
    error AlreadyMigrated();
    error NoRouter();
    error Slippage();
    error ZeroAmount();
    error BadName();
    error CreationFeeNotPaid();
    error CreationPaused();
    error WalletCapExceeded();
    error InsufficientLiquidity();
    error TransferFailed();
    error BadParam();
    error BadComment();

    // ───────────────────────── constants ─────────────────────────
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether; // 1B tokens, 18 decimals
    uint256 public constant CURVE_SUPPLY = 800_000_000 ether;   // sold on the curve
    // the remaining 200M are reserved for DEX liquidity (any unused part is burned)
    uint256 private constant BPS = 10_000;
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    // ───────────────────────── types ─────────────────────────
    struct Curve {
        address creator;
        uint64 launchTime;
        uint64 launchBlock; // L2 block number (lets the website load full history quickly)
        bool complete;   // curve sold out; trading on the curve is closed
        bool migrated;   // liquidity added to the DEX
        uint256 virtualHype0;
        uint256 virtualToken0;
        uint256 realHype;    // HYPE held for this curve (backs sells / becomes liquidity)
        uint256 tokensSold;  // tokens currently held by the public
    }

    struct Metadata {
        string name;
        string symbol;
        string imageURI;
        string description;
        string website;
        string twitter;
        string telegram;
    }

    struct TokenInfo {
        address token;
        address creator;
        string name;
        string symbol;
        string imageURI;
        uint64 launchTime;
        uint64 launchBlock;
        uint256 realHype;
        uint256 tokensSold;
        uint256 price; // HYPE (wei) per 1 whole token (1e18 units)
        uint256 virtualHype0;
        uint256 virtualToken0;
        bool complete;
        bool migrated;
        address pool;
    }

    // ───────────────────────── config (owner) ─────────────────────────
    uint256 public virtualHypeInit = 30 ether;            // starting virtual HYPE reserve
    uint256 public virtualTokenInit = 1_073_000_000 ether; // starting virtual token reserve
    uint16 public platformFeeBps = 50;      // 0.5% of every trade to the platform
    uint16 public creatorFeeBps = 50;       // 0.5% of every trade to the token creator
    uint16 public graduationFeeBps = 300;   // 3% of the raise when a token ascends
    uint16 public sniperTaxStartBps = 2000; // 20% tax on buys at second 0, decays to 0
    uint32 public protectWindow = 60;       // seconds of anti-sniper protection
    uint256 public maxWalletProtected = 20_000_000 ether; // 2% per wallet during protection
    uint256 public creationFee = 0;
    address public router;    // Uniswap-V2-compatible router on Elysium (0 = not set yet)
    address public treasury;
    bool public creationPaused;

    // ───────────────────────── state ─────────────────────────
    mapping(address => Curve) public curves;
    mapping(address => Metadata) private _metadata;
    mapping(address => mapping(address => uint256)) public protectedBought;
    mapping(address => uint256) public creatorFees; // claimable, by creator
    uint256 public protocolFees;                    // claimable by treasury
    address[] public allTokens;

    // ───────────────────────── events ─────────────────────────
    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        string imageURI,
        uint256 timestamp
    );
    event Trade(
        address indexed token,
        address indexed trader,
        bool isBuy,
        uint256 hypeAmount,   // buy: HYPE spent (incl. fees) / sell: HYPE received (after fees)
        uint256 tokenAmount,
        uint256 fees,
        uint256 sniperTax,
        uint256 priceAfter,
        uint256 realHype,
        uint256 tokensSold,
        uint256 timestamp
    );
    event Ascended(address indexed token, uint256 hypeRaised); // curve sold out
    event Migrated(address indexed token, address indexed pool, uint256 hypeLiquidity, uint256 tokenLiquidity, uint256 tokensBurned);
    event MigrationFailed(address indexed token);
    event CreatorFeesClaimed(address indexed creator, uint256 amount);
    event ProtocolFeesWithdrawn(address indexed to, uint256 amount);
    event ConfigUpdated();
    event Comment(address indexed token, address indexed author, string text, uint256 timestamp);

    constructor(address treasury_, address router_) Ownable(msg.sender) {
        treasury = treasury_ == address(0) ? msg.sender : treasury_;
        router = router_;
    }

    receive() external payable {} // router may refund unused HYPE during migration

    // ═════════════════════════ launch ═════════════════════════

    /// @notice Create a token. Any HYPE sent above `creationFee` is used as the creator's first buy.
    function createToken(Metadata calldata meta, uint256 minTokensOut)
        external
        payable
        nonReentrant
        returns (address token)
    {
        if (creationPaused) revert CreationPaused();
        uint256 nameLen = bytes(meta.name).length;
        uint256 symLen = bytes(meta.symbol).length;
        if (nameLen == 0 || nameLen > 32 || symLen == 0 || symLen > 10) revert BadName();
        if (msg.value < creationFee) revert CreationFeeNotPaid();

        ElytheonToken t = new ElytheonToken(meta.name, meta.symbol, TOTAL_SUPPLY);
        token = address(t);

        curves[token] = Curve({
            creator: msg.sender,
            launchTime: uint64(block.timestamp),
            launchBlock: uint64(_l2Block()),
            complete: false,
            migrated: false,
            virtualHype0: virtualHypeInit,
            virtualToken0: virtualTokenInit,
            realHype: 0,
            tokensSold: 0
        });
        _metadata[token] = meta;
        allTokens.push(token);
        protocolFees += creationFee;

        // Lock the future DEX pool right away so nobody can pre-seed it at a fake price.
        if (router != address(0)) _ensurePool(t);

        emit TokenCreated(token, msg.sender, meta.name, meta.symbol, meta.imageURI, block.timestamp);

        uint256 devBuy = msg.value - creationFee;
        if (devBuy > 0) _buy(token, msg.sender, devBuy, minTokensOut);
    }

    // ═════════════════════════ trading ═════════════════════════

    function buy(address token, uint256 minTokensOut) external payable nonReentrant {
        _buy(token, msg.sender, msg.value, minTokensOut);
    }

    function sell(address token, uint256 tokenAmount, uint256 minHypeOut) external nonReentrant {
        Curve storage c = curves[token];
        if (c.creator == address(0)) revert UnknownToken();
        if (c.complete) revert CurveComplete();
        if (tokenAmount == 0) revert ZeroAmount();

        uint256 xV = c.virtualHype0 + c.realHype;
        uint256 yV = c.virtualToken0 - c.tokensSold;
        uint256 gross = (xV * tokenAmount) / (yV + tokenAmount);
        if (gross > c.realHype) revert InsufficientLiquidity();

        uint256 feeP = (gross * platformFeeBps) / BPS;
        uint256 feeC = (gross * creatorFeeBps) / BPS;
        uint256 out = gross - feeP - feeC;
        if (out < minHypeOut || out == 0) revert Slippage();

        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);

        c.tokensSold -= tokenAmount;
        c.realHype -= gross;
        protocolFees += feeP;
        creatorFees[c.creator] += feeC;

        emit Trade(token, msg.sender, false, out, tokenAmount, feeP + feeC, 0, _price(c), c.realHype, c.tokensSold, block.timestamp);
        _send(msg.sender, out);
    }

    function _buy(address token, address buyer, uint256 value, uint256 minTokensOut) internal {
        Curve storage c = curves[token];
        if (c.creator == address(0)) revert UnknownToken();
        if (c.complete) revert CurveComplete();
        if (value == 0) revert ZeroAmount();

        (uint256 out, uint256 used, uint256 feeP, uint256 feeC, uint256 tax, uint256 net) = _quoteBuy(c, value);
        if (out == 0 || out < minTokensOut) revert Slippage();

        // anti-sniper wallet cap
        if (block.timestamp < uint256(c.launchTime) + protectWindow) {
            uint256 bought = protectedBought[token][buyer] + out;
            if (bought > maxWalletProtected) revert WalletCapExceeded();
            protectedBought[token][buyer] = bought;
        }

        c.tokensSold += out;
        c.realHype += net + tax; // sniper tax stays in the curve → price support for holders
        protocolFees += feeP;
        creatorFees[c.creator] += feeC;

        IERC20(token).safeTransfer(buyer, out);
        emit Trade(token, buyer, true, used, out, feeP + feeC, tax, _price(c), c.realHype, c.tokensSold, block.timestamp);

        if (value > used) _send(buyer, value - used); // refund when the curve sells out

        if (c.tokensSold == CURVE_SUPPLY) {
            c.complete = true;
            emit Ascended(token, c.realHype);
            if (router != address(0)) _migrate(token);
        }
    }

    /// @dev returns tokensOut, HYPE actually used, platform fee, creator fee, sniper tax, net HYPE into curve
    function _quoteBuy(Curve storage c, uint256 value)
        internal
        view
        returns (uint256 out, uint256 used, uint256 feeP, uint256 feeC, uint256 tax, uint256 net)
    {
        uint256 taxBps = _sniperTaxBps(c);
        uint256 totalBps = platformFeeBps + creatorFeeBps + taxBps;
        uint256 xV = c.virtualHype0 + c.realHype;
        uint256 yV = c.virtualToken0 - c.tokensSold;
        uint256 remaining = CURVE_SUPPLY - c.tokensSold;

        used = value;
        net = value - (value * totalBps) / BPS;
        out = (yV * net) / (xV + net);

        if (out >= remaining) {
            // Final buy: only take what is needed to buy the last tokens, refund the rest.
            out = remaining;
            uint256 netNeeded = Math.mulDiv(xV, remaining, yV - remaining, Math.Rounding.Ceil);
            uint256 gross = Math.mulDiv(netNeeded, BPS, BPS - totalBps, Math.Rounding.Ceil);
            if (gross < value) used = gross;
        }
        feeP = (used * platformFeeBps) / BPS;
        feeC = (used * creatorFeeBps) / BPS;
        tax = (used * taxBps) / BPS;
        net = used - feeP - feeC - tax;
    }

    // ═════════════════════════ graduation ═════════════════════════

    /// @notice Anyone can push a sold-out token to the DEX (e.g. if the router was set later).
    function migrate(address token) external nonReentrant {
        Curve storage c = curves[token];
        if (c.creator == address(0)) revert UnknownToken();
        if (!c.complete) revert CurveNotComplete();
        if (c.migrated) revert AlreadyMigrated();
        if (router == address(0)) revert NoRouter();
        _migrate(token);
    }

    function _migrate(address token) internal {
        Curve storage c = curves[token];
        ElytheonToken t = ElytheonToken(token);
        IUniswapV2Router02 r = IUniswapV2Router02(router);

        uint256 hype = c.realHype;
        uint256 gradFee = (hype * graduationFeeBps) / BPS;
        uint256 lpHype = hype - gradFee;
        // list on the DEX at the same price the curve ended at
        uint256 tokenLp = (lpHype * (c.virtualToken0 - c.tokensSold)) / (c.virtualHype0 + c.realHype);
        uint256 bal = t.balanceOf(address(this));
        if (tokenLp > bal) tokenLp = bal;

        address pool = _ensurePool(t);

        c.migrated = true; // realHype is kept as the record of what was raised
        IERC20(token).forceApprove(address(r), tokenLp);

        try r.addLiquidityETH{value: lpHype}(token, tokenLp, 0, 0, DEAD, block.timestamp) returns (
            uint256 amountToken, uint256 amountHype, uint256
        ) {
            t.setGraduated();
            protocolFees += gradFee + (lpHype - amountHype);
            uint256 leftover = t.balanceOf(address(this));
            if (leftover > 0) IERC20(token).safeTransfer(DEAD, leftover); // burn unused reserve
            emit Migrated(token, pool, amountHype, amountToken, leftover);
        } catch {
            // keep funds on the curve and allow a retry via migrate()
            c.migrated = false;
            IERC20(token).forceApprove(address(r), 0);
            emit MigrationFailed(token);
        }
    }

    function _ensurePool(ElytheonToken t) internal returns (address pool) {
        pool = t.pool();
        if (pool != address(0)) return pool;
        IUniswapV2Router02 r = IUniswapV2Router02(router);
        IUniswapV2Factory f = IUniswapV2Factory(r.factory());
        address weth = r.WETH();
        pool = f.getPair(address(t), weth);
        if (pool == address(0)) pool = f.createPair(address(t), weth);
        t.setPool(pool);
    }

    // ═════════════════════════ community ═════════════════════════

    /// @notice On-chain comment thread for a token (stored in event logs, no backend needed).
    function comment(address token, string calldata text) external {
        if (curves[token].creator == address(0)) revert UnknownToken();
        uint256 len = bytes(text).length;
        if (len == 0 || len > 280) revert BadComment();
        emit Comment(token, msg.sender, text, block.timestamp);
    }

    // ═════════════════════════ fees ═════════════════════════

    function claimCreatorFees() external nonReentrant {
        uint256 amount = creatorFees[msg.sender];
        if (amount == 0) revert ZeroAmount();
        creatorFees[msg.sender] = 0;
        emit CreatorFeesClaimed(msg.sender, amount);
        _send(msg.sender, amount);
    }

    function withdrawProtocolFees() external nonReentrant {
        uint256 amount = protocolFees;
        if (amount == 0) revert ZeroAmount();
        protocolFees = 0;
        emit ProtocolFeesWithdrawn(treasury, amount);
        _send(treasury, amount);
    }

    // ═════════════════════════ views ═════════════════════════

    function tokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    function getMetadata(address token) external view returns (Metadata memory) {
        return _metadata[token];
    }

    /// @notice newest-first page of tokens, for the frontend
    function getTokens(uint256 offset, uint256 limit) external view returns (TokenInfo[] memory list) {
        uint256 n = allTokens.length;
        if (offset >= n) return new TokenInfo[](0);
        uint256 end = offset + limit > n ? n : offset + limit;
        list = new TokenInfo[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            list[i - offset] = getTokenInfo(allTokens[n - 1 - i]);
        }
    }

    function getTokenInfo(address token) public view returns (TokenInfo memory info) {
        Curve storage c = curves[token];
        Metadata storage m = _metadata[token];
        info = TokenInfo({
            token: token,
            creator: c.creator,
            name: m.name,
            symbol: m.symbol,
            imageURI: m.imageURI,
            launchTime: c.launchTime,
            launchBlock: c.launchBlock,
            realHype: c.realHype,
            tokensSold: c.tokensSold,
            price: c.creator == address(0) ? 0 : _price(c),
            virtualHype0: c.virtualHype0,
            virtualToken0: c.virtualToken0,
            complete: c.complete,
            migrated: c.migrated,
            pool: c.creator == address(0) ? address(0) : ElytheonToken(token).pool()
        });
    }

    function quoteBuy(address token, uint256 hypeIn)
        external
        view
        returns (uint256 tokensOut, uint256 hypeUsed, uint256 fees, uint256 sniperTax)
    {
        Curve storage c = curves[token];
        if (c.creator == address(0)) revert UnknownToken();
        if (c.complete || hypeIn == 0) return (0, 0, 0, 0);
        (uint256 out, uint256 used, uint256 feeP, uint256 feeC, uint256 tax, ) = _quoteBuy(c, hypeIn);
        return (out, used, feeP + feeC, tax);
    }

    function quoteSell(address token, uint256 tokenAmount) external view returns (uint256 hypeOut, uint256 fees) {
        Curve storage c = curves[token];
        if (c.creator == address(0)) revert UnknownToken();
        if (c.complete || tokenAmount == 0) return (0, 0);
        uint256 xV = c.virtualHype0 + c.realHype;
        uint256 yV = c.virtualToken0 - c.tokensSold;
        uint256 gross = (xV * tokenAmount) / (yV + tokenAmount);
        fees = (gross * platformFeeBps) / BPS + (gross * creatorFeeBps) / BPS;
        hypeOut = gross - fees;
    }

    function sniperTaxBps(address token) external view returns (uint256) {
        return _sniperTaxBps(curves[token]);
    }

    /// @notice 0–10000: how far the curve is toward ascending
    function progressBps(address token) external view returns (uint256) {
        return (curves[token].tokensSold * BPS) / CURVE_SUPPLY;
    }

    function _price(Curve storage c) internal view returns (uint256) {
        return ((c.virtualHype0 + c.realHype) * 1e18) / (c.virtualToken0 - c.tokensSold);
    }

    function _sniperTaxBps(Curve storage c) internal view returns (uint256) {
        uint256 end = uint256(c.launchTime) + protectWindow;
        if (c.launchTime == 0 || block.timestamp >= end) return 0;
        return (uint256(sniperTaxStartBps) * (end - block.timestamp)) / protectWindow;
    }

    /// @dev On Arbitrum Orbit chains block.number is the parent-chain block; ArbSys gives the L2 block.
    function _l2Block() internal view returns (uint256) {
        (bool ok, bytes memory data) = address(100).staticcall(abi.encodeWithSignature("arbBlockNumber()"));
        if (ok && data.length == 32) return abi.decode(data, (uint256));
        return block.number;
    }

    function _send(address to, uint256 amount) internal {
        (bool ok, ) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // ═════════════════════════ admin ═════════════════════════

    function setRouter(address router_) external onlyOwner {
        router = router_;
        emit ConfigUpdated();
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert BadParam();
        treasury = treasury_;
        emit ConfigUpdated();
    }

    function setFees(uint16 platformBps, uint16 creatorBps, uint16 graduationBps, uint256 creationFee_) external onlyOwner {
        if (platformBps + creatorBps > 300 || graduationBps > 1000) revert BadParam();
        platformFeeBps = platformBps;
        creatorFeeBps = creatorBps;
        graduationFeeBps = graduationBps;
        creationFee = creationFee_;
        emit ConfigUpdated();
    }

    function setProtection(uint16 taxStartBps, uint32 window, uint256 maxWallet) external onlyOwner {
        if (taxStartBps > 5000 || window > 600 || maxWallet < 1_000_000 ether) revert BadParam();
        sniperTaxStartBps = taxStartBps;
        protectWindow = window;
        maxWalletProtected = maxWallet;
        emit ConfigUpdated();
    }

    /// @notice curve shape for NEW launches only (existing curves keep their own values)
    function setCurve(uint256 virtualHype_, uint256 virtualToken_) external onlyOwner {
        if (virtualHype_ == 0 || virtualToken_ <= CURVE_SUPPLY) revert BadParam();
        virtualHypeInit = virtualHype_;
        virtualTokenInit = virtualToken_;
        emit ConfigUpdated();
    }

    function setCreationPaused(bool paused) external onlyOwner {
        creationPaused = paused;
        emit ConfigUpdated();
    }
}
