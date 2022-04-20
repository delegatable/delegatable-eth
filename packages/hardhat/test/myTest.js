const { expect } = require("chai");
const { ethers } = require("hardhat");
const BigNumber = ethers.BigNumber;
const {
  recoverTypedSignature,
  signTypedData,
  TypedDataUtils,
  typedSignatureHash,
  SignTypedDataVersion,
} = require('signtypeddata-v5');

const Keyring = require('eth-simple-keyring');

describe("YourContract", function () {
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
      version: 'V5',
    }

    const signature = signTypedData(accounts[i].wallets[0].privateKey, typedMessageParams, 'V5');

    const signedBid = {
      bid: message,
      sig: signature,
    };

    delegations.push(signedBid);
  }

  return delegations;
}

async function deployContract () {
  const YourContract = await ethers.getContractFactory("YourContract");
  const yourContract = await YourContract.deploy("YourContract");
  return yourContract.deployed();
}

function createTypedMessage (yourContract, message) {
  const chainId = yourContract.deployTransaction.chainId;
  return {
    types,
    primaryType,
    domain: {
      name: 'YourContract',
      version: '1',
      chainId,
      verifyingContract: yourContract.address,
    },
    message,
  };
}

async function giveEtherTo (address) {
  const [owner] = await ethers.getSigners();
  await owner.sendTransaction({
    to: address,
    value: BigNumber.from(10).pow(18),
  });
}

