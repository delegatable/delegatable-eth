const { expect } = require("chai");
const { ethers } = require("hardhat");
const friendlyTypes = require('../types');
const BigNumber = ethers.BigNumber;
const { createMembership } = require('eth-delegatable-utils'); 
const createTypedMessage = require('../scripts/createTypedMessage');
const sigUtil = require('eth-sig-util');
const {
  TypedDataUtils,
} = sigUtil;
const {
  typedSignatureHash,
  encodeData,
} = TypedDataUtils;
const { encode } = require("punycode");
const { TIMEOUT } = require("dns");
const { create } = require("domain");

const types = signTypedDataify(friendlyTypes);
const CONTRACT_NAME = 'YourContract';
const ownerHexPrivateKey = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const account1PrivKey = '59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const account2PrivKey = '5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';

require('../contracts/caveat-enforcers/index.test.js');
require('../contracts/examples/erc20.test.js');

describe(CONTRACT_NAME, function () {

  it('setPurpose by owner changes purpose', async () => {
    const targetString = 'A totally new purpose!'
    const yourContract = await deployContract();
    await yourContract.setPurpose(targetString);
    expect(await yourContract.purpose()).to.equal(targetString);
  });

  it('other accounts cannot set purpose', async () => {
    const [_owner, addr1] = await ethers.getSigners();
    const targetString = 'A totally BAD purpose!'
    const yourContract = await deployContract();
    try {
      await yourContract.connect(addr1).setPurpose(targetString);
    } catch (err) {
      expect(err.message).to.include('Ownable: caller is not the owner');
    }
  });

  /*
  it('can sign a delegation to a second account', async () => {
    const [owner, addr1, addr2] = await ethers.getSigners();
    console.log(`owner: ${owner.address}`);
    console.log(`addr1: ${addr1.address}`);
    console.log(`addr2: ${addr2.address}`);

    const targetString = 'A totally DELEGATED purpose!'
    const yourContract = await deployContract();
    const { chainId } = await yourContract.provider.getNetwork();
    const contractInfo = {
      chainId,
      verifyingContract: yourContract.address,
      name: CONTRACT_NAME,      
    };
    const membership1 = createMembership({
      key: ownerHexPrivateKey,
      contractInfo,
    })

    // Prepare the delegation message:
    // This message has no caveats, and authority 0,
    // so it is a simple delegation to addr1 with no restrictions,
    // and will allow the delegate to perform any action the signer could perform on this contract.
    const delegation = {
      delegate: addr1.address,
      authority: '0x0000000000000000000000000000000000000000000000000000000000000000',
      caveats: [],
    };

    // Owner signs the delegation:
    const signedDelegation = util.signDelegation(delegation, ownerHexPrivateKey);

    // Delegate signs the invocation message:
    const desiredTx = await yourContract.populateTransaction.setPurpose(targetString);
    const delegatePrivateKey = fromHexString(account1PrivKey);
    const invocationMessage = {
      replayProtection: {
        nonce: '0x01',
        queue: '0x00',
      },
      batch: [{
        authority: [signedDelegation],
        transaction: {
          to: yourContract.address,
          gasLimit: '10000000000000000',
          data: desiredTx.data,
        },
      }],
    };
    const typedInvocationMessage = createTypedMessage(yourContract, invocationMessage, 'Invocations', CONTRACT_NAME);
    const invocationSig = sigUtil.signTypedData_v4(
      delegatePrivateKey,
      typedInvocationMessage
    );
    const signedInvocation = {
      signature: invocationSig,
      invocations: invocationMessage,
    }

    // A third party can submit the invocation method to the chain:
    const res = await yourContract.connect(addr2).invoke([signedInvocation]);

    // Verify the change was made:
    expect(await yourContract.purpose()).to.equal(targetString);
  })
  */

  it('delegates can delegate', async () => {
    const [owner, addr1, addr2, addr3] = await ethers.getSigners();
    console.log(`owner: ${owner.address}`);
    console.log(`addr1: ${addr1.address}`);
    console.log(`addr2: ${addr2.address}`);
    console.log(`addr3: ${addr3.address}`);

    const targetString = 'A totally DELEGATED purpose!'
    const yourContract = await deployContract();
    const { chainId } = await yourContract.provider.getNetwork();
    const contractInfo = {
      chainId,
      verifyingContract: yourContract.address,
      name: CONTRACT_NAME,      
    };
    const ownerMembership = createMembership({
      contractInfo,
      key: ownerHexPrivateKey,
    })


    /* If no delegation object is provided, a basic one is automatically generated.
     * The verifyingContract is used as a base caveat, and is passed terms of 0.
     */
    const account1Invitation = ownerMembership.createInvitation({
      recipientAddress: addr1.address,
      delegation: {
        delegate: addr1.address,
        authority: '0x0000000000000000000000000000000000000000000000000000000000000000',
        caveats: [],
      }
    });

    // Create a delegated signer as a "membership":
    const account1Membership = createMembership({
      invitation: account1Invitation,
      key: account1PrivKey,
      contractInfo,
    });

    // First delegate signs the second delegation:
    const delegation2 = {
      delegate: addr2.address,
      // Absent authority will auto generate from the invitation that initialized this membership.
      caveats: [],
    };
    const account2Invitation = account1Membership.createInvitation({
      delegation: delegation2,
    });
    const account2Membership = createMembership({
      invitation: account2Invitation,
      key: account2PrivKey,
      contractInfo,
    });

    // Second delegate signs the invocation message:
    const desiredTx = await yourContract.populateTransaction.setPurpose(targetString);
    const invocationMessage = {
      replayProtection: {
        nonce: '0x01',
        queue: '0x00',
      },
      batch: [{
        transaction: {
          to: yourContract.address,
          gasLimit: '10000000000000000',
          data: desiredTx.data,
        },
      }],
    };
    const signedInvocations = account2Membership.signInvocations(invocationMessage);

    // A third party can submit the invocation method to the chain:
    const res = await yourContract.connect(addr3).invoke([signedInvocations]);

    // Verify the change was made:
    expect(await yourContract.purpose()).to.equal(targetString);
  })

  /*
  it('can allow-list a method with a caveat and it works', async () => {
    const [owner, addr1, addr2] = await ethers.getSigners();
    console.log(`owner: ${owner.address}`);
    console.log(`addr1: ${addr1.address}`);
    console.log(`addr2: ${addr2.address}`);

    const targetString = 'A totally DELEGATED purpose!'
    const yourContract = await deployContract();
    const { chainId } = await yourContract.provider.getNetwork();
    const contractInfo = {
      chainId,
      verifyingContract: yourContract.address,
      name: CONTRACT_NAME,      
    };
    const util = generateUtil(contractInfo);

    const AllowListEnforcer = await ethers.getContractFactory('AllowedMethodsEnforcer');
    const allowListEnforcer = await AllowListEnforcer.deploy();
    await yourContract.deployed();
    const desiredTx = await yourContract.populateTransaction.setPurpose(targetString);
    const methodSig = desiredTx.data.substr(0, 10);

    // Prepare the delegation message:
    // This message has no caveats, and authority 0,
    // so it is a simple delegation to addr1 with no restrictions,
    // and will allow the delegate to perform any action the signer could perform on this contract.
    const delegation = {
      delegate: addr1.address,
      authority: '0x0000000000000000000000000000000000000000000000000000000000000000',
      caveats: [{
        enforcer: allowListEnforcer.address,
        terms: methodSig
      }],
    };

    // Owner signs the delegation:
    const signedDelegation = util.signDelegation(delegation, ownerHexPrivateKey);

    // Delegate signs the invocation message:
    const delegatePrivateKey = fromHexString(account1PrivKey);
    const invocationMessage = {
      replayProtection: {
        nonce: '0x01',
        queue: '0x00',
      },
      batch: [{
        authority: [signedDelegation],
        transaction: {
          to: yourContract.address,
          gasLimit: '10000000000000000',
          data: desiredTx.data,
        },
      }],
    };
    const typedInvocationMessage = createTypedMessage(yourContract, invocationMessage, 'Invocations', CONTRACT_NAME);
    const invocationSig = sigUtil.signTypedData_v4(
      delegatePrivateKey,
      typedInvocationMessage
    );
    const signedInvocation = {
      signature: invocationSig,
      invocations: invocationMessage,
    }

    // A third party can submit the invocation method to the chain:
    const res = await yourContract.connect(addr2).invoke([signedInvocation]);

    // Verify the change was made:
    expect(await yourContract.purpose()).to.equal(targetString);
  })

  it('can allow-list a method with a caveat and disallows another method', async () => {
    const [owner, addr1, addr2] = await ethers.getSigners();
    console.log(`owner: ${owner.address}`);
    console.log(`addr1: ${addr1.address}`);
    console.log(`addr2: ${addr2.address}`);

    const targetString = 'A totally DELEGATED purpose!'
    const yourContract = await deployContract();
    const { chainId } = await yourContract.provider.getNetwork();
    const contractInfo = {
      chainId,
      verifyingContract: yourContract.address,
      name: CONTRACT_NAME,      
    };
    const util = generateUtil(contractInfo);

    const AllowListEnforcer = await ethers.getContractFactory('AllowedMethodsEnforcer');
    const allowListEnforcer = await AllowListEnforcer.deploy();
    await yourContract.deployed();
    const desiredTx = await yourContract.populateTransaction.setPurpose(targetString);

    // Prepare the delegation message:
    // This message has no caveats, and authority 0,
    // so it is a simple delegation to addr1 with no restrictions,
    // and will allow the delegate to perform any action the signer could perform on this contract.
    const delegation = {
      delegate: addr1.address,
      authority: '0x0000000000000000000000000000000000000000000000000000000000000000',
      caveats: [{
        enforcer: allowListEnforcer.address,
        terms: '0x00000000', 
      }],
    };

    // Owner signs the delegation:
    const signedDelegation = util.signDelegation(delegation, ownerHexPrivateKey);

    // Delegate signs the invocation message:
    const delegatePrivateKey = fromHexString(account1PrivKey);
    const invocationMessage = {
      replayProtection: {
        nonce: '0x01',
        queue: '0x00',
      },
      batch: [{
        authority: [signedDelegation],
        transaction: {
          to: yourContract.address,
          gasLimit: '10000000000000000',
          data: desiredTx.data,
        },
      }],
    };
    const typedInvocationMessage = createTypedMessage(yourContract, invocationMessage, 'Invocations', CONTRACT_NAME);
    const invocationSig = sigUtil.signTypedData_v4(
      delegatePrivateKey,
      typedInvocationMessage
    );
    const signedInvocation = {
      signature: invocationSig,
      invocations: invocationMessage,
    }

    try {
      const res = await yourContract.connect(addr2).invoke([signedInvocation]);
    } catch (err) {
      expect (err.message).to.include('Caveat rejected');
    }
  });
  */
});

async function deployContract () {
  const YourContract = await ethers.getContractFactory(CONTRACT_NAME);
  const yourContract = await YourContract.deploy(CONTRACT_NAME);
  return yourContract.deployed();
}

function fromHexString (hexString) {
  return new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}

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
