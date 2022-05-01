pragma solidity ^0.8.13;
//SPDX-License-Identifier: MIT

import "./CaveatEnforcer.sol";

contract Expiration is CaveatEnforcer {
  function enforceCaveat(bytes memory terms, Transaction memory tx, bytes32 delegationHash) override public returns (bool) {
    // return uint256(terms) > block.timestamp;
  }
}
