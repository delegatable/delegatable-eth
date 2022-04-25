# Counterfactual Delegator

A solidity subclass for enabling any evm smart contract to support counterfactual chains of delegation with arbitrary caveats, and MetaTransactions.

You can read more about what that means, [you can read this](https://roamresearch.com/#/app/capabul/page/cnW_23H8w).

## Usage

Not that this is far enough along to really use yet, but the intention is that you will:

- inherit your contract from `contracts/Delegatable.sol`.
- Use the msgSender() "standard" trick: Never call `msg.sender` directly to enforce policy, always call the internal private method `_msgSender()`, so that metaTransactions and other parts of code can assign a custom sender. [Examples here](https://github.com/anydotcrypto/metatransactions).
- If you are inheriting from multiple contracts that implement `_msgSender`, you may need to implement your own override method as shown in `contracts/YourContract.sol`.

## Development

Much of the typecode is auto-generated from the types file at [./scripts/types.js](./scripts/types.js). If you need to change types there, you will need to re-run `node scripts/typesToCodeCli.js` to update the appropriate files. The items that are updated are:
- The struct definitions themselves in [Delegatable.sol](./contracts/Delegatable.sol).
- The typehash definitions in [Delegatable.sol](./contracts/Delegatable.sol).
- The packetHash getter functions in [Delegatable.sol](./contracts/Delegatable.sol).
- This types file is also used directly by the test file, and can be used by any client code that needs to initiate a `signTypedData` signature from a user.

To test, you'll need to run the local hardhat test network. In a separate terminal, you can run `npx hardhat node --network hardhat`. On a M1 mac, you may need to run node 15 to do this, even though the rest of hardhat seems to require node 12. I recommend using [nvm](https://github.com/nvm-sh/nvm) for node version management in general, and it shines in situations like this.

You can run the tests with `npx hardhat test`.

I use [nodemon](https://www.npmjs.com/package/nodemon) to re-run tests on file changes, I bet there's a more hardhat way to do it, too, but it works fine. For example, to re-run on a change of `contracts/Delegatable.sol`, the main abstract contract, I run: `nodemon --exec "npx hardhat test" ./contracts/Delegatable.sol`

