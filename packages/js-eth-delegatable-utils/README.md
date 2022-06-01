# Eth Delegatable Utils

A JavaScript library for more easily managing invite links and signatures for [The Delegatable Framework](https://mirror.xyz/0x55e2780588aa5000F464f700D2676fD0a22Ee160/pTIrlopsSUvWAbnq1qJDNKU1pGNLP8VEn1H8DSVcvXM).

## Installation

`npm install eth-delegatable-utils -S`

## Usage

To understand how Delegatable works, it might help to review [the types it involves](https://github.com/danfinlay/delegatable-eth/blob/main/packages/hardhat/scripts/types.js).

In short:
- Any user can sign a `delegation` message.
- A `delegation` can have any number of `caveats`.
- A `caveat` specifies a contract that has the right to reject a proposed transaction.
- A `transaction` is specified within an `invocation`.
- An `invocation` is included in the batch of an `invocations` object (sorry!)
- Each `invocation` has an `authority` which is either an empty array (to be a normal MetaTransaction) or is an array of `delegation` objects that chain from the original signer to act as, up to the signer of this invocation.
- A `SignedInvocations` object is an authorized set of invocations to perform.

```javascript
import { createMembership } from 'eth-delegatable-utils';

// To initialize, you need the basic EIP-712 domain info:
const contractInfo = {
  chainId: 1337,
  verifyingContract: '0x336E14B1723Dc5A57769F0aa5C409F476Ee8B333',
  name: "PhisherRegistry",
}

// You can initialize a membership with a private key to allow a key to delegate:
const aliceMembership = createMembership({
  contractInfo,
  key: PRIV_KEY,
});

// Users can create invitations of their own
// Providing no arguments will result in an invitation that includes a key
// The recipient has to trust the sender, but hey, they already kinda did.
// The invitation object is JSON-serializable.
const invitation = aliceMembership.createInvitation();

// Memberships can be initialized with `invitation` objects:
const bobMembership = createMembership({
  contractInfo,
  invitation,
});

// Users can then sign invocations with their memberships.
// First we'll construct an invocation.
// Here's how you would use ethers to generate transaction data for a MetaTransaction.
// We'll add a better convenience method for this kind of thing later:
const desiredTx = await registry.populateTransaction.claimIfPhisher(`TWT:${_phisher.toLowerCase()}`, true);
const invocation = {
  transaction: {
    to: address,
    data: desiredTx.data,
    gasLimit: 500000,
  },
  authority: signedDelegations,
}

// The nonces don't need to block here because we also have a queue for the nonces.
// If you don't want to keep track of the nonces you can usually just pick a random queue.
const queue = Math.floor(Math.random() * 100000000);

// Then you can just sign the invocations:
const signedInvocations = membership.signInvocations({
  batch: invocations,
  replayProtection: {
    nonce: 1,
    queue,
  }
});

// Once the invocations are signed, then you can just call the `invoke()` function.
// Anyone can do this. They're just relaying the transaction now. The invocation signing
// is what authorized it.
return await registry.invoke([signedInvocations]);
```

