const { types } = require('./types');

module.exports = function createTypedMessage (verifyingContract, message, primaryType, contractName, chainId) {
  return { data: {
    types,
    primaryType,
    domain: {
      name: contractName,
      version: '1',
      chainId,
      verifyingContract,
    },
    message,
  }};
}

