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

  /**
   * This is a recommended method to implement. Most contracts will not intend to delegate all of their functionality.
   * Rather than rely on an external caveat in these cases, we recommend having a "base caveat" that you interpret locally.
   * This one simply disallows the ownership functions.
   */
  function enforceCaveat(
    bytes calldata terms,
    Transaction calldata transaction,
    bytes32 delegationHash
  ) public pure returns (bool) {
    // Owner methods are not delegatable in this contract:
    bytes4 targetSig = bytes4(transaction.data[0:4]);

    // transferOwnership(address newOwner)
    require(targetSig != 0xf2fde38b, "transferOwnership is not delegatable");

    // renounceOwnership() 
    require(targetSig != 0x79ba79d8, "renounceOwnership is not delegatable");

    return true;
  }
}
