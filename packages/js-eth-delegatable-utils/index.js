var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var types = require('./types');
var createTypedMessage = require('./createTypedMessage');
var sigUtil = require('@metamask/eth-sig-util');
var TypedDataUtils = sigUtil.TypedDataUtils;
var abi = require('./artifacts').abi;
var typedMessage = require('./types');
var CONTRACT_NAME = 'PhisherRegistry';
var secp = require('@noble/secp256k1');
var keccak_256 = require('@noble/hashes/sha3').keccak_256;
/* This is designed to be a particularly convenient method for interacting with delegations.
 * It creates an object that can be used to sign a delegation, or revoke a delegation.
 * It can also be used to create invitation objects, and can be instantiated with those invitation objects.
 */
exports.createMembership = function createMembership(opts) {
    if (opts === void 0) { opts = {}; }
    var invitation = opts.invitation, key = opts.key, contractInfo = opts.contractInfo;
    if (!invitation && !key) {
        throw new Error('Either an invitation or a key is required to initialize membership.');
    }
    if (!key) {
        key = invitation.key;
        if (!contractInfo && invitation.contractInfo) {
            contractInfo = invitation.contractInfo;
        }
    }
    if (!contractInfo || !contractInfo.verifyingContract) {
        throw new Error('Contract info must be provided to initialize membership.');
    }
    return {
        createInvitation: function (_a) {
            var recipientAddress = _a.recipientAddress, delegation = _a.delegation;
            if (invitation) {
                if (!('authority' in delegation)) {
                    var signedDelegations = invitation.signedDelegations;
                    var lastSignedDelegation = signedDelegations[signedDelegations.length - 1];
                    var delegationHash = exports.createSignedDelegationHash(lastSignedDelegation);
                    var hexHash = '0x' + delegationHash.toString('hex');
                    delegation.authority = hexHash;
                }
                var newInvitation = exports.createDelegatedInvitation({
                    contractInfo: contractInfo,
                    recipientAddress: recipientAddress || delegation.delegate,
                    invitation: invitation,
                    delegation: delegation,
                    key: key
                });
                return newInvitation;
            }
            if (!('authority' in delegation)) {
                delegation.authority = '0x0000000000000000000000000000000000000000';
            }
            return exports.createFirstDelegatedInvitation({ contractInfo: contractInfo, recipientAddress: recipientAddress, delegation: delegation, key: key });
        },
        createMembershipFromDelegation: function (delegation) {
            if (invitation) {
                var signedDelegations = invitation.signedDelegations;
                if (invitation) {
                    var signedDelegations_1 = invitation.signedDelegations;
                    var lastSignedDelegation = signedDelegations_1[signedDelegations_1.length - 1];
                    var delegationHash = exports.createSignedDelegationHash(lastSignedDelegation);
                    var hexHash = '0x' + delegationHash.toString('hex');
                    delegation.authority = hexHash;
                }
                else {
                    delegation.authority = '0x0000000000000000000000000000000000000000000000000000000000000000';
                }
                var newInvitation = exports.createDelegatedInvitation({
                    contractInfo: contractInfo,
                    recipientAddress: delegation.delegate,
                    invitation: invitation,
                    delegation: delegation
                });
                if (!newInvitation.key) {
                    // We can allow instantiating with a local delegate key later,
                    // but for now it seems like a less common use case so I'm not prioritizing it.
                    throw new Error('Cannot create a membership object without a signing key.');
                }
                return exports.createMembership({
                    invitation: newInvitation,
                    contractInfo: contractInfo
                });
            }
            delegation.authority = '0x0000000000000000000000000000000000000000000000000000000000000000';
            var firstInvitation = exports.createFirstDelegatedInvitation({
                contractInfo: contractInfo,
                recipientAddress: delegation.delegate,
                delegation: delegation,
                key: key
            });
            return exports.createMembership({
                invitation: firstInvitation,
                contractInfo: contractInfo
            });
        },
        signDelegation: function (delegation) {
            if (invitation) {
                var signedDelegations = invitation.signedDelegations;
                var lastSignedDelegation = signedDelegations[signedDelegations.length - 1];
                var delegationHash = exports.createSignedDelegationHash(lastSignedDelegation);
                var hexHash = '0x' + delegationHash.toString('hex');
                delegation.authority = hexHash;
            }
            else {
                delegation.authority = '0x0000000000000000000000000000000000000000000000000000000000000000';
            }
            // function signDelegation ({ delegation, key, contractInfo }):
            return exports.signDelegation({ contractInfo: contractInfo, delegation: delegation, key: key });
        },
        signInvocations: function (invocations) {
            invocations.batch.forEach(function (invocation) {
                if (invitation) {
                    invocation.authority = invitation.signedDelegations;
                }
                else {
                    invocation.authority = [];
                }
            });
            return exports.signInvocations({ invocations: invocations, privateKey: key, contractInfo: contractInfo });
        },
        signRevocationMessage: function (invitation) {
            var signedDelegations = invitation.signedDelegations;
            var lastDelegation = signedDelegations[signedDelegations.length - 1];
            // Owner revokes outstanding delegation
            var intentionToRevoke = {
                delegationHash: TypedDataUtils.hashStruct('SignedDelegation', lastDelegation, types, true)
            };
            return exports.signRevocation(intentionToRevoke, key);
        }
    };
};
// Util curries contract info into a reusable utility
exports.generateUtil = function generateUtil(contractInfo) {
    return {
        recoverSigner: function (signedDelegation) { return exports.recoverSigner(signedDelegation, contractInfo); },
        signDelegation: function (delegation, key) { return exports.signDelegation({ delegation: delegation, key: key, contractInfo: contractInfo }); },
        createInvitation: function (delegation, privateKey) { return exports.createInvitation({ delegation: delegation, privateKey: privateKey, contractInfo: contractInfo }); },
        recoverDelegationSigner: function (signedDelegation) { return exports.recoverDelegationSigner(signedDelegation, contractInfo); },
        signInvocation: function (invocation, privateKey) { return exports.signInvocation({ invocation: invocation, privateKey: privateKey, contractInfo: contractInfo }); },
        recoverInvocationSigner: function (signedInvocation) { return exports.recoverInvocationSigner({ signedInvocation: signedInvocation, contractInfo: contractInfo }); },
        signRevocation: function (revocation, privateKey) { return exports.signRevocation(revocation, privateKey, contractInfo); },
        recoverRevocationSignature: function (signedRevocation) { return exports.recoverRevocationSignature(signedRevocation, contractInfo); }
    };
};
exports.createSignedDelegationHash = function createDelegationHash(signedDelegation) {
    var hash = TypedDataUtils.hashStruct('SignedDelegation', signedDelegation, types.types, 'V4');
    return hash;
};
exports.recoverDelegationSigner = function recoverDelegationSigner(signedDelegation, contractInfo) {
    var chainId = contractInfo.chainId, verifyingContract = contractInfo.verifyingContract, name = contractInfo.name;
    types.domain.chainId = chainId;
    types.domain.name = name;
    types.domain.verifyingContract = verifyingContract;
    var typedMessage = createTypedMessage(verifyingContract, signedDelegation.delegation, 'Delegation', name, chainId);
    var signer = sigUtil.recoverTypedSignature({
        data: typedMessage.data,
        signature: signedDelegation.signature,
        version: 'V4'
    });
    return signer;
};
exports.recoverSigner = exports.recoverDelegationSigner;
exports.recoverInvocationSigner = function recoverInvocationSigner(_a) {
    var signedInvocation = _a.signedInvocation, contractInfo = _a.contractInfo;
    var chainId = contractInfo.chainId, verifyingContract = contractInfo.verifyingContract, name = contractInfo.name;
    types.domain.chainId = chainId;
    types.domain.name = name;
    types.domain.verifyingContract = verifyingContract;
    var typedMessage = createTypedMessage(verifyingContract, signedInvocation.invocations, 'Invocations', name, chainId);
    var signer = sigUtil.recoverTypedSignature({
        data: typedMessage.data,
        signature: signedInvocation.signature,
        version: 'V4'
    });
    return signer;
};
exports.signInvocations = function signInvocations(_a) {
    var invocations = _a.invocations, privateKey = _a.privateKey, contractInfo = _a.contractInfo;
    var chainId = contractInfo.chainId, verifyingContract = contractInfo.verifyingContract, name = contractInfo.name;
    var typedMessage = createTypedMessage(verifyingContract, invocations, 'Invocations', name, chainId);
    var signature = sigUtil.signTypedData({
        privateKey: exports.fromHexString(privateKey.indexOf('0x') === 0 ? privateKey.substring(2) : privateKey),
        data: typedMessage.data,
        version: 'V4'
    });
    var signedInvocations = {
        signature: signature,
        invocations: invocations
    };
    return signedInvocations;
};
exports.signDelegation = function signDelegation(_a) {
    var delegation = _a.delegation, key = _a.key, contractInfo = _a.contractInfo;
    var chainId = contractInfo.chainId, verifyingContract = contractInfo.verifyingContract, name = contractInfo.name;
    var typedMessage = createTypedMessage(verifyingContract, delegation, 'Delegation', name, chainId);
    var signature = sigUtil.signTypedData({
        privateKey: exports.fromHexString(key.indexOf('0x') === 0 ? key.substring(2) : key),
        data: typedMessage.data,
        version: 'V4'
    });
    var signedDelegation = {
        signature: signature,
        delegation: delegation
    };
    return signedDelegation;
};
exports.signRevocation = function signRevocation(revocation, privateKey, contractInfo) {
    var chainId = contractInfo.chainId, verifyingContract = contractInfo.verifyingContract, name = contractInfo.name;
    var typedMessage = createTypedMessage(verifyingContract, revocation, 'IntentionToRevoke', name, chainId);
    var signature = sigUtil.signTypedData({
        privateKey: exports.fromHexString(privateKey.indexOf('0x') === 0 ? privateKey.substring(2) : privateKey),
        data: typedMessage.data,
        version: 'V4'
    });
    var signedRevocation = {
        signature: signature,
        intentionToRevoke: revocation
    };
    return signedRevocation;
};
exports.recoverRevocationSignature = function recoverRevocationSignature(signedRevocation, contractInfo) {
    var chainId = contractInfo.chainId, verifyingContract = contractInfo.verifyingContract, name = contractInfo.name;
    types.domain.chainId = chainId;
    types.domain.name = name;
    types.domain.verifyingContract = verifyingContract;
    var typedMessage = createTypedMessage(verifyingContract, signedRevocation.revocation, 'IntentionToRevoke', name, chainId);
    var signer = sigUtil.recoverTypedSignature({
        data: typedMessage.data,
        signature: signedRevocation.signature,
        version: 'V4'
    });
    return signer;
};
exports.validateInvitation = function validateInvitation(contractInfo, invitation) {
    var chainId = contractInfo.chainId, verifyingContract = contractInfo.verifyingContract, name = contractInfo.name;
    if (!invitation) {
        throw new Error('Invitation is required');
    }
    var signedDelegations = invitation.signedDelegations, key = invitation.key;
    // Trying to follow the code from Delegatable.sol as closely as possible here
    // To ensure readable correctness.
    var intendedSender = exports.recoverDelegationSigner(signedDelegations[0], {
        chainId: chainId,
        verifyingContract: verifyingContract,
        name: CONTRACT_NAME
    }).toLowerCase();
    var canGrant = intendedSender.toLowerCase();
    var authHash;
    for (var d = 0; d < signedDelegations.length; d++) {
        var signedDelegation = signedDelegations[d];
        var delegationSigner = exports.recoverDelegationSigner(signedDelegation, {
            chainId: chainId,
            verifyingContract: verifyingContract,
            name: CONTRACT_NAME
        }).toLowerCase();
        if (d === 0) {
            intendedSender = delegationSigner;
            canGrant = intendedSender.toLowerCase();
        }
        var delegation = signedDelegation.delegation;
        if (delegationSigner !== canGrant) {
            throw new Error("Delegation signer ".concat(delegationSigner, " does not match required signer ").concat(canGrant));
        }
        var delegationHash = exports.createSignedDelegationHash(signedDelegation);
        // Skipping caveat evaluation for now
        authHash = delegationHash;
        canGrant = delegation.delegate.toLowerCase();
    }
    // TODO: Also verify the final canGrant equals the key address.
    // Not adding yet b/c I want it well tested when I add it.
    return !!invitation;
};
/* Allows a user to create a new invitation, which can be used to grant
 * that user's own permissions to the recipient.
 */
