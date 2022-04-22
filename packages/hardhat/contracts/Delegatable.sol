pragma solidity ^0.8.13;
// SPDX-License-Identifier: MIT

import "./ECRecovery.sol";

import "hardhat/console.sol";
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

struct Invocations {
  Invocation[] batch;
}

// The signature structure supports an array for batching support.
// TBD: Should we enforce atomicity of this invocation array?
struct SignedInvocation {
  Invocations invocations;
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
  bytes32 public immutable domainHash;

  constructor (string memory contractName, string memory version) {
    domainHash = getEIP712DomainHash(contractName,version,block.chainid,address(this));
  }  

  // Allows other contracts to call methods on this contract
  // Provided they have a valid SignedDelegation.
  function invoke (SignedInvocation[] calldata signedInvocations) public {
    console.log("Invoke called with %s invocations", signedInvocations.length);
    address authorized = address(0);
    bytes32 authHash;

    for (uint i = 0; i < signedInvocations.length; i++) {
      SignedInvocation calldata signedInvocation = signedInvocations[i];
      address signer = verifyInvocationSignature(signedInvocation);
      // TODO: Verify the invocation signature.

      for (uint x = 0; x < signedInvocation.invocations.batch.length; x++) {
        Invocation memory invocation = signedInvocation.invocations.batch[x];
        SignedDelegation memory signedDelegation = invocation.authority[i];
        Delegation memory delegation = signedDelegation.delegation;
        console.log("Invoking with delegate %s", delegation.delegate);
        console.log("Invoking with %s caveats", delegation.caveats.length);
        console.log("And authority:");
        console.logBytes32(delegation.authority);
        //console.log("Recovering delegation with %s delegate, %s authority, %s caveats", delegation.delegate, delegation.authority, delegation.caveats.length);
        address signer = verifyDelegationSignature(signedDelegation);

        // If this is the root delegation, set the msgSender to them.
        // Else, ensure the signer of this delegation is `authorized`.
        // TODO: Verify that caveat re-entrancy does not retain these local assignments.
        if (i == 0) {
          _setMsgSender(signer);
        } else {
          require(authorized == signer, "Delegation not signed by valid delegate");
          require(delegation.authority == authHash, "Delegation lacks valid authority");
          authorized = delegation.delegate;
        }

        // Get the hash of this delegation, ensure that it has not been revoked.
        // Revokability is basically a "free" caveat I'm including. I know, it's more expensive. But it's safer.
        bytes32 delegationHash; // TODO: Get this hash.
        require(!isRevoked[delegationHash], "Delegation revoked");

        // Run the proposed transaction by any attached caveats.
        for (uint16 y = 0; y < delegation.caveats.length; y++) {
          // Pass each to the target contract's caveat enforcer.
          // function enforceCaveat (Caveat caveat, Transaction tx) returns (bool);
        }

        // Store the hash of this delegation in `authHash`.
        authHash = delegationHash;
      }

      // Here we perform the custom instruction
    }
  }

  // Allows any delegator to revoke any outstanding SignedDelegation,
  // Adding it to a revoked list,
  // invalidating any future invocations that would rely on it.
  mapping(bytes32 => bool) isRevoked;
  function revoke (SignedDelegation[] calldata delegations) public {
    // Get the signer of the SignedDelegation
    // Require that signer is equal to msgSender()
    // Get the hash of the SignedDelegation
    // Set its revoked value to true.
  }

  // TODO: Migrate this context variable to Diamond storage so this contract can work in a facet.
  // https://eip2535diamonds.substack.com/p/appstorage-pattern-for-state-variables?s=r
  address currentContextAddress = address(0);
  function _setMsgSender (address contextAddress) internal {
      currentContextAddress = contextAddress;
  }

  function _msgSender () internal view virtual returns (address) {
      return currentContextAddress == address(0) ? msg.sender : currentContextAddress;
  }

  function verifyDelegationSignature (SignedDelegation memory signedDelegation) public returns (address) {
    Delegation memory delegation = signedDelegation.delegation;
    bytes32 sigHash = getDelegationTypedDataHash(
      delegation.delegate,
      delegation.authority,
      delegation.caveats
    );
    console.log("Delegation signature hash:");
    console.logBytes32(sigHash);
    console.log("Delegation signature:");
    console.logBytes(signedDelegation.signature);

    address recoveredSignatureSigner = recover(sigHash, signedDelegation.signature);

    console.log("Recovered signer %s when needed %s", recoveredSignatureSigner, signedDelegation.delegation.delegate);
    require(signedDelegation.delegation.delegate == recoveredSignatureSigner, 'Invalid signature');
    return recoveredSignatureSigner;
  }

