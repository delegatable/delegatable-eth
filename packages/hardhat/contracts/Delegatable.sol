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
  uint256 gasLimit;
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

abstract contract CaveatEnforcer {
  function enforceCaveat (bytes calldata terms, Transaction calldata tx) virtual public returns (bool);
}

abstract contract Delegatable is ECRecovery {

  // Every EIP-712 signature starts with a typehash of the struct type being signed.
  // The top level signature also includes a domain typehash that is used to
  // avoid replay attacks across other contracts.
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

  // The annoying thing about these typehashes is they need to match the structs above.
  // They also need to match the client-side type definitions being signed.
  // The tooling for keeping these three pieces of info in sync is not great today.
  // It gets more annoying with structs in structs, as you'll see below.
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

  bytes32 constant INVOCATIONS_TYPEHASH = keccak256("Invocations(Invocation[] batch)Caveat(address enforcer,bytes terms)Delegation(address delegate,bytes32 authority,Caveat[] caveats)Invocation(Transaction transaction,ReplayProtection replayProtection,SignedDelegation[] authority)ReplayProtection(uint256 nonce,uint256 queue)SignedDelegation(Delegation delegation,bytes signature)Transaction(address to,address from,uint256 gasLimit,bytes data)");

  bytes32 constant INVOCATION_TYPEHASH = keccak256("Invocation(Transaction transaction,ReplayProtection replayProtection,SignedDelegation[] authority)Caveat(address enforcer,bytes terms)Delegation(address delegate,bytes32 authority,Caveat[] caveats)ReplayProtection(uint256 nonce,uint256 queue)SignedDelegation(Delegation delegation,bytes signature)Transaction(address to,address from,uint256 gasLimit,bytes data)");

  bytes32 constant TRANSACTION_TYPEHASH = keccak256(
    abi.encodePacked("Transaction(",
      "address to,",
      "address from,",
      "uint256 gasLimit,"
      "bytes data",
    ")")
  );

  bytes32 constant REPLAY_PROTECTION_TYPEHASH = keccak256(
    abi.encodePacked("ReplayProtection(",
      "uint256 nonce,",
      "uint256 queue",
    ")")
  );

  bytes32 constant CAVEAT_TYPEHASH = keccak256(
    "Caveat(address enforcer, bytes terms)"
  );

  bytes32 constant SIGNED_DELEGATION_TYPEHASH = keccak256(
    "SignedDelegation(Delegation delegation,bytes signature)Caveat(address enforcer,bytes terms)Delegation(address delegate,bytes32 authority,Caveat[] caveats)"
  );

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


  // This value MUST be set in the constructor of the form:
  // domainHash = getEIP712DomainHash('MyContractName','1',block.chainid,address(this));
  bytes32 public immutable domainHash;

  constructor (string memory contractName, string memory version) {
    domainHash = getEIP712DomainHash(contractName,version,block.chainid,address(this));
  }  

  // Allows other contracts to call methods on this contract
  // Provided they have a valid SignedDelegation.
  function invoke (SignedInvocation[] calldata signedInvocations) public returns (bool success) {
    console.log("Invoke called with %s invocations", signedInvocations.length);
    address authorized = address(0);

    for (uint i = 0; i < signedInvocations.length; i++) {
      SignedInvocation calldata signedInvocation = signedInvocations[i];
      address invocationSigner = verifyInvocationSignature(signedInvocation);
      console.log("Extracted invocation signer as %s", invocationSigner);

      for (uint x = 0; x < signedInvocation.invocations.batch.length; x++) {
        Invocation memory invocation = signedInvocation.invocations.batch[x];
        address intendedSender = invocation.transaction.from;
        address canGrant = intendedSender;
        bytes32 authHash = 0x0;

        for (uint d = 0; d < invocation.authority.length; d++) {
          SignedDelegation memory signedDelegation = invocation.authority[d];
          address delegationSigner = verifyDelegationSignature(signedDelegation);
          require(delegationSigner == canGrant, "Delegation signer does not match required signer");

          Delegation memory delegation = signedDelegation.delegation;
          require(delegation.authority == authHash, "Delegation authority does not match previous delegation");

          // Get the hash of this delegation, ensure that it has not been revoked.
          // Revokability is basically a "free" caveat I'm including. I know, it's more expensive. But it's safer.
          // TODO: Make sure this hash is sound, probably just use the 712 encoding. I did this quickly for MVP.
          // Also, maybe delegations should have replay protection, at least a nonce (non order dependent),
          // otherwise once it's revoked, you can't give the exact same permission again.
          bytes32 delegationHash = keccak256(abi.encode(signedDelegation));
          require(!isRevoked[delegationHash], "Delegation revoked");

          // TODO: Walk the Caveat array here.
          // Until this is added, the caveat array does nothing.
          for (uint16 y = 0; y < delegation.caveats.length; y++) {
            // Pass each to the target contract's caveat enforcer.
            // function enforceCaveat (bytes terms, Transaction tx) returns (bool);
          }

          // Store the hash of this delegation in `authHash`
          // That way the next delegation can be verified against it.
          authHash = delegationHash;
          canGrant = delegation.delegate;
          console.log("Delegation chain has extended to %s", canGrant);
        }

        // And set the MsgSender to the original delegator.
        console.log("Because of all that work, we are setting msg sender to %s", invocationSigner);
        require(invocationSigner == canGrant, "Signer was not delegated to.");
        _setMsgSender(invocationSigner);
        // Here we perform the requested invocation.
        Transaction memory transaction = invocation.transaction;
        //console.log("Trying out this transaction from %s to %s", transaction.from, tx.to);
        //console.logBytes(tx.data);

        require(transaction.to == address(this), "Invocation target does not match");
        success = execute(
          transaction.to,
          transaction.data,
          transaction.gasLimit
        );
        return success;
      }
    }
  }

  function execute(
      address to,
      bytes memory data,
      uint256 gasLimit
  ) internal returns (bool success) {
    assembly {
      success := call(gasLimit, to, 0, add(data, 0x20), mload(data), 0, 0)
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

  function verifyInvocationSignature (SignedInvocation calldata signedInvocation) public returns (address) {
    bytes32 sigHash = getInvocationTypedDataHash(signedInvocation.invocations);
    console.log("Invocation signature hash:");
    console.logBytes32(sigHash);
    address recoveredSignatureSigner = recover(sigHash, signedInvocation.signature);
    return recoveredSignatureSigner;
  }

  function getInvocationTypedDataHash (Invocations calldata invocations) public returns (bytes32) {
    console.log("Invocations typehash:");
    console.logBytes32(INVOCATIONS_TYPEHASH);
    bytes32 invocationsHash = getInvocationsPacketHash(invocations);
    console.log("Invocations hash:");
    console.logBytes32(invocationsHash);

    bytes32 digest = keccak256(abi.encodePacked(
      "\x19\x01",
      domainHash,
      invocationsHash
    ));
    console.log("Produces the typed data hash digest");
    console.logBytes32(digest);
    return digest;
  }

  function getInvocationsPacketHash(Invocations memory invocations) public returns (bytes32) {
    console.log("Invocations type hash:");
    console.logBytes32(INVOCATIONS_TYPEHASH);

    return keccak256(abi.encode(
      INVOCATIONS_TYPEHASH,
      getBatchPacketHash(invocations.batch)
    ));
  }

  function getBatchPacketHash (Invocation[] memory batch) public returns (bytes32) {
    bytes memory encodedInvocations;
    for (uint i = 0; i < batch.length; i++) {
      Invocation memory invocation = batch[i];
      console.log("Invocation %s", i);
      console.log("Invocation type hash:");
      console.logBytes32(INVOCATION_TYPEHASH);
      console.log("Invocation packet hash:");
      console.logBytes32(getInvocationPacketHash(invocation));
      encodedInvocations = bytes.concat(
        encodedInvocations,
        getInvocationPacketHash(invocation)
      );
    }

    console.log("Encoded:");
    console.logBytes(encodedInvocations);
    bytes32 hashed = keccak256(encodedInvocations);
    console.log("Hashed:");
    console.logBytes32(hashed);
    return hashed;
  }

  function getInvocationPacketHash (Invocation memory invocation) public returns (bytes32) {
    console.log("Contract own address: %s", address(this));
    console.log("Invocation typehash");
    console.logBytes32(INVOCATION_TYPEHASH);

    bytes memory encodedInvocation = abi.encodePacked(
      INVOCATION_TYPEHASH,
      getTransactionPacketHash(invocation.transaction),
      getReplayProtectionPacketHash(invocation.replayProtection),
      getAuthorityPacketHash(invocation.authority)
    );

    console.log("Encoded invocation:");
    console.logBytes(encodedInvocation);
    bytes32 digest = keccak256(encodedInvocation);

    console.log("Invocation packet hash:");
    console.logBytes32(digest);
    return digest;
  }

  function getTransactionPacketHash (Transaction memory transaction) public returns (bytes32) {
    bytes memory encoded = abi.encode(
      TRANSACTION_TYPEHASH,
      transaction.to,
      transaction.from,
      transaction.gasLimit,
      keccak256(transaction.data)
    );
    console.log("Encoded transaction:");
    console.logBytes(encoded);
    return keccak256(encoded);
  }

  function getReplayProtectionPacketHash (ReplayProtection memory replayProtection) public returns (bytes32) {
    bytes memory encoded = abi.encode(
      REPLAY_PROTECTION_TYPEHASH,
      replayProtection.nonce,
      replayProtection.queue
    );
    console.log("Encoded replay protection:");
    console.logBytes(encoded);
    return keccak256(encoded);
  }

  function getAuthorityPacketHash (SignedDelegation[] memory authority) public returns (bytes32) {
    bytes memory encoded;
    console.log("Encoding authority");
    for (uint i = 0; i < authority.length; i++) {

      console.log("SignedDelegation typehash:");
      console.logBytes32(SIGNED_DELEGATION_TYPEHASH);
      console.log("SignedDelegation.delegation packet hash:");
      console.logBytes32(getDelegationPacketHash(authority[i].delegation));
      console.log("SignedDelegation signature:");
      console.logBytes(authority[i].signature);

      SignedDelegation memory signedDelegation = authority[i];
      encoded = bytes.concat(
        encoded,
        getSignedDelegationPacketHash(authority[i])
      );
    }

    console.log("Encoded authority:");  
    console.logBytes(encoded);
    bytes32 hash = keccak256(encoded);
    return hash;
  }

  function getSignedDelegationPacketHash (SignedDelegation memory signedDelegation) public returns (bytes32) {
    bytes memory encoded = abi.encode(
      SIGNED_DELEGATION_TYPEHASH,
      getDelegationPacketHash(signedDelegation.delegation),
      keccak256(signedDelegation.signature)
    );
    console.log("Encoded signed delegation:");
    console.logBytes(encoded);
    return keccak256(encoded);
  }

  function verifyDelegationSignature (SignedDelegation memory signedDelegation) public returns (address) {
    Delegation memory delegation = signedDelegation.delegation;
    bytes32 sigHash = getDelegationTypedDataHash(delegation);
    console.log("Delegation signature hash:");
    console.logBytes32(sigHash);
    console.log("Delegation signature:");
    console.logBytes(signedDelegation.signature);

    address recoveredSignatureSigner = recover(sigHash, signedDelegation.signature);
    console.log("Recovered delegation signer: %s", recoveredSignatureSigner);
    return recoveredSignatureSigner;
  }

  function getDelegationTypedDataHash(Delegation memory delegation) public returns (bytes32) {
    bytes32 packetHash = getDelegationPacketHash(delegation);
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

  function getDelegationPacketHash(Delegation memory delegation) public returns (bytes32) {
    console.log("Delegation typehash:");
    console.logBytes32(DELEGATION_TYPEHASH);
    console.log("Delegate encoded:%s", delegation.delegate);
    console.log("Delegated authority:");
    console.logBytes32(delegation.authority);

    bytes memory encoded = abi.encode(
      DELEGATION_TYPEHASH,
      delegation.delegate,
      delegation.authority,
      encodeCaveats(delegation.caveats)
    );
    console.log("Encoded:");
    console.logBytes(encoded);
    return keccak256(encoded);
  }

  function encodeCaveats (Caveat[] memory caveats) public view returns (bytes32) {
    bytes memory encoded;
    for (uint i = 0; i < caveats.length; i++) {
      Caveat memory caveat = caveats[i];
      encoded = bytes.concat(
        encoded,
        abi.encode(
          CAVEAT_TYPEHASH,
          caveat.enforcer,
          caveat.terms
        )
      );
    }

    console.log("Encoded caveats:");
    console.logBytes(encoded);
    return keccak256(encoded);
  }

 

}