exports.createInvitation = function createInvitation(opts) {
    var contractInfo = opts.contractInfo, privateKey = opts.privateKey, recipientAddress = opts.recipientAddress;
    var chainId = contractInfo.chainId, verifyingContract = contractInfo.verifyingContract, name = contractInfo.name;
    if (recipientAddress) {
        return exports.createDelegatedInvitation(opts);
    }
    var delegate = exports.generateAccount();
    // Prepare the delegation message.
    // This contract is also a revocation enforcer, so it can be used for caveats:
    var delegation = {
        delegate: exports.toHexString(delegate.address),
        authority: '0x0000000000000000000000000000000000000000000000000000000000000000',
        caveats: [{
                enforcer: verifyingContract,
                terms: '0x0000000000000000000000000000000000000000000000000000000000000000'
            }]
    };
    var typedMessage = createTypedMessage(verifyingContract, delegation, 'Delegation', name, chainId);
    var signature = sigUtil.signTypedData({
        privateKey: exports.fromHexString(privateKey.indexOf('0x') === 0 ? privateKey.substring(2) : privateKey),
        data: typedMessage.data,
        version: 'V4'
    });
    var signedDelegation = {
        signature: signature,
        delegation: delegation
    };
    var invitation = {
        signedDelegations: [signedDelegation],
        key: delegate.key
    };
    return invitation;
};
/* Allows a user to create a new invitation, which creates a
 * delegated delegation to another user.
 */
