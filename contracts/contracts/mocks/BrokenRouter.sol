// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// Test-only router that behaves like a V2 router but refuses to add liquidity.
contract BrokenRouter {
    address public immutable factory;
    address public immutable WETH;
    constructor(address f, address w) { factory = f; WETH = w; }
    function addLiquidityETH(address, uint256, uint256, uint256, address, uint256)
        external payable returns (uint256, uint256, uint256) { revert("broken"); }
}
