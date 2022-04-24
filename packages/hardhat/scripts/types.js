const typedMessage = {
  primaryType: 'Delegation',
  domain: {
    name: 'DelegatorTest',
    version: '1',
  },

  entries: {
    delegate: "address",
    caveat: "Caveat",
    authority: "SignedDelegation",
  },

  types: {
    Delegation: [
        { name: 'delegate', type: 'address' },
        { name: 'caveat', type: 'Caveat' },
        { name: 'authority', type: 'SignedDelegation' },
      ],
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Caveat: [
        { name: 'enforcer', type: 'address' },
        { name: 'terms', type: 'bytes' },
      ],
      SignedDelegation: [
        { name: 'delegation', type: 'Delegation' },
        { name: 'signature', type: 'bytes' },
      ],
      Invocation: [
        { name: 'transaction', type: 'Transaction' },
        { name: 'replayProtection', type: 'ReplayProtection' },
        { name: 'authority', type: 'SignedDelegation[]' },
      ],
      Invocations: [
        { name: 'batch', type: 'Invocation[]' },
      ],
      SignedInvocation: [
        { name: 'invocations', type: 'Invocations' },
        { name: 'signature', type: 'bytes' },
      ],
      Transaction: [
        { name: 'to', type: 'address' },
        { name: 'from', type: 'address' },
        { name: 'gasLimit', type: 'uint256' },
        { name: 'data', type: 'bytes' },
      ],
      ReplayProtection: [
        { name: 'nonce', type: 'uint256' },
        { name: 'queue', type: 'uint256' },
      ],
   }
};

module.exports = typedMessage;