exports.createDelegatedInvitation = function createDelegatedInvitation(_a) {
    var contractInfo = _a.contractInfo, recipientAddress = _a.recipientAddress, invitation = _a.invitation, delegation = _a.delegation, key = _a.key;
    var chainId = contractInfo.chainId, verifyingContract = contractInfo.verifyingContract, name = contractInfo.name;
    var signedDelegations = invitation.signedDelegations;
    var delegatorKey = key || invitation.key;
    var signedDelegation = signedDelegations[signedDelegations.length - 1];
    var delegationHash = exports.createSignedDelegationHash(signedDelegation);
    var hexHash = '0x' + delegationHash.toString('hex');
    var delegate;
    if (!recipientAddress) {
        var delegate_1 = exports.generateAccount();
    }
    else {
        delegate = {
            address: recipientAddress
        };
    }
    if (!delegation) {
        delegation = {
            delegate: delegate.address,
            authority: hexHash,
            // defer to parent contract as caveat by default:
            caveats: [{
                    enforcer: verifyingContract,
                    terms: '0x0000000000000000000000000000000000000000000000000000000000000000'
                }]
        };
    }
    var newSignedDelegation = exports.signDelegation({
        key: delegatorKey,
        contractInfo: contractInfo,
        delegation: delegation
    });
    var newInvite = {
        signedDelegations: __spreadArray(__spreadArray([], __read(signedDelegations), false), [newSignedDelegation], false)
    };
    // If a recipient was specified, we just attach the intended address.
    // If no recipient was specified, we include the delegate key.
    if (delegate.key) {
        newInvite.key = delegate.key;
    }
    return newInvite;
};
/* Allows an owner to create a delegation
  * to another user.
  * Unlike createDelegatedInvitation, this one does not require an existing invtation,
  * and can create a first delegation from just a key.
  */
