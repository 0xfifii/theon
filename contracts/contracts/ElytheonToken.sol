// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title ElytheonToken
/// @notice Fixed-supply ERC20 created by the Elytheon launchpad.
///         The whole supply is minted to the launchpad, which sells it on a bonding curve.
///         Until the token graduates, nobody can send tokens into its DEX pair
///         (this stops anyone from seeding the pool at a fake price before launch).
contract ElytheonToken is ERC20 {
    error OnlyLaunchpad();
    error PoolLocked();

    address public immutable launchpad;
    address public pool;       // DEX pair this token will graduate into (0 if not known yet)
    bool public graduated;     // true once liquidity has been added on the DEX

    constructor(string memory name_, string memory symbol_, uint256 supply_) ERC20(name_, symbol_) {
        launchpad = msg.sender;
        _mint(msg.sender, supply_);
    }

    modifier onlyLaunchpad() {
        if (msg.sender != launchpad) revert OnlyLaunchpad();
        _;
    }

    function setPool(address pool_) external onlyLaunchpad {
        pool = pool_;
    }

    function setGraduated() external onlyLaunchpad {
        graduated = true;
    }

    function _update(address from, address to, uint256 value) internal override {
        // Before graduation only the launchpad itself may move tokens into the pool.
        if (!graduated && to == pool && pool != address(0) && from != launchpad) revert PoolLocked();
        super._update(from, to, value);
    }
}
