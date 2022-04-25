pragma solidity ^0.8.13;
//SPDX-License-Identifier: MIT

import "./Delegatable.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; //https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol

contract YourContract is Ownable, Delegatable {

  event SetPurpose(address sender, string purpose);
  string public purpose = "Building Unstoppable Apps!!!";

  constructor(string memory name) Delegatable(name, "1") {}

  // Note that this contract solely permits the owner to set purpose.
  // The tests will demonstrate a variety of ways the owner can delegate this power.
  function setPurpose(string calldata newPurpose) public {
    address sender = _msgSender();
    address _owner = owner();
    require(sender == _owner, "Not owner approved");
    emit SetPurpose(_owner, purpose);

    /**
     * ALERT! Somehow, this assignment is the only line that can be un-commented and pass here.
     * Try it! What I've found is everything else seems to happen, but then
     * The assignment silently fails. There's no revert, just it doesn't assign.
     * I can't make heads or tails of it. Making a commit to ask others' input.
     */
    purpose = newPurpose;
  }

  function _msgSender () internal view override(Delegatable, Context) returns (address) {
      return currentContextAddress == address(0) ? msg.sender : currentContextAddress;
  }
}
