const { types } = require('./types');

module.exports = function createTypedMessage (verifyingContract, message, primaryType, contractName, chainId) {
  console.log('creating typed message with', [...arguments])
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