exports.createFirstDelegatedInvitation = function createFirstDelegatedInvitation(_a) {
    var contractInfo = _a.contractInfo, recipientAddress = _a.recipientAddress, key = _a.key, delegation = _a.delegation;
    var verifyingContract = contractInfo.verifyingContract;
    var delegate;
    if (!recipientAddress) {
        delegate = exports.generateAccount();
    }
    else {
        delegate = {
            address: recipientAddress
        };
    }
    if (!delegation) {
        delegation = {
            delegate: recipientAddress,
            authority: '0x0000000000000000000000000000000000000000000000000000000000000000',
            // defer to parent contract as caveat by default:
            caveats: [{
                    enforcer: verifyingContract,
                    terms: '0x0000000000000000000000000000000000000000000000000000000000000000'
                }]
        };
    }
    var newSignedDelegation = exports.signDelegation({ delegation: delegation, key: key, contractInfo: contractInfo });
    var newInvite = {
        signedDelegations: [newSignedDelegation]
    };
    // If a recipient was specified, we let them be implicit in the delegation. 
    // If no recipient was specified, we include the delegate key.
    if (!recipientAddress && (delegate === null || delegate === void 0 ? void 0 : delegate.key)) {
        newInvite.key = delegate.key;
    }
    return newInvite;
};
exports.fromHexString = function fromHexString(hexString) {
    if (!hexString || typeof hexString !== 'string') {
        throw new Error('Expected a hex string.');
    }
    var matched = hexString.match(/.{1,2}/g);
    if (!matched) {
        throw new Error('Expected a hex string.');
    }
    var mapped = matched.map(function (byte) { return parseInt(byte, 16); });
    if (!mapped || mapped.length !== 32) {
        throw new Error('Expected a hex string.');
    }
    return new Uint8Array(mapped);
};
exports.toHexString = function toHexString(buffer) {
    return __spreadArray([], __read(buffer), false).map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
};
exports.generateAccount = function generateAccount() {
    var privKey = secp.utils.randomPrivateKey();
    var pubKey = secp.getPublicKey(privKey);
    var pubKeyHash = keccak_256(pubKey, 32);
    var privKeyAddress = exports.toHexString(pubKeyHash.subarray(24));
    return {
        address: privKeyAddress,
        key: privKey
    };
};
