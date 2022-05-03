pragma solidity ^0.8.13;
//SPDX-License-Identifier: MIT

import "./CaveatEnforcer.sol";
import "../Delegatable.sol";

contract RevocationEnforcer is CaveatEnforcer, Delegatable("CaveatEnforcer", "1") {

  mapping(address => mapping(bytes32 => bool)) isRevoked;
  function enforceCaveat(
    bytes calldata terms,
    Transaction calldata transaction,
    bytes32 delegationHash
  ) public pure override returns (bool) {
    require(!isRevoked[_msgSender()][delegationHash], "Caveat has been revoked");
    return true;
  }

  function revokeCaveat(bytes32 delegationHash) public {
    isRevoked[_msgSender()][delegationHash] = true;
  }

  /**
   * This is boilerplate that must be added to any Delegatable contract if it also inherits
   * from another class that also implements _msgSender().
   */
  function _msgSender () internal view override(Delegatable, Context) returns (address sender) {
    if(msg.sender == address(this)) {
      bytes memory array = msg.data;
      uint256 index = msg.data.length;
      assembly {
        // Load the 32 bytes word from memory with the address on the lower 20 bytes, and mask those.
        sender := and(mload(add(array, index)), 0xffffffffffffffffffffffffffffffffffffffff)
      }
    } else {
      sender = msg.sender;
    }
    return sender;
  }
}
