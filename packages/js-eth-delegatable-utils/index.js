const types = require('./types')
const createTypedMessage = require('./createTypedMessage');
const sigUtil = require('@metamask/eth-sig-util');
const {
  TypedDataUtils,
} = sigUtil;

const { abi } = require('./artifacts');
const typedMessage = require('./types');
const CONTRACT_NAME = 'PhisherRegistry';
const secp = require('@noble/secp256k1');
const {
  keccak_256,
} = require('@noble/hashes/sha3');

// Util curries contract info into a reusable utility
exports.generateUtil = function generateUtil (contractInfo) {
  return {
    recoverSigner: (signedDelegation) => exports.recoverSigner(signedDelegation, contractInfo),

    signDelegation: (delegation, privateKey) => exports.signDelegation(delegation, privateKey, contractInfo),
    recoverDelegationSigner: (signedDelegation) => exports.recoverDelegationSigner(signedDelegation, contractInfo),
    createSignedDelegationHash: (signedDelegation) => exports.createSignedDelegationHash(signedDelegation, contractInfo),

    signInvocation: (invocation, privateKey) => exports.signInvocation(invocation, privateKey, contractInfo),
    recoverInvocationSigner: (signedInvocation) => exports.recoverInvocationSigner(signedInvocation, contractInfo),

    signRevocation: (revocation, privateKey) => exports.signRevocation(revocation, privateKey, contractInfo),
    recoverRevocationSignature: (signedRevocation) => exports.recoverRevocationSignature(signedRevocation, contractInfo),
  }
}

exports.createSignedDelegationHash = function createDelegationHash (signedDelegation, contractInfo) {
  const { verifyingContract, name, chainId } = contractInfo;
  const hash = TypedDataUtils.hashStruct('SignedDelegation', signedDelegation, types.types, 'V4');
  return hash;
}

exports.recoverDelegationSigner = function recoverDelegationSigner (signedDelegation, contractInfo) {
  const { chainId, verifyingContract, name } = contractInfo;
  types.domain.chainId = chainId;
  types.domain.name = name;
  types.domain.verifyingContract = verifyingContract;
  const typedMessage = createTypedMessage(verifyingContract, signedDelegation.delegation, 'Delegation', name, chainId);

  const signer = sigUtil.recoverTypedSignature({
    data: typedMessage.data,
    signature: signedDelegation.signature,
    version: 'V4',
  });
  return signer;
}

exports.recoverSigner = exports.recoverDelegationSigner;

exports.recoverInvocationSigner = function recoverInvocationSigner (signedInvocation, contractInfo) {
  const { chainId, verifyingContract, name } = contractInfo;
  types.domain.chainId = chainId;
  types.domain.name = name;
  types.domain.verifyingContract = verifyingContract;
  const typedMessage = cdomainreateTypedMessage(verifyingContract, signedInvocation.invocations, 'Invocations', name, chainId);

  const signer = sigUtil.recoverTypedSignature({
    data: typedMessage.data,
    signature: signedInvocation.signature,
    version: 'V4',
  });
  return signer;
}

exports.signInvocation = function signInvocation(invocation, privateKey, contractInfo) {
  const { chainId, verifyingContract, name } = contractInfo;
  const typedMessage = createTypedMessage(verifyingContract, invocation, 'Invocations', name, chainId);

  const signature = sigUtil.signTypedData({
    privateKey: fromHexString(privateKey.indexOf('0x') === 0 ? privateKey.substring(2) : privateKey),
    data: typedMessage.data,
    version: 'V4',
  });

  const signedInvocation = {
    signature,
    invocations: invocation,
  }

  return signedInvocation;
}

exports.signDelegation = function signDelegation (delegation, privateKey, contractInfo) {
  const { chainId, verifyingContract, name } = contractInfo;
  const typedMessage = createTypedMessage(verifyingContract, delegation, 'Delegation', name, chainId);

  const signature = sigUtil.signTypedData({
    privateKey: fromHexString(privateKey.indexOf('0x') === 0 ? privateKey.substring(2) : privateKey),
    data: typedMessage.data,
    version: 'V4',
  });

  const signedDelegation = {
    signature,
    delegation,
  }

  return signedDelegation;
}

exports.signRevocation = function signRevocation (revocation, privateKey, contractInfo) {
  const { chainId, verifyingContract, name } = contractInfo;
  const typedMessage = createTypedMessage(verifyingContract, revocation, 'IntentionToRevoke', name, chainId);

  const signature = sigUtil.signTypedData({
    privateKey: fromHexString(privateKey.indexOf('0x') === 0 ? privateKey.substring(2) : privateKey),
    data: typedMessage.data,
    version: 'V4',
  });

  const signedRevocation = {
    signature,
    intentionToRevoke: revocation,
  }

  return signedRevocation;
}

exports.recoverRevocationSignature = function recoverRevocationSignature (signedRevocation, contractInfo) {
  const { chainId, verifyingContract, name } = contractInfo;
  types.domain.chainId = chainId;
  types.domain.name = name;
  types.domain.verifyingContract = verifyingContract;
  const typedMessage = createTypedMessage(verifyingContract, signedRevocation.revocation, 'IntentionToRevoke', name, chainId);

  const signer = sigUtil.recoverTypedSignature({
    data: typedMessage.data,
    signature: signedRevocation.signature,
    version: 'V4',
  });
  return signer;
}

