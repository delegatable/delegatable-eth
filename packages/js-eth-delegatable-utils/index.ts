const types = require('./types')
const createTypedMessage = require('./createTypedMessage');
const sigUtil = require('@metamask/eth-sig-util');
const {
  TypedDataUtils,
} = sigUtil;

const { abi } = require('./artifacts');
const typedMessage = require('./types');
const Keyring = require('eth-simple-keyring');
const { ethers } = require('ethers');

type SignedDelegation = {
  signature: string,
  delegation: SignedDelegation,
}

type Delegation = {
  delegate: string,
  authority: string,
  caveats: Array<Caveat>,
}

type Caveat = {
  enforcer: string,
  terms: string,
}

type Invitation = KeylessInvitation | KeyedInvitation;

type KeylessInvitation = {
  signedDelegations: Array<SignedDelegation>,
  contractInfo?: ContractInfo,
}

type KeyedInvitation = KeylessInvitation &{
  key: string,
}

type InvokableTransaction = {
  to: string,
  gasLimit: string,
  data: string,
}

type Invocation = {
  transaction: InvokableTransaction,
  authority: SignedDelegation[],
}

type Invocations = {
  batch: Invocation[],
  replayProtection: ReplayProtection,
}

type SignedInvocation = {
  invocations: Invocations,
  signature: string,
}

type ReplayProtection = {
  nonce: string,
  queue: string,
}

type ContractInfo = {
  verifyingContract: string,
  name: string,
  chainId: number,
}

type OwnerMembershipOpts = {
  contractInfo: ContractInfo,
  key: string,
}

type KeyInviteMembershipOpts = {
  invitation: Invitation,
  key: string,
}

type KeylessInviteMembershipOpts = {
  invitation: Invitation,
}

type MembershipOpts = OwnerMembershipOpts | KeyInviteMembershipOpts | KeylessInviteMembershipOpts;

type IntentionToRevoke = {
  delegationHash: string,
};
type SignedIntentionToRevoke = {
  signature: string,
  intentionToRevoke: IntentionToRevoke,
}

type Membership = {
  createInvitation (opts?: { recipientAddress?: string, delegation?: Delegation }): Invitation,
  createMembershipFromDelegation (delegation: Delegation): Membership,
  signDelegation (delegation: Delegation): SignedDelegation,
  signInvocations (invocations: Invocations): SignedInvocation,
  signRevocationMessage (invitation: Invitation): SignedIntentionToRevoke 
}

/* This is designed to be a particularly convenient method for interacting with delegations.
 * It creates an object that can be used to sign a delegation, or revoke a delegation.
 * It can also be used to create invitation objects, and can be instantiated with those invitation objects.
 */
