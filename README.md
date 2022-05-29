# Delegatable

An abstract solidity contract that any contract can easily integrate to add a ton of improvements to that contract's user and developer experience for all of its functions:
- Allow users to sign "invocations" instead of transactions, which bring lots of benefits.
- Invocations bring the full user-readability of [signTypedData](https://docs.metamask.io/guide/signing-data.html#sign-typed-data-v4) for all of that app's operations.
- Support for MetaTransactions
- Support for batched operations: Many actions in one transaction, and potentially lower gas costs.
- Support for signing multiple actions that aren't blocked by each other, so an urgent transaction isn't blocked by the low nonce of a low-stakes low-gas bid transaction.
- Support for signing commitments that can be lazily submitted to the blockchain later.
- Allow users to sign offchain messages that delegate authority to perform any action they can perform, along with an open-ended system for adding restrictions to that delegation, including revocation.
- Allow the holder of any delegation to issue a delegation from it, also with an off-chain signature and no up-front gas.
- Allows creating invite links to users who don't have accounts set up yet, by signing delegations to a key you send to them.

You can read about [the theory behind this library here](https://roamresearch.com/#/app/capabul/page/cnW_23H8w).

## Integration in a Solidity project

```
pragma solidity ^0.8.13;

import "./Delegatable.sol";

contract YourContract is Delegatable {

  constructor(string memory name) Delegatable(name, "1") {}

  function _msgSender () internal view override(Delegatable, Context) returns (address sender) {
    if(msg.sender == address(this)) {
      bytes memory array = msg.data;
      uint256 index = msg.data.length;
      assembly {
        // Load the 32 bytes word from memory with the address on the lower 20 bytes, and mask those.
        sender := and(mload(add(array, index)), 0xffffffffffffffffffffffffffffffffffffffff)
      }
    } else {
      sender = msg.sender;
    }
    return sender;
  }

}
```

To use this in your own contract, follow these simple steps:
- inherit your contract from [contracts/Delegatable.sol](./packages/hardhat/contracts/Delegatable.sol).
- Your constructor will need to pass the `Delegatable` class a name for your contract, and a version string, per [EIP 712](https://eips.ethereum.org/EIPS/eip-712).
- Add our sample `_msgSender()` method to your contract, as seen in [our sample contract](./packages/hardhat/contracts/YourContract.sol).
- If you are inheriting from any contracts that use `msg.sender` to identify a user, you should now use the `_msgSender()` method instead, to benefit from this framework. Conveniently, it seems that most [OpenZeppelin libraries](https://openzeppelin.com/contracts/) already use an internal `_msgSender()` implementation, and so overriding it as shown should be enough to use those libraries.

## Integration into a web frontend

You can see a working web frontend at [MobyMask](https://github.com/danfinlay/MobyMask/).

I've started assembling a useful utility for managing memberships & delegations in JS as `eth-delegatable-utils` ([npm](https://www.npmjs.com/package/eth-delegatable-utils), [github](https://github.com/danfinlay/delegatable-eth/tree/main/packages/js-eth-delegatable-utils))

These contracts should be compatible with any signer or wallet that supports [signTypedData_v4, like MetaMask](https://docs.metamask.io/guide/signing-data.html#sign-typed-data-v4).

You will be calling the `eth_signTypedData` method with the `V4` parameter, as seen in [the test files](./packages/hardhat/test/myTest.js).

## How it's set up

A fork of Scaffold-ETH boilerplate

Currently most of the good stuff is going on in `packages/hardhat`.

> everything you need to build on Ethereum! 🚀

🧪 Quickly experiment with Solidity using a frontend that adapts to your smart contract:

![image](https://user-images.githubusercontent.com/2653167/124158108-c14ca380-da56-11eb-967e-69cde37ca8eb.png)


# 🏄‍♂️ Quick Start

Prerequisites: [Node](https://nodejs.org/en/download/) plus [Yarn](https://classic.yarnpkg.com/en/docs/install/) and [Git](https://git-scm.com/downloads)

> clone/fork 🏗 scaffold-eth:

```bash
git clone https://github.com/austintgriffith/scaffold-eth.git
```

> install and start your 👷‍ Hardhat chain:

```bash
cd scaffold-eth
yarn install
yarn chain
```

> in a second terminal window, start your 📱 frontend:

```bash
cd scaffold-eth
yarn start
```

> in a third terminal window, 🛰 deploy your contract:

```bash
cd scaffold-eth
yarn deploy
```

🔏 Edit your smart contract `YourContract.sol` in `packages/hardhat/contracts`

📝 Edit your frontend `App.jsx` in `packages/react-app/src`

💼 Edit your deployment scripts in `packages/hardhat/deploy`

📱 Open http://localhost:3000 to see the app

# 📚 Documentation

Documentation, tutorials, challenges, and many more resources, visit: [docs.scaffoldeth.io](https://docs.scaffoldeth.io)

# 🔭 Learning Solidity

📕 Read the docs: https://docs.soliditylang.org

📚 Go through each topic from [solidity by example](https://solidity-by-example.org) editing `YourContract.sol` in **🏗 scaffold-eth**

- [Primitive Data Types](https://solidity-by-example.org/primitives/)
- [Mappings](https://solidity-by-example.org/mapping/)
- [Structs](https://solidity-by-example.org/structs/)
- [Modifiers](https://solidity-by-example.org/function-modifier/)
- [Events](https://solidity-by-example.org/events/)
- [Inheritance](https://solidity-by-example.org/inheritance/)
- [Payable](https://solidity-by-example.org/payable/)
- [Fallback](https://solidity-by-example.org/fallback/)

📧 Learn the [Solidity globals and units](https://solidity.readthedocs.io/en/v0.6.6/units-and-global-variables.html)

# 🛠 Buidl

Check out all the [active branches](https://github.com/austintgriffith/scaffold-eth/branches/active), [open issues](https://github.com/austintgriffith/scaffold-eth/issues), and join/fund the 🏰 [BuidlGuidl](https://BuidlGuidl.com)!


 - 🚤  [Follow the full Ethereum Speed Run](https://medium.com/@austin_48503/%EF%B8%8Fethereum-dev-speed-run-bd72bcba6a4c)


 - 🎟  [Create your first NFT](https://github.com/austintgriffith/scaffold-eth/tree/simple-nft-example)
 - 🥩  [Build a staking smart contract](https://github.com/austintgriffith/scaffold-eth/tree/challenge-1-decentralized-staking)
 - 🏵  [Deploy a token and vendor](https://github.com/austintgriffith/scaffold-eth/tree/challenge-2-token-vendor)
 - 🎫  [Extend the NFT example to make a "buyer mints" marketplace](https://github.com/austintgriffith/scaffold-eth/tree/buyer-mints-nft)
 - 🎲  [Learn about commit/reveal](https://github.com/austintgriffith/scaffold-eth/tree/commit-reveal-with-frontend)
 - ✍️  [Learn how ecrecover works](https://github.com/austintgriffith/scaffold-eth/tree/signature-recover)
 - 👩‍👩‍👧‍👧  [Build a multi-sig that uses off-chain signatures](https://github.com/austintgriffith/scaffold-eth/tree/meta-multi-sig)
 - ⏳  [Extend the multi-sig to stream ETH](https://github.com/austintgriffith/scaffold-eth/tree/streaming-meta-multi-sig)
 - ⚖️  [Learn how a simple DEX works](https://medium.com/@austin_48503/%EF%B8%8F-minimum-viable-exchange-d84f30bd0c90)
 - 🦍  [Ape into learning!](https://github.com/austintgriffith/scaffold-eth/tree/aave-ape)

# 💬 Support Chat

Join the telegram [support chat 💬](https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA) to ask questions and find others building with 🏗 scaffold-eth!

---

🙏 Please check out our [Gitcoin grant](https://gitcoin.co/grants/2851/scaffold-eth) too!
