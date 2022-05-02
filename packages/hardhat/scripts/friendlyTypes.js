const types = require('./types');
module.exports = signTypedDataify(types);

function signTypedDataify (friendlyTypes) {
  const types = {};
  Object.keys(friendlyTypes).forEach(typeName => {
    const type = friendlyTypes[typeName];
    types[typeName] = [];

    Object.keys(friendlyTypes[typeName]).forEach(subTypeName => {

      const subType = friendlyTypes[typeName][subTypeName];
      types[typeName].push({
        name: subTypeName,
        type: subType,
      });
    });
  });
  return types;
}