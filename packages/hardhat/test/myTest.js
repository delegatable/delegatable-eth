const { expect } = require("chai");
const { ethers } = require("hardhat");
const friendlyTypes = require('../types');
const BigNumber = ethers.BigNumber;
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

const types = signTypedDataify(friendlyTypes);
const CONTRACT_NAME = 'YourContract';
const ownerHexPrivateKey = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const delegateHexPrivKey = '59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

describe(CONTRACT_NAME, function () {

  /** 
  it('setPurpose by owner changes purpose', async () => {
    const targetString = 'A totally new purpose!'
    const yourContract = await deployContract();
    await yourContract.setPurpose(targetString);
    expect(await yourContract.purpose()).to.equal(targetString);
  });

  it('other accounts cannot set purpose', async () => {
    const [owner, addr1] = await ethers.getSigners();
    const targetString = 'A totally BAD purpose!'
    const yourContract = await deployContract();
    try {
      await yourContract.connect(addr1).setPurpose(targetString);
    } catch (err) {
      expect(err.message).to.include('Ownable: caller is not the owner');
    }
  });
  **/

  it('can sign a delegation to a second account', async () => {
    const [owner, addr1, addr2] = await ethers.getSigners();
    console.log(`Owner: ${owner.address}`);
    console.log(`Addr1: ${addr1.address}`);
    console.log(`Addr2: ${addr2.address}`);
    const targetString = 'A totally DELEGATED purpose!'
    const yourContract = await deployContract();

    const domainHash = await yourContract.domainHash();
    console.log('contract domainHash:', domainHash);

    // Prepare the delegation message:
    // This message has no caveats, and authority 0,
    // so it is a simple delegation to addr1 with no restrictions,
    // and will allow the delegate to perform any action the signer could perform on this contract.
    const delegation = {
      delegate: addr1.address,
      authority: '0x0000000000000000000000000000000000000000000000000000000000000000',
      caveats: [],
    };
    const primaryType = 'Delegation';
    const typedMessage = createTypedMessage(yourContract, delegation, primaryType);

    // Owner signs the delegation:
    console.log(`Signing delegation with owner keyring`);
    const privateKey = fromHexString(ownerHexPrivateKey);
    const signature = sigUtil.signTypedData_v4(
      privateKey,
      typedMessage
    );
    const signedDelegation = {
      signature,
      delegation,
    }
    console.log(`delegation signature is ${signature}`);
    // Delegate signs the invocation message:
    console.log(`Signing invocation with delegate keyring`);
    const desiredTx = await yourContract.populateTransaction.setPurpose(targetString);
    const delegatePrivateKey = fromHexString(delegateHexPrivKey);
    const invocationMessage = {
      batch: [{
        authority: [signedDelegation],
        replayProtection: {
          nonce: '0x0000000000000000000000000000000000000000000000000000000000000000',
          queue: '0x0000000000000000000000000000000000000000000000000000000000000000',
        },
        transaction: {
          to: yourContract.address,
          from: owner.address,
          gasLimit: '10000000000000000',
          data: desiredTx.data,
        },
      }],
    };
    console.log("Trying to invoke tx with data:", invocationMessage.batch[0].transaction.data);
    const typedInvocationMessage = createTypedMessage(yourContract, invocationMessage, 'Invocations');
    const invocationSig = sigUtil.signTypedData_v4(
      delegatePrivateKey,
      typedInvocationMessage
    );
    const signedInvocation = {
      signature: invocationSig,
      invocations: invocationMessage,
    }

    // A third party can submit the invocation method to the chain:
    //console.log(`Submitting invocation with third party keyring`);
    try {
      //console.log(JSON.stringify(signedInvocation, null, 2));
      const res = await yourContract.connect(addr2).invoke([signedInvocation]);
      //console.log('tx res', res);
      const block = await ethers.provider.getBlock(res.blockHash);
      //console.log('block', block);
      const tx = await ethers.provider.getTransactionReceipt(res.hash);
      //console.log('tx receipt', tx);
    } catch (err) {
      console.log(`Problem`, err);
      console.trace(err);
    }

    // await timeout(100);

    // Verify the change was made:
    expect(await yourContract.purpose()).to.equal(targetString);
  })
});

async function createAccounts(num = 10) {
  const accounts = [];

  for (let i = 0; i < num; i++) {
    const keyring = new Keyring();
    await keyring.addAccounts(1);
    accounts.push(keyring);
  }

  return accounts;
}

async function createDelegations (bidNumbers, yourContract) {
  const delegations = [];
  const accounts = await createAccounts(bidNumbers.length);

  for (let i = 0; i < bidNumbers.length; i++) {
    const [address] = await accounts[i].getAccounts()
    await giveEtherTo(address);

    const signer = new ethers.Wallet(accounts[i].wallets[0].privateKey, ethers.provider);

    const message = {
    };

    const typedMessage = createTypedMessage(yourContract, message);

    const typedMessageParams = {
      data: typedMessage,
      version: 'V4',
    }

    const signature = sigUtil.signTypedData_v4(accounts[i].wallets[0].privateKey, typedMessageParams);

    const signedBid = {
      bid: message,
      sig: signature,
    };

    delegations.push(signedBid);
  }

  return delegations;
}

async function deployContract () {
  const YourContract = await ethers.getContractFactory(CONTRACT_NAME);
  const yourContract = await YourContract.deploy(CONTRACT_NAME);
  return yourContract.deployed();
}

function createTypedMessage (yourContract, message, primaryType) {
  const chainId = yourContract.deployTransaction.chainId;
  return { data: {
    types,
    primaryType,
    domain: {
      name: CONTRACT_NAME,
      version: '1',
      chainId,
      verifyingContract: yourContract.address,
    },
    message,
  }};
}

async function giveEtherTo (address) {
  const [owner] = await ethers.getSigners();
  await owner.sendTransaction({
    to: address,
    value: BigNumber.from(10).pow(18),
  });
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

async function timeout (ms) {
  return new Promise ((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, ms); 
  });
}
