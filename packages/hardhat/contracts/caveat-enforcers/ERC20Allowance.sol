pragma solidity ^0.8.13;
//SPDX-License-Identifier: MIT

import "../Delegatable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ERC20Allowance is CaveatEnforcer {
  mapping(address => mapping(bytes32 => uint256)) allowances;

  function enforceCaveat(
    bytes calldata terms,
    Transaction calldata transaction,
    bytes32 delegationHash 
  ) public override returns (bool) {

    // Enforce this is an ERC20 transfer:
    bytes4 targetSig = bytes4(transaction.data[0:4]);
    bytes4 allowedSig = bytes4(0xa9059cbb);

    // Enforce the specified allowance:
    IERC20 token = IERC20(transaction.to);

    uint limit = bytesToUint(terms);
    uint spent = allowances[msg.sender][delegationHash];

    require(spent < limit, "Allowance exceeded");
    allowances[msg.sender][delegationHash]++;
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
