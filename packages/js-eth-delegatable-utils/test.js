const test = require('tape');
const { recoverSigner, signDelegation, createMembership } = require('./index.js');
const sigUtil = require('@metamask/eth-sig-util');

const address = '0xa2c5B479d1758C48c68540F554cDAeDda2340630';
const PRIV_KEY = 'acc9d5cfcfa55e0e333e7eeed12ef4157627ec7de87ab7944ed97fcd481d8b51';

test('membership API requires power', async (t) => {
  const contractInfo = {
    chainId: 1337,
    verifyingContract: '0x336E14B1723Dc5A57769F0aa5C409F476Ee8B333',
    name: "PhisherRegistry",
  }

  try {
    const aliceMembership = createMembership(contractInfo);
  } catch (err) {
    t.equals(err.message, 'Either an invitation or a key is required to initialize membership.');
  }
});

test('membership API can delegate to new key', async (t) => {
    const contractInfo = {
    chainId: 1337,
    verifyingContract: '0x336E14B1723Dc5A57769F0aa5C409F476Ee8B333',
    name: "PhisherRegistry",
  }

  const aliceMembership = createMembership({
    contractInfo,
    key: PRIV_KEY,
  });
  t.ok(aliceMembership);

  const invitation = aliceMembership.createInvitation();
  t.ok(invitation);

  const bobMembership = createMembership({
    contractInfo,
    invitation,
  });
  t.end();
});
