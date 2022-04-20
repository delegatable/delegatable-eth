pragma solidity ^0.8.13;
// SPDX-License-Identifier: MIT

import "./ECRecovery.sol";

// import "hardhat/console.sol";
// import "@openzeppelin/contracts/access/Ownable.sol"; //https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol

// This whole library is a way to allow transactions to be invoked by delegates.
// An invocation is like a normal tx, except that it can be signed by someone else.
// To be eligible to sign a tx for another account, you must have the valid authority,
// Represented by an unbroken chain of delegation messages from the account owner.
struct Invocation {
  Transaction transaction;
  ReplayProtection replayProtection;
  SignedDelegation[] authority;
}

// The signature structure supports an array for batching support.
// TBD: Should we enforce atomicity of this invocation array?
struct SignedInvocation {
  Invocation[] Invocation;
  bytes signature;
}

struct Transaction {
  address to;
  address from;
  bytes data;
}

// Instead of a single nonce, we're using a two dimensional nonce,
// So that transactions do not need to block each other.
// https://roamresearch.com/#/app/capabul/page/4SqiqiuAo
struct ReplayProtection {
  uint256 queue;
  uint256 nonce;
}

struct SignedDelegation {
  Delegation delegation;
  bytes signature;
}

struct Delegation {

  address delegate;

  // If authority is zero, this delegation comes from its signer.
  // If authority is bytes, those bytes must match the hash of
  // the next SignedDelegation in the invocation's SignedDelegation[].
  bytes32 authority;

  // A delegation allows any method,
  // except for any caveats.
  Caveat[] caveats;
}

// A caveat specifies an external contract that can veto the invocation.
// That enforcer is passed the caveat message itself, and the proposed tx.
// function enforceCaveat (Caveat caveat, Transaction tx) returns (bool);
// Any method inheriting Delegatable can also expose this interface for its own caveats.
struct Caveat {
  address enforcer;
  bytes terms;
}

// The caveats may be gas expensive. Can a contract support starting caveats?
// Methods in Ronan's game:
// send, create, exitPlanet
// Has some delegation already:
// allowances of planets, etc.

error InvalidSignature (uint invocationIndex);

abstract contract Delegatable is ECRecovery {

  // This value MUST be set in the constructor of the form:
  // domainHash = getEIP712DomainHash('MyContractName','1',block.chainid,address(this));
  bytes32 immutable domainHash;

  constructor (string memory contractName, string memory version) {
    domainHash = getEIP712DomainHash(contractName,version,block.chainid,address(this));
  }  

  // Allows other contracts to call methods on this contract
  // Provided they have a valid SignedDelegation.
  function invoke (Invocation[] calldata invocations, bool allMustSucceed) public {
    for (uint i=0; i < invocations.length; i++) {
      Invocation memory invocation = invocations[i];
      SignedDelegation memory signedDelegation = invocation.authority[i];
      Delegation memory delegation = signedDelegation.delegation;

      if (
        !verifyDelegationSignature(signedDelegation)) {
        if (!allMustSucceed) {
          continue;
        } else {
          revert InvalidSignature({ invocationIndex: i });
        }
      }

      // Here we perform the custom instruction
    }
  }

  // Allows any delegator to revoke any outstanding SignedDelegation,
  // Adding it to a revoked list,
  // invalidating any future invocations that would rely on it.
  function revoke (SignedDelegation[] calldata delegations) public {

  }

  function verifyDelegationSignature (SignedDelegation memory signedDelegation) public view returns (bool) {
    Delegation memory delegation = signedDelegation.delegation;
    bytes32 sigHash = getDelegationTypedDataHash(
      delegation.delegate,
      delegation.authority,
      delegation.caveats
    );

    address recoveredSignatureSigner = recover(sigHash, signedDelegation.signature);

    require(signedDelegation.delegation.delegate == recoveredSignatureSigner, 'Invalid signature');
    return true;
  }

  function getDelegationTypedDataHash(address delegate, bytes32 authority, Caveat[] memory caveats) public view returns (bytes32) {
    bytes32 packetHash = getDelegationPacketHash(delegate, authority, caveats);
    bytes32 digest = keccak256(abi.encodePacked(
      "\x19\x01",
      domainHash,
      packetHash
    ));
    return digest;
  }

  function getDelegationPacketHash(
    address delegate,
    bytes32 authority,
    Caveat[] memory caveat
  ) public pure returns (bytes32) {
    return keccak256(abi.encode(
      DELEGATION_TYPEHASH,
      delegate,
      authority,
      caveat
    ));
  }

  bytes32 constant EIP712DOMAIN_TYPEHASH = keccak256(
    // Inspiration for nested struct types from Airswap:
    // https://github.com/airswap/airswap-protocols/blob/4d0e4d977bf9788756ec1ee0f85ff7e692cd44e8/source/types/contracts/Types.sol
    abi.encodePacked(
      "EIP712Domain(",
        "string name,",
        "string version,",
        "uint256 chainId,",
        "address verifyingContract",
      ")"
    )
  );

  bytes32 constant DELEGATION_TYPEHASH = keccak256(
    abi.encodePacked(
      "Delegation(",
        "address delegate,",
        "Caveat caveat,",
        "SignedDelegation authority",
      ")"
      "Caveat(address enforcer, bytes terms)",
      "SignedDelegation(Delegation delegation, bytes signature)"
    )
  );

  bytes32 constant CAVEAT_TYPEHASH = keccak256(
    "Caveat(address enforcer, bytes terms)"
  );

  bytes32 constant SIGNED_DELEGATION_TYPEHASH = keccak256(
    "SignedDelegation(Delegation delegation, bytes signature)"
  );

  function getEIP712DomainHash(string memory contractName, string memory version, uint256 chainId, address verifyingContract) public pure returns (bytes32) {
    return keccak256(abi.encode(
      EIP712DOMAIN_TYPEHASH,
      keccak256(bytes(contractName)),
      keccak256(bytes(version)),
      chainId,
      verifyingContract
    ));
  }

}

