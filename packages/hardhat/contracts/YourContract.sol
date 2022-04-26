pragma solidity ^0.8.13;
//SPDX-License-Identifier: MIT

import "./Delegatable.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; //https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol

contract YourContract is Ownable, Delegatable {
  string public purpose = "Building Unstoppable Apps!!!";

  constructor(string memory name) Delegatable(name, "1") {}

  // Note that this contract solely permits the owner to set purpose.
  // The tests will demonstrate a variety of ways the owner can delegate this power.
  function setPurpose(string calldata newPurpose) onlyOwner public {
    purpose = newPurpose;
  }

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
