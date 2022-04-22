module.exports = {

  EIP712Domain: {
    name: 'string',
    version: 'string',
    chainId: 'uint256',
    verifyingContract: 'address',
  },

  Invocation: {
    transaction: 'Transaction',
    replayProtection: 'ReplayProtection',
    authority: 'SignedDelegation[]',
  },

  SignedInvocation: {
    invocation: 'Invocation[]',
    signature: 'bytes',
  },

  Transaction: {
    to: 'address',
    from: 'address',
    data: 'bytes',
  },

  ReplayProtection: {
    nonce: 'uint256',
    queue: 'uint256',
  },

  SignedDelegation: {
    delegation: 'Delegation',
    signature: 'bytes',
  },

  Delegation: {
    delegate: 'address',
    authority: 'bytes32',
    caveats: 'Caveat[]',
  },

  Caveat: {
    enforcer: 'address',
    terms: 'bytes',
  },

}