  function verifyInvocationSignature (SignedInvocation calldata signedInvocation) public view returns (address) {
    address signer = address(0);
    bytes32 sigHash = getInvocationTypedDataHash(signedInvocation.invocations);
    return signer;
  }

  function getInvocationTypedDataHash (Invocations calldata invocations) public view returns (bytes32) {
    bytes32 packetHash = getInvocationsPacketHash(invocations);
    bytes32 digest = keccak256(abi.encodePacked(
      "\x19\x01",
      domainHash,
      packetHash
    ));
    console.log("Produces the typed data hash digest");
    console.logBytes32(digest);
    return digest;
  }

  function getInvocationsPacketHash(Invocations memory invocations) public view returns (bytes32) {
    bytes memory encoded = abi.encode(
      INVOCATIONS_TYPEHASH,
      invocations
    );
    console.log("Encoded:");
    console.logBytes(encoded);
    return keccak256(encoded);
  }

  function getDelegationTypedDataHash(address delegate, bytes32 authority, Caveat[] memory caveats) public returns (bytes32) {
    bytes32 packetHash = getDelegationPacketHash(delegate, authority, caveats);
    console.log("Domain Hash");
    console.logBytes32(domainHash);
    console.log("Delegation packet hash:");
    console.logBytes32(packetHash);
    bytes32 digest = keccak256(abi.encodePacked(
      "\x19\x01",
      domainHash,
      packetHash
    ));
    console.log("Produces the typed data hash digest");
    console.logBytes32(digest);
    return digest;
  }

  function getDelegationPacketHash(
    address delegate,
    bytes32 authority,
    Caveat[] memory caveat
  ) public returns (bytes32) {
    console.log("Delegation typehash:");
    console.logBytes32(DELEGATION_TYPEHASH);
    bytes memory encoded = abi.encode(
      DELEGATION_TYPEHASH,
      delegate,
      authority,
      caveat
    );
    console.log("Encoded:");
    console.logBytes(encoded);
    return keccak256(encoded);
  }

  function getEIP712TypeHash() public view returns (bytes32) {
    // This is just a string concatenation, don't read too much into it.
    bytes memory typeHash = abi.encodePacked(
      "EIP712Domain(",
        "string name,",
        "string version,",
        "uint256 chainId,",
        "address verifyingContract",
      ")"
    );
    console.log("EIP712 DOMAIN TypeHash");
    console.logBytes(typeHash);
    return keccak256(typeHash);
  }

  bytes32 constant DELEGATION_TYPEHASH = keccak256(
    // Inspiration for nested struct types from Airswap:
    // https://github.com/airswap/airswap-protocols/blob/4d0e4d977bf9788756ec1ee0f85ff7e692cd44e8/source/types/contracts/Types.sol
    abi.encodePacked("Delegation(",
      "address delegate,",
      "bytes32 authority,",
      "Caveat[] caveats)",
      "Caveat(address enforcer,bytes terms)"
    )
  );

  bytes32 constant INVOCATIONS_TYPEHASH = keccak256("Invocations(Invocation[] batch)Caveat(address enforcer,bytes terms)Delegation(address delegate,bytes32 authority,Caveat[] caveats)Invocation(Transaction transaction,ReplayProtection replayProtection,SignedDelegation[] authority)ReplayProtection(uint256 nonce,uint256 queue)SignedDelegation(Delegation delegation,bytes signature)Transaction(address to,address from,bytes data)");

  bytes32 constant CAVEAT_TYPEHASH = keccak256(
    "Caveat(address enforcer, bytes terms)"
  );

  bytes32 constant SIGNED_DELEGATION_TYPEHASH = keccak256(
    "SignedDelegation(Delegation delegation, bytes signature)"
  );

  function getEIP712DomainHash(string memory contractName, string memory version, uint256 chainId, address verifyingContract) public view returns (bytes32) {
    console.log("The getEIP712TypeHash() is:");
    console.logBytes32(getEIP712TypeHash());
    bytes memory encoded = abi.encode(
      getEIP712TypeHash(),
      keccak256(bytes(contractName)),
      keccak256(bytes(version)),
      chainId,
      verifyingContract
    );
    console.log("The encoded EIP712 domain is:");
    console.logBytes(encoded);
    return keccak256(encoded);
  }

}

