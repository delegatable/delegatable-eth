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
   }
};

module.exports = typedMessage;
