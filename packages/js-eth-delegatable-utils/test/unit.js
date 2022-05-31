const test = require('tape');
const { addressForKey } = require('../index.js');

test('address generation', async (t) => {
  t.plan(1);
  const key = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

  const result = await addressForKey(key);
  t.equal(result, address);
});