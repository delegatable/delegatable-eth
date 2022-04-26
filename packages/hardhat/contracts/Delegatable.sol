pragma solidity ^0.8.13;
// SPDX-License-Identifier: MIT

import "./TypesAndDecoders.sol";
import "./caveat-enforcers/CaveatEnforcer.sol";
import "hardhat/console.sol";

abstract contract Delegatable is EIP712Decoder {

  bytes32 public immutable domainHash;
  constructor (string memory contractName, string memory version) {
    domainHash = getEIP712DomainHash(contractName,version,block.chainid,address(this));
  }  

  // Allows external signers to submit batches of signed invocations for processing. 
  function invoke (SignedInvocation[] calldata signedInvocations) public returns (bool success) {
    for (uint i = 0; i < signedInvocations.length; i++) {
      SignedInvocation calldata signedInvocation = signedInvocations[i];
      address invocationSigner = verifyInvocationSignature(signedInvocation);
      enforceReplayProtection(invocationSigner, signedInvocations[i].invocations.replayProtection);
      _invoke(signedInvocation.invocations.batch, invocationSigner);
    }
  }

  // Allows external contracts to submit batches of invocations for processing.
  function contractInvoke (Invocation[] calldata batch) public returns (bool) {
    return _invoke(batch, msg.sender);
  }

  function _invoke (Invocation[] calldata batch, address sender) private returns (bool success) {
    for (uint x = 0; x < batch.length; x++) {
      Invocation memory invocation = batch[x];
      address intendedSender;
      address canGrant;

      // If there are no delegations, this invocation comes from the signer
      if (invocation.authority.length == 0) {
        intendedSender = sender;
        canGrant = intendedSender;
      }

      bytes32 authHash = 0x0;

      for (uint d = 0; d < invocation.authority.length; d++) {
        SignedDelegation memory signedDelegation = invocation.authority[d];
        address delegationSigner = verifyDelegationSignature(signedDelegation);

        // Implied sending account is the signer of the first delegation
        if (d == 0) {
          intendedSender = delegationSigner;
          canGrant = intendedSender;
        }

        require(delegationSigner == canGrant, "Delegation signer does not match required signer");

        Delegation memory delegation = signedDelegation.delegation;
        require(delegation.authority == authHash, "Delegation authority does not match previous delegation");

        // TODO: maybe delegations should have replay protection, at least a nonce (non order dependent),
        // otherwise once it's revoked, you can't give the exact same permission again.
        bytes32 delegationHash = GET_SIGNEDDELEGATION_PACKETHASH(signedDelegation);
        require(!isRevoked[delegationHash], "Delegation revoked");

        // Each delegation can include any number of caveats.
        // A caveat is any condition that may reject a proposed transaction.
        // The caveats specify an external contract that is passed the proposed tx,
        // As well as some extra terms that are used to parameterize the enforcer.
        for (uint16 y = 0; y < delegation.caveats.length; y++) {
          CaveatEnforcer enforcer = CaveatEnforcer(delegation.caveats[y].enforcer);
          bool caveatSuccess = enforcer.enforceCaveat(delegation.caveats[y].terms, invocation.transaction);
          require(caveatSuccess, "Caveat rejected");
        }

        // Store the hash of this delegation in `authHash`
        // That way the next delegation can be verified against it.
        authHash = delegationHash;
        canGrant = delegation.delegate;
        // console.log("Delegation chain has extended to %s", canGrant);
      }

      // Here we perform the requested invocation.
      Transaction memory transaction = invocation.transaction;
      //console.log("Trying out this transaction from %s to %s", transaction.from, tx.to);
      //console.logBytes(tx.data);

      require(transaction.to == address(this), "Invocation target does not match");
      success = execute(
        transaction.to,
        transaction.data,
        transaction.gasLimit,
        intendedSender
      );
      require(success, "Delegator execution failed");
    }
  }

  mapping(address => mapping(uint => uint)) public multiNonce;
  function enforceReplayProtection (address intendedSender, ReplayProtection memory protection) private {
    uint queue = protection.queue;
    uint nonce = protection.nonce;
    require(nonce == (multiNonce[intendedSender][queue]+1), "One-at-a-time order enforced. Nonce2 is too small");
    multiNonce[intendedSender][queue] = nonce;
  }

  function execute(
      address to,
      bytes memory data,
      uint256 gasLimit,
      address sender
  ) internal returns (bool success) {
    bytes memory full = abi.encodePacked(data, sender);
    assembly {
      success := call(gasLimit, to, 0, add(full, 0x20), mload(full), 0, 0)
    }
  }

  // Allows any delegator to revoke any outstanding SignedDelegation,
  // Adding it to a revoked list,
  // invalidating any future invocations that would rely on it.
  mapping(bytes32 => bool) isRevoked;
  function revoke (SignedDelegation[] calldata delegations) public {
    for (uint i = 0; i < delegations.length; i++) {
      SignedDelegation calldata signedDelegation = delegations[i];
      address delegationSigner = verifyDelegationSignature(signedDelegation);
      address sender = _msgSender();
      console.log("Checking if signer %s matches sender %s", delegationSigner, sender);
      require(delegationSigner == sender, "Revocations must be signed by the delegator");
      bytes32 delegationHash = keccak256(abi.encode(signedDelegation));
      isRevoked[delegationHash] = true;
    }
  }

  function verifyInvocationSignature (SignedInvocation memory signedInvocation) public view returns (address) {
    bytes32 sigHash = getInvocationsTypedDataHash(signedInvocation.invocations);
    // console.log("Invocation signature hash:");
    // console.logBytes32(sigHash);
    address recoveredSignatureSigner = recover(sigHash, signedInvocation.signature);
    return recoveredSignatureSigner;
  } 

  function verifyDelegationSignature (SignedDelegation memory signedDelegation) public view returns (address) {
    Delegation memory delegation = signedDelegation.delegation;
    bytes32 sigHash = getDelegationTypedDataHash(delegation);
    // console.log("Delegation signature hash:");
    // console.logBytes32(sigHash);
    // console.log("Delegation signature:");
    // console.logBytes(signedDelegation.signature);

    address recoveredSignatureSigner = recover(sigHash, signedDelegation.signature);
    // console.log("Recovered delegation signer: %s", recoveredSignatureSigner);
    return recoveredSignatureSigner;
  }

  function getDelegationTypedDataHash(Delegation memory delegation) public view returns (bytes32) {
    bytes32 digest = keccak256(abi.encodePacked(
      "\x19\x01",
      domainHash,
      GET_DELEGATION_PACKETHASH(delegation)
    ));
    // console.log("Produces the typed data hash digest");
    // console.logBytes32(digest);
    return digest;
  }

  function getInvocationsTypedDataHash (Invocations memory invocations) public view returns (bytes32) {
    bytes32 digest = keccak256(abi.encodePacked(
      "\x19\x01",
      domainHash,
      GET_INVOCATIONS_PACKETHASH(invocations)
    ));
    return digest;
  }

  function getEIP712DomainHash(string memory contractName, string memory version, uint256 chainId, address verifyingContract) public pure returns (bytes32) {
    // console.log("The getEIP712TypeHash() is:");
    // console.logBytes32(EIP712DOMAIN_TYPEHASH);
    bytes memory encoded = abi.encode(
      EIP712DOMAIN_TYPEHASH,
      keccak256(bytes(contractName)),
      keccak256(bytes(version)),
      chainId,
      verifyingContract
    );
    // console.log("The encoded EIP712 domain is:");
    // console.logBytes(encoded);
    return keccak256(encoded);
  }


  function _msgSender () internal view virtual returns (address sender) {
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

