const test = require('tape');
const { recoverSigner, signDelegation } = require('./index.js');
const sigUtil = require('@metamask/eth-sig-util');

const address = '0xa2c5B479d1758C48c68540F554cDAeDda2340630';
const PRIV_KEY = 'acc9d5cfcfa55e0e333e7eeed12ef4157627ec7de87ab7944ed97fcd481d8b51';
const TYPED_MESSAGE = {
  "data": {
    "types": {
      "EIP712Domain": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "version",
          "type": "string"
        },
        {
          "name": "chainId",
          "type": "uint256"
        },
        {
          "name": "verifyingContract",
          "type": "address"
        }
      ],
      "Invocation": [
        {
          "name": "transaction",
          "type": "Transaction"
        },
        {
          "name": "authority",
          "type": "SignedDelegation[]"
        }
      ],
      "Invocations": [
        {
          "name": "batch",
          "type": "Invocation[]"
        },
        {
          "name": "replayProtection",
          "type": "ReplayProtection"
        }
      ],
      "SignedInvocation": [
        {
          "name": "invocations",
          "type": "Invocations"
        },
        {
          "name": "signature",
          "type": "bytes"
        }
      ],
      "Transaction": [
        {
          "name": "to",
          "type": "address"
        },
        {
          "name": "gasLimit",
          "type": "uint256"
        },
        {
          "name": "data",
          "type": "bytes"
        }
      ],
      "ReplayProtection": [
        {
          "name": "nonce",
          "type": "uint"
        },
        {
          "name": "queue",
          "type": "uint"
        }
      ],
      "Delegation": [
        {
          "name": "delegate",
          "type": "address"
        },
        {
          "name": "authority",
          "type": "bytes32"
        },
        {
          "name": "caveats",
          "type": "Caveat[]"
        }
      ],
      "Caveat": [
        {
          "name": "enforcer",
          "type": "address"
        },
        {
          "name": "terms",
          "type": "bytes"
        }
      ],
      "SignedDelegation": [
        {
          "name": "delegation",
          "type": "Delegation"
        },
        {
          "name": "signature",
          "type": "bytes"
        }
      ]
    },
    "primaryType": "Delegation",
    "domain": {
      "name": "PhisherRegistry",
      "version": "1",
      "chainId": 1337,
      "verifyingContract": "0x336E14B1723Dc5A57769F0aa5C409F476Ee8B333"
    },
    "message": {
      "delegate": "0x85643d57d8E7D600B912C60f61A785682b8C69da",
      "authority": "0x0000000000000000000000000000000000000000000000000000000000000000",
      "caveats": [
        {
          "enforcer": "0x336E14B1723Dc5A57769F0aa5C409F476Ee8B333",
          "terms": "0x0000000000000000000000000000000000000000000000000000000000000000"
        }
      ]
    }
  }
}

test('recover a signature', async (t) => {

  const contractInfo = {
    chainId: 1337,
    verifyingContract: '0x336E14B1723Dc5A57769F0aa5C409F476Ee8B333',
    name: "PhisherRegistry",
  }

  const signature = sigUtil.signTypedData({
    privateKey: fromHexString(PRIV_KEY),
    data: TYPED_MESSAGE.data,
    version: 'V4'
  });

  // exports.signDelegation = async function signDelegation (delegation, privateKey, contractInfo) {
  // const { chainId, verifyingContract, name } = contractInfo;
  const signedDelegation = signDelegation(contractInfo, PRIV_KEY);

  const recovered = recoverSigner(signedDelegation, {
    chainId: 1337,
    verifyingContract: '0x336E14B1723Dc5A57769F0aa5C409F476Ee8B333',
    name: "PhisherRegistry",
  });

  t.equals(recovered.toLowerCase(), address.toLowerCase(), 'address recovered');

});

function fromHexString (hexString) {
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

