# Counterfactual Delegator

A solidity subclass for enabling any evm smart contract to support counterfactual chains of delegation with arbitrary caveats.

You can read more about what that means, [you can read this](https://roamresearch.com/#/app/capabul/page/cnW_23H8w).

## Usage

Not that this is far enough along to really use yet, but the intention is that you will:

- inherit your contract from `contracts/Delegatable.sol`.
- Use the msgSender() "standard" trick: Never call `msg.sender` directly to enforce policy, always call `msgSender()`, so that metaTransactions and other parts of code can assign a custom sender. [Examples here](https://github.com/anydotcrypto/metatransactions).

## Development

To test, you'll need to run the local hardhat test network. In a separate terminal, you can run `npx hardhat node --network hardhat`. On a M1 mac, you may need to run node 15 to do this, even though the rest of hardhat seems to require node 12. I recommend using [nvm](https://github.com/nvm-sh/nvm) for node version management in general, and it shines in situations like this.

You can run the tests with `npx hardhat test`.

I use [nodemon](https://www.npmjs.com/package/nodemon) to re-run tests on file changes, I bet there's a more hardhat way to do it, too, but it works fine. For example, to re-run on a change of `contracts/Delegatable.sol`, the main abstract contract, I run: `nodemon --exec "npx hardhat test" ./contracts/Delegatable.sol`