exports.createMembership = function createMembership (opts: MembershipOpts): Membership {
  let invitation: any, key, contractInfo;

  if ('invitation' in opts) {
    invitation = opts.invitation;
  }

  if ('key' in opts) {
    key = opts.key;
  }

  if ('contractInfo' in opts) {
    contractInfo = opts.contractInfo;
  }

  if (!invitation && !key) {
    throw new Error('Either an invitation or a key is required to initialize membership.');
  }

  if (!key && invitation) {
    key = invitation.key;

    if (!contractInfo && invitation.contractInfo) {
      contractInfo = invitation.contractInfo;
    }
  }

  if (invitation) {
    exports.validateInvitation({ invitation, contractInfo });
  }

  if (!contractInfo || !contractInfo.verifyingContract) {
    throw new Error('Contract info must be provided to initialize membership.');
  }

  return {
    createInvitation ({ recipientAddress, delegation } = {}): Invitation {

      if (!invitation) {
        return exports.createFirstDelegatedInvitation({ contractInfo, recipientAddress, delegation, key });
      }

      // Having an invitation means there may be signedDelegations to chain from:
      if (invitation?.signedDelegations?.length === 0) {
        const newInvitation = exports.createFirstDelegatedInvitation({ contractInfo, recipientAddress, delegation, key });
        exports.validateInvitation({ invitation: newInvitation, contractInfo });
        return newInvitation;
      } else {
        const newInvitation = exports.createDelegatedInvitation({
          contractInfo,
          invitation,
          delegation,
          key,
        });
        exports.validateInvitation({ invitation: newInvitation, contractInfo });
        return newInvitation;
      }
    },

    createMembershipFromDelegation (delegation: Partial<Delegation>) {
      if (invitation) {

        const { signedDelegations } = invitation;

        if (invitation) {
          const { signedDelegations } = invitation;
          const lastSignedDelegation = signedDelegations[signedDelegations.length - 1];
          const delegationHash = exports.createSignedDelegationHash(lastSignedDelegation);
          const hexHash = '0x' + delegationHash.toString('hex');
          delegation.authority = hexHash;
        } else {
          delegation.authority = '0x0000000000000000000000000000000000000000000000000000000000000000';
        }

        const newInvitation = exports.createDelegatedInvitation({
          contractInfo,
          recipientAddress: delegation.delegate,
          invitation,
          delegation,
        });

        if (!newInvitation.key) {
          // We can allow instantiating with a local delegate key later,
          // but for now it seems like a less common use case so I'm not prioritizing it.
          throw new Error('Cannot create a membership object without a signing key.');
        }
        return exports.createMembership({
          invitation: newInvitation,
          contractInfo,
        });
      }

      delegation.authority = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const firstInvitation = exports.createFirstDelegatedInvitation({
        contractInfo,
        recipientAddress: delegation.delegate,
        delegation,
        key,
      })

      return exports.createMembership({
        invitation: firstInvitation,
        contractInfo,
      });
    },

    signDelegation (delegation: Delegation) {

      if (invitation) {
        const { signedDelegations } = invitation;
        const lastSignedDelegation = signedDelegations[signedDelegations.length - 1];
        const delegationHash = exports.createSignedDelegationHash(lastSignedDelegation);
        const hexHash = '0x' + delegationHash.toString('hex');
        delegation.authority = hexHash;
      } else {
        delegation.authority = '0x0000000000000000000000000000000000000000000000000000000000000000';
      }

      // function signDelegation ({ delegation, key, contractInfo }):
      return exports.signDelegation({ contractInfo, delegation, key }) 
    },

    signInvocations (invocations: Invocations) {
      invocations.batch.forEach((invocation: Invocation )=> {
        if (invitation && invitation.signedDelegations && invitation.signedDelegations.length > 0) {
          if (!('authority' in invocation)) {
            // TODO: See why this invocation is cast as never here:
            // invocation.authority = invitation.signedDelegations;
          }
        } else {
          invocation.authority = [];
        }
      })
      return exports.signInvocations({ invocations, privateKey: key, contractInfo });
    },

    signRevocationMessage (invitation: Invitation): SignedIntentionToRevoke {
      const { signedDelegations } = invitation;
      const lastDelegation = signedDelegations[signedDelegations.length - 1];

      // Owner revokes outstanding delegation
      const intentionToRevoke = {
        delegationHash: TypedDataUtils.hashStruct('SignedDelegation', lastDelegation, types, true)
      }
      return exports.signRevocation(intentionToRevoke, key);
    }
  }
}

// Util curries contract info into a reusable utility
exports.generateUtil = function generateUtil (contractInfo) {
  return {
    recoverSigner: (signedDelegation) => exports.recoverSigner(signedDelegation, contractInfo),

    signDelegation: (delegation, key) => exports.signDelegation({ delegation, key, contractInfo }),
    createInvitation: (delegation, privateKey) => exports.createInvitation({ delegation, privateKey, contractInfo }),
    recoverDelegationSigner: (signedDelegation) => exports.recoverDelegationSigner(signedDelegation, contractInfo),

    signInvocation: (invocation, privateKey) => exports.signInvocation({ invocation, privateKey, contractInfo }),
    recoverInvocationSigner: (signedInvocation) => exports.recoverInvocationSigner({ signedInvocation, contractInfo }),

    signRevocation: (revocation, privateKey) => exports.signRevocation(revocation, privateKey, contractInfo),
    recoverRevocationSignature: (signedRevocation) => exports.recoverRevocationSignature(signedRevocation, contractInfo),
  }
}