exports.validateInvitation = function validateInvitation (contractInfo, invitation) {
  const { chainId, verifyingContract, name } = contractInfo;

  if (!invitation) {
    throw new Error('Invitation is required');
  }

  const { signedDelegations, key } = invitation;

  // Trying to follow the code from Delegatable.sol as closely as possible here
  // To ensure readable correctness.
  let intendedSender = ROOT_AUTHORITY;
  let canGrant = intendedSender.toLowerCase();
  let authHash;

  for (let d = 0; d < signedDelegations.length; d++) {
    const signedDelegation = signedDelegations[d];
    const delegationSigner = recoverDelegationSigner(signedDelegation, {
      chainId,
      verifyingContract,
      name: CONTRACT_NAME,
    }).toLowerCase();

    if (d === 0) {
      intendedSender = delegationSigner;
      canGrant = intendedSender.toLowerCase();
    }

    const delegation = signedDelegation.delegation;
    if (delegationSigner !== canGrant) {
      throw new Error(`Delegation signer ${delegationSigner} does not match required signer ${canGrant}`);
    }

    const delegationHash = util.createSignedDelegationHash(signedDelegation);

    // Skipping caveat evaluation for now

    authHash = delegationHash;
    canGrant = delegation.delegate.toLowerCase();
  }

  // TODO: Also verify the final canGrant equals the key address.
  // Not adding yet b/c I want it well tested when I add it.

  return !!invitation;
}

/* Allows a user to create a new invitation, which can be used to grant
 * that user's own permissions to the recipient.
 */
exports.signDelegation = function signDelegation (contractInfo = {}, privateKey) {
  const { chainId, verifyingContract, name } = contractInfo;

  const util = exports.generateUtil(contractInfo)
  const delegate = secp.utils.randomPrivateKey();
  const delegatePubKey = secp.getPublicKey(delegate);
  const delegatePubKeyHash = keccak_256(delegatePubKey, 32);
  const delegateAddress = exports.toHexString(delegatePubKeyHash.subarray(24));

  // Prepare the delegation message.
  // This contract is also a revocation enforcer, so it can be used for caveats:
  const delegation = {
    delegate: exports.toHexString(delegateAddress),
    authority: '0x0000000000000000000000000000000000000000000000000000000000000000',
    caveats: [{
      enforcer: verifyingContract,
      terms: '0x0000000000000000000000000000000000000000000000000000000000000000',
    }],
  };

  const typedMessage = createTypedMessage(verifyingContract, delegation, 'Delegation', name, chainId);
  const signature = sigUtil.signTypedData({
    privateKey: exports.fromHexString(privateKey.indexOf('0x') === 0 ? privateKey.substring(2) : privateKey),
    data: typedMessage.data,
    version: 'V4',
  });
  const signedDelegation = {
    signature,
    delegation,
  }
  return signedDelegation;
}

/* Allows a user to create a new invitation, which creates a
 * delegated delegation to another user.
 */
exports.createInvitation = function createInvitation (contractInfo, recipientAddress, invitation) {
  const { chainId, verifyingContract, name } = contractInfo;
  const { signedDelegations, key } = invitation;

  const signedDelegation = signedDelegations[signedDelegations.length - 1];
  const delegationHash = util.createSignedDelegationHash(signedDelegation);
  const hexHash = '0x' + delegationHash.toString('hex');

  let delegateAddress, delegate;
  if (!recipientAddress) {
    delegate = secp.utils.randomPrivateKey();
    delegateAddress = secp.getPublicKey(delegate);
  } else {
   delegateAddress = recipientAddress; 
  }

  const delegation = {
    delegate: delegateAddress,
    authority: hexHash,

    // Revokable by default:
    caveats: [{
      enforcer: verifyingContract,
      terms: '0x0000000000000000000000000000000000000000000000000000000000000000',
    }]
  }

  const newSignedDelegation = exports.signDelegation(delegation, key, {
    chainId,
    verifyingContract: verifyingContract,
    name: CONTRACT_NAME,
  }, key);
  const newInvite = {
    signedDelegations: [...signedDelegations, newSignedDelegation],
  }

  // If a recipient was specified, we just attach the intended address.
  // If no recipient was specified, we include the delegate key.
  if (key) {
    newInvite.key = key.toString('hex');
  } else {
    newInvite.address = delegateAddress;
  }
  return newInvite;
}

/* This is designed to be a particularly convenient method for interacting with delegations.
 * It creates an object that can be used to sign a delegation, or revoke a delegation.
 */
exports.createMembership = function createMembership (contractInfo, power) {
  let { invitation, key } = power;
  if (!invitation && !key) {
    throw new Error('Either an invitation or a key is required.');
  }
  if (!key) {
    key = invitation.key;
  }

  return {
    createInvitation (recipientAddress) {
      if (invitation) {
        return createInvitation(contractInfo, recipientAddress, invitation);
      } else {
        return signDelegation(contractInfo, key);
      }
    },

    signInvocation (desiredTx) {
      return exports.signInvocation(desiredTx, key, contractInfo);
    },

    signRevocationMessage (signedInvitation) {
      const { signedDelegations } = signedInvitation;
      const lastDelegation = signedDelegations[signedDelegations.length - 1];

      // Owner revokes outstanding delegation
      const intentionToRevoke = {
        delegationHash: TypedDataUtils.hashStruct('SignedDelegation', lastDelegation, types, true)
      }
      return util.signRevocation(intentionToRevoke, key);
    }
  }
}

exports.fromHexString = function fromHexString (hexString) {
  if (!hexString || typeof hexString !== 'string') {
    throw new Error('Expected a hex string.');
  }
  const matched = hexString.match(/.{1,2}/g)
  if (!matched) {
    throw new Error('Expected a hex string.');
  }
  const mapped = matched.map(byte => parseInt(byte, 16));
  if (!mapped || mapped.length !== 32) {
    throw new Error('Expected a hex string.');
  }
  return new Uint8Array(mapped);
}

exports.toHexString = function toHexString (buffer) {
  return [...buffer].map(x => x.toString(16).padStart(2, '0')).join('');
}
