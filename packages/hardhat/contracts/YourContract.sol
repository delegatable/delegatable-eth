pragma solidity ^0.8.13;
//SPDX-License-Identifier: MIT

import "hardhat/console.sol";
import "./Delegatable.sol";

import "@openzeppelin/contracts/access/Ownable.sol"; //https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol

contract YourContract is Ownable, Delegatable {

  //event SetPurpose(address sender, string purpose);

  string public purpose = "Building Unstoppable Apps!!!";

  constructor(string memory name) Delegatable(name, "1") {
  }

  // Note that this contract solely permits the owner to set purpose.
  // The tests will demonstrate a variety of ways the owner can delegate this power.
  function setPurpose(string memory newPurpose) public {
    console.log("Setting purpose");
    console.log(newPurpose);
    address sender = _msgSender();
    console.log("Sender: %s", sender);
    console.log("Owner: %s", owner());
    require(sender == owner(), "Not owner approved");
    purpose = newPurpose;
    console.log(msg.sender,"set purpose to",purpose);
    //emit SetPurpose(msg.sender, purpose);
  }

  function _msgSender () internal view override(Delegatable, Context) returns (address) {
      return currentContextAddress == address(0) ? msg.sender : currentContextAddress;
  }
}