exports.createSignedDelegationHash = function createDelegationHash (signedDelegation) {
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

exports.recoverInvocationSigner = function recoverInvocationSigner ({ signedInvocation, contractInfo }
  : { signedInvocation: SignedInvocation, contractInfo: ContractInfo }) {
  const { chainId, verifyingContract, name } = contractInfo;
  types.domain.chainId = chainId;
  types.domain.name = name;
  types.domain.verifyingContract = verifyingContract;
  const typedMessage = createTypedMessage(verifyingContract, signedInvocation.invocations, 'Invocations', name, chainId);

  const signer = sigUtil.recoverTypedSignature({
    data: typedMessage.data,
    signature: signedInvocation.signature,
    version: 'V4',
  });
  return signer;
}

exports.signInvocation = function signInvocations({ invocation, privateKey, contractInfo }
  : { invocation: Invocation, privateKey: string, contractInfo: ContractInfo}): SignedInvocation {
  const { chainId, verifyingContract, name } = contractInfo;
  const invocations: Invocations = {
    batch: [invocation],
    replayProtection: {
      nonce: '0',
      queue: String(Math.floor(Math.random() * 1_000_000_000)),
    },
  };
  const typedMessage = createTypedMessage(verifyingContract, invocations, 'Invocations', name, chainId);

  const signature = sigUtil.signTypedData({
    privateKey: exports.fromHexString(privateKey.indexOf('0x') === 0 ? privateKey.substring(2) : privateKey),
    data: typedMessage.data,
    version: 'V4',
  });

  const signedInvocations = {
    signature,
    signerIsContract: false,
    invocations: invocations,
  }

  return signedInvocations[0];
}

exports.signInvocations = function signInvocations({ invocations, privateKey, contractInfo }
  : { invocations: Invocations, privateKey: string, contractInfo: ContractInfo}): SignedInvocation {
  const { chainId, verifyingContract, name } = contractInfo;
  const typedMessage = createTypedMessage(verifyingContract, invocations, 'Invocations', name, chainId);

  const signature = sigUtil.signTypedData({
    privateKey: exports.fromHexString(privateKey.indexOf('0x') === 0 ? privateKey.substring(2) : privateKey),
    data: typedMessage.data,
    version: 'V4',
  });

  const signedInvocations = {
    signature,
    invocations: invocations,
  }

  return signedInvocations;
}

exports.signDelegation = function signDelegation ({ delegation, key, contractInfo }): SignedDelegation {
  const { chainId, verifyingContract, name } = contractInfo;
  const typedMessage = createTypedMessage(verifyingContract, delegation, 'Delegation', name, chainId);

  const signature = sigUtil.signTypedData({
    privateKey: exports.fromHexString(key.indexOf('0x') === 0 ? key.substring(2) : key),
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
    privateKey: exports.fromHexString(privateKey.indexOf('0x') === 0 ? privateKey.substring(2) : privateKey),
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

exports.validateInvitation = function validateInvitation ({ contractInfo, invitation }) {
  const { chainId, verifyingContract, name } = contractInfo;

  if (!invitation) {
    throw new Error('Invitation is required');
  }

  const { signedDelegations, key } = invitation;

  if (signedDelegations.length === 0 && key && typeof key === 'string') {
    // we have to assume this is a root invitation, and cannot really validate it without trying things on chain.
    return true;
  }

  // Trying to follow the code from Delegatable.sol as closely as possible here
  // To ensure readable correctness.
  let intendedSender = exports.recoverDelegationSigner(signedDelegations[0], {
    chainId,
    verifyingContract,
    name,
  }).toLowerCase();
  let canGrant = intendedSender.toLowerCase();
  let authHash;

  for (let d = 0; d < signedDelegations.length; d++) {
    const signedDelegation = signedDelegations[d];
    const delegationSigner = exports.recoverDelegationSigner(signedDelegation, {
      chainId,
      verifyingContract,
      name,
    }).toLowerCase();

    if (d === 0) {
      intendedSender = delegationSigner;
      canGrant = intendedSender.toLowerCase();
    }

    const delegation = signedDelegation.delegation;
    if (delegationSigner !== canGrant) {
      throw new Error(`Delegation signer ${delegationSigner} of delegation ${d} does not match required signer ${canGrant}`);
    }

    const delegationHash = exports.createSignedDelegationHash(signedDelegation);

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
exports.createInvitation = function createInvitation (opts: {
  privateKey: string,
  contractInfo: ContractInfo,
  recipientAddress: string,
}) {
  const { contractInfo, privateKey, recipientAddress } = opts;
  const { chainId, verifyingContract, name } = contractInfo;

  if (recipientAddress) {
    return exports.createDelegatedInvitation(opts);
  }

  let delegate: DAccount = exports.generateAccount();

  // Prepare the delegation message.
  // This contract is also a revocation enforcer, so it can be used for caveats:
  const delegation = {
    delegate: exports.toHexString(delegate.address),
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
  const invitation = {
    signedDelegations: [signedDelegation],
    key: delegate.key,
  }
  return invitation;
}

/* Allows a user to create a new invitation, which creates a
 * delegated delegation to another user.
 */
exports.createDelegatedInvitation = function createDelegatedInvitation({
  contractInfo, recipientAddress, invitation, delegation, key
}): Invitation {
  const { verifyingContract } = contractInfo;
  const { signedDelegations } = invitation;
  const delegatorKey = key || invitation.key;

  const signedDelegation = signedDelegations[signedDelegations.length - 1];
  const delegationHash = exports.createSignedDelegationHash(signedDelegation);
  const hexHash = '0x' + delegationHash.toString('hex');

  if (delegation && delegation.delegate) { 
    recipientAddress = delegation.delegate;
  }

  let delegate: DAccount;
  if (!recipientAddress) {
    delegate = exports.generateAccount();
  } else {
    delegate = {
      address: recipientAddress || delegation.delegate
    }
  }

  if (!delegation) {
    delegation = {
      delegate: delegate.address,
      authority: hexHash,

      // defer to parent contract as caveat by default:
      caveats: [{
        enforcer: verifyingContract,
        terms: '0x0000000000000000000000000000000000000000000000000000000000000000',
      }]
    }
  }

  if (!delegation.authority) {
    delegation.authority = hexHash;
  }

  const newSignedDelegation = exports.signDelegation({
    key: delegatorKey,
    contractInfo,
    delegation,
  });

  const newInvite: Invitation = {
    signedDelegations: [...signedDelegations, newSignedDelegation],
    key: delegate?.key || undefined,
  }

  return newInvite;
}

/* Allows an owner to create a delegation
  * to another user.
  * Unlike createDelegatedInvitation, this one does not require an existing invtation,
  * and can create a first delegation from just a key.
  */
exports.createFirstDelegatedInvitation = function createFirstDelegatedInvitation({
  contractInfo, recipientAddress, key, delegation
}): Invitation {
  const { verifyingContract } = contractInfo;

  let delegate: DAccount;
  if (!recipientAddress) {
    delegate = exports.generateAccount();
    recipientAddress = delegate.address;
  } else {
    delegate = {
      address: recipientAddress
    }
  }

  if (!delegation) {
    delegation = {
      delegate: recipientAddress,
      authority: '0x0000000000000000000000000000000000000000000000000000000000000000',

      // defer to parent contract as caveat by default:
      caveats: [{
        enforcer: verifyingContract,
        terms: '0x0000000000000000000000000000000000000000000000000000000000000000',
      }]
    }
  } else {
    if (!delegation.authority) {
      delegation.authority = '0x0000000000000000000000000000000000000000000000000000000000000000';
    }
  }

  const newSignedDelegation = exports.signDelegation({ delegation, key, contractInfo });
  const newInvite: Invitation = {
    signedDelegations: [newSignedDelegation],
    key: delegate?.key || undefined,
  }

  return newInvite;
}

exports.fromHexString = function fromHexString (hexString: string): Uint8Array {
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

exports.toHexString = function toHexString (buffer: Uint8Array): string {
  return [...buffer].map(x => x.toString(16).padStart(2, '0')).join('');
}

type DAccount = {
  key?: string,
  address: string,
}

exports.generateAccount = function generateAccount (): DAccount {
  const wallet = ethers.Wallet.createRandom();
  const address = wallet.address;
  const key = wallet.privateKey;
  const account = {
    address,
    key: key,
  }
  return account;
}

exports.addressForKey = function addressForKey (key: string): string {
  const wallet = ethers.Wallet.fromPrivateKey(key);
  return wallet.address;
}
