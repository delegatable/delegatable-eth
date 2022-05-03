pragma solidity ^0.8.13;
//SPDX-License-Identifier: MIT

import "./CaveatEnforcer.sol";

contract ExpirationEnforcer is CaveatEnforcer {
  function enforceCaveat(bytes memory terms, Transaction memory tx, bytes32 delegationHash) override public returns (bool) {
    uint limit = bytesToUint(terms);
    require(limit > block.timestamp, "Expiration has passed");
    return true;
  }

  function bytesToUint(bytes memory b) internal pure returns (uint256){
    uint256 number;
    for(uint i=0;i<b.length;i++){
      number = number + uint(uint8(b[i]))*(2**(8*(b.length-(i+1))));
    }
    return number;
  }
}
