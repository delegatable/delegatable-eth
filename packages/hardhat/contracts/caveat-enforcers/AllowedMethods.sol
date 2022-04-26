pragma solidity ^0.8.13;
//SPDX-License-Identifier: MIT

import "./CaveatEnforcer.sol";

contract AllowedMethods is CaveatEnforcer {
  function enforceCaveat(bytes memory terms, Transaction memory tx) public override returns (bool) {
    bytes4 sig = bytes4(tx.data[:4]);
    return execute(terms);
  }

  function execute(bytes memory data) internal returns (bool success) {
    address recipient = address(this);
    uint256 gasLimit = gasleft();
    assembly {
      success := call(gasLimit, recipient, 0, add(data, 0x20), mload(data), 0, 0)
    }
  }

  function permitMethods (bytes4[] calldata methods) public {
    for (uint256 i = 0; i < methods.length; i++) {
      bytes4 method = methods[i];
    }
  }
}
