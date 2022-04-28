pragma solidity ^0.8.13;
//SPDX-License-Identifier: MIT

import "./Delegatable.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; //https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol

contract YourContract is Ownable, Delegatable {

  constructor(string memory name) Delegatable(name, "1") {}

  string public purpose = "Building Unstoppable Apps!!!";
  function setPurpose(string calldata newPurpose) onlyOwner public {
    purpose = newPurpose;
  }

  mapping (string => bool) isPhisher;
  function claimIfPhisher (string calldata identifier, bool isAccused) onlyOwner public {
    isPhisher[identifier] = isAccused;
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
