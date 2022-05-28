const { expect } = require("chai");
const { ethers } = require("hardhat");
const types = require('../../scripts/friendlyTypes');
const BigNumber = ethers.BigNumber;
const createTypedMessage = require('../../scripts/createTypedMessage');
const sigUtil = require('eth-sig-util');
const {
  TypedDataUtils,
} = sigUtil;

const CONTRACT_NAME = 'DelegatableToken';
const ownerHexPrivateKey = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const account1PrivKey = '59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const account2PrivKey = '5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';

require('../caveat-enforcers/index.test.js');

describe(CONTRACT_NAME, function () {

  it('basic send works', async () => {
    const [_owner, addr1] = await ethers.getSigners();
    const amountToSend = '10';

    // Deploy
    const YourContract = await ethers.getContractFactory(CONTRACT_NAME);
    const yourContract = await YourContract.deploy(CONTRACT_NAME, 'TST', '100');
    await yourContract.deployed();

    await yourContract.transfer(addr1.address, amountToSend);
    expect(await yourContract.balanceOf(addr1.address)).to.equal(amountToSend);
  });

  it('basic delegated send works', async () => {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const amountToSend = '10';

    // Deploy
    const YourContract = await ethers.getContractFactory(CONTRACT_NAME);
    const yourContract = await YourContract.deploy(CONTRACT_NAME, 'TST', '100');
    await yourContract.deployed();

    // Delegate
    // Prepare the delegation message:
    // This message has no caveats, and authority 0,
    // so it is a simple delegation to addr1 with no restrictions,
    // and will allow the delegate to perform any action the signer could perform on this contract.
    const delegation = {
      delegate: addr1.address,
      authority: '0x0000000000000000000000000000000000000000000000000000000000000000',
      caveats: [],
    };
    const typedMessage = createTypedMessage(yourContract, delegation, 'Delegation', CONTRACT_NAME);

    // Owner signs the delegation:
    const privateKey = fromHexString(ownerHexPrivateKey);
    const signature = sigUtil.signTypedData_v4(
      privateKey,
      typedMessage
    );
    const signedDelegation = {
      signature,
      delegation,
    }

    // Delegate signs the invocation message:
    const desiredTx = await yourContract.populateTransaction.transfer(addr2.address, amountToSend);
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
    expect(await yourContract.balanceOf(addr2.address)).to.equal(amountToSend);
  });

  it('basic delegated send within allowance works', async () => {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const amountToSend = '10';

    // Deploy
    const YourContract = await ethers.getContractFactory(CONTRACT_NAME);
    const yourContract = await YourContract.deploy(CONTRACT_NAME, 'TST', '100');
    await yourContract.deployed();

    // Deploy caveat
    const ALLOWANCE = 'ERC20Allowance';
    const AllowanceEnforcer = await ethers.getContractFactory(ALLOWANCE);
    const allowanceEnforcer = await AllowanceEnforcer.deploy();
    await yourContract.deployed();

    // Delegate
    // Prepare the delegation message:
    // This message has no caveats, and authority 0,
    // so it is a simple delegation to addr1 with no restrictions,
    // and will allow the delegate to perform any action the signer could perform on this contract.
    const delegation = {
      delegate: addr1.address,
      authority: '0x0000000000000000000000000000000000000000000000000000000000000000',
      caveats: [{
        enforcer: allowanceEnforcer.address,
        terms: '0xF000000000000000000000000000000000000000000000000000000000000001',
      }],
    };
    const typedMessage = createTypedMessage(yourContract, delegation, 'Delegation', CONTRACT_NAME);

    // Owner signs the delegation:
    const privateKey = fromHexString(ownerHexPrivateKey);
    const signature = sigUtil.signTypedData_v4(
      privateKey,
      typedMessage
    );
    const signedDelegation = {
      signature,
      delegation,
    }

    // Delegate signs the invocation message:
    const desiredTx = await yourContract.populateTransaction.transfer(addr2.address, amountToSend);
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
    expect(await yourContract.balanceOf(addr2.address)).to.equal(amountToSend);
  });


  it('basic delegated send exceeding allowance fails', async () => {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const amountToSend = '10';

    // Deploy
    const YourContract = await ethers.getContractFactory(CONTRACT_NAME);
    const yourContract = await YourContract.deploy(CONTRACT_NAME, 'TST', '100');
    await yourContract.deployed();

    // Deploy caveat
    const ALLOWANCE = 'ERC20Allowance';
    const AllowanceEnforcer = await ethers.getContractFactory(ALLOWANCE);
    const allowanceEnforcer = await AllowanceEnforcer.deploy();
    await yourContract.deployed();

    // Delegate
    // Prepare the delegation message:
    // This message has no caveats, and authority 0,
    // so it is a simple delegation to addr1 with no restrictions,
    // and will allow the delegate to perform any action the signer could perform on this contract.
    const delegation = {
      delegate: addr1.address,
      authority: '0x0000000000000000000000000000000000000000000000000000000000000000',
      caveats: [{
        enforcer: allowanceEnforcer.address,
        terms: '0x0000000000000000000000000000000000000000000000000000000000000001',
      }],
    };
    const typedMessage = createTypedMessage(yourContract, delegation, 'Delegation', CONTRACT_NAME);

    // Owner signs the delegation:
    const privateKey = fromHexString(ownerHexPrivateKey);
    const signature = sigUtil.signTypedData_v4(
      privateKey,
      typedMessage
    );
    const signedDelegation = {
      signature,
      delegation,
    }

    // Delegate signs the invocation message:
    const desiredTx = await yourContract.populateTransaction.transfer(addr2.address, amountToSend);
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
    try {
      const res = await yourContract.connect(addr2).invoke([signedInvocation]);
    } catch (err) {
      expect(err.message).to.include('Allowance exceeded');
    }
  });

  it('multiple delegated sends exceeding allowance fails', async () => {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const amountToSend = '10';

    // Deploy
    const YourContract = await ethers.getContractFactory(CONTRACT_NAME);
    const yourContract = await YourContract.deploy(CONTRACT_NAME, 'TST', '100');
    await yourContract.deployed();

    // Deploy caveat
    const ALLOWANCE = 'ERC20Allowance';
    const AllowanceEnforcer = await ethers.getContractFactory(ALLOWANCE);
    const allowanceEnforcer = await AllowanceEnforcer.deploy();
    await yourContract.deployed();

    // Delegate
    // Prepare the delegation message:
    // This message has no caveats, and authority 0,
    // so it is a simple delegation to addr1 with no restrictions,
    // and will allow the delegate to perform any action the signer could perform on this contract.
    const delegation = {
      delegate: addr1.address,
      authority: '0x0000000000000000000000000000000000000000000000000000000000000000',
      caveats: [{
        enforcer: allowanceEnforcer.address,
        terms: '0x00000000000000000000000000000000000000000000000000000000000000a0', // Hex for 10
      }],
    };
    const typedMessage = createTypedMessage(yourContract, delegation, 'Delegation', CONTRACT_NAME);

    // Owner signs the delegation:
    const privateKey = fromHexString(ownerHexPrivateKey);
    const signature = sigUtil.signTypedData_v4(
      privateKey,
      typedMessage
    );
    const signedDelegation = {
      signature,
      delegation,
    }

    // Delegate signs five messages of 2 and is permitted
    for (let i = 0; i < 5; i++) {
      // Delegate signs the invocation message:
      const desiredTx = await yourContract.populateTransaction.transfer(addr2.address, i * 2);
      const delegatePrivateKey = fromHexString(account1PrivKey);
      const invocationMessage = {
        replayProtection: {
          nonce: '0x' + (i + 1).toString(16),
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
      console.log(invocationMessage.replayProtection);
      const typedInvocationMessage = createTypedMessage(yourContract, invocationMessage, 'Invocations', CONTRACT_NAME);
      const invocationSig = sigUtil.signTypedData_v4(
        delegatePrivateKey,
        typedInvocationMessage
      );
      const signedInvocation = {
        signature: invocationSig,
        invocations: invocationMessage,
      }

      console.log(`sending ${i * 2} to ${addr2.address}`);
      const res = await yourContract.connect(addr2).invoke([signedInvocation]);
      const balance = await yourContract.balanceOf(addr2.address);
      expect(balance).to.equal(i * 2);
    }

    // Delegate signs the second invocation message:
    const desiredTx2 = await yourContract.populateTransaction.transfer(addr2.address, amountToSend);
    const invocationMessage2 = {
      replayProtection: {
        nonce: '0x02',
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
    const typedInvocationMessage2 = createTypedMessage(yourContract, invocationMessage2, 'Invocations', CONTRACT_NAME);
    const invocationSig2 = sigUtil.signTypedData_v4(
      delegatePrivateKey,
      typedInvocationMessage2
    );
    const signedInvocation2 = {
      signature: invocationSig2,
      invocations: invocationMessage2,
    }

    // A third party can submit the invocation method to the chain:
    try {
      const res = await yourContract.connect(addr2).invoke([signedInvocation2]);
    } catch (err) {
      expect(err.message).to.include('Allowance exceeded');
    }
  });
});

function fromHexString (hexString) {
  return new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}
