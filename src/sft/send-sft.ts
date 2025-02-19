import prompts, { PromptObject } from 'prompts';
import { exit } from 'process';
import {
  TokenPayment,
  Transaction,
  ESDTNFTTransferPayloadBuilder,
  Address,
} from '@elrondnetwork/erdjs';
import axios from 'axios';

import { areYouSureAnswer, setup, commonTxOperations } from '../utils';
import { chain, shortChainId, publicApi } from '../config';

const promptQuestions: PromptObject[] = [
  {
    type: 'text',
    name: 'address',
    message: 'Please provide the erd address (receiver)\n',
    validate: (value) => (!value ? 'Required!' : true),
  },
  {
    type: 'text',
    name: 'token',
    message: 'Please provide the SFT token id (ex. ABCD-ds323d-0d)\n',
    validate: (value) => (!value ? 'Required!' : true),
  },
  {
    type: 'text',
    name: 'amount',
    message:
      'Please provide the amount of SFT to send (ex. 1 is 1 amount of an SFT token)\n',
    validate: (value) =>
      value && !Number.isNaN(value) && Number(value) > 0
        ? true
        : `Please provide a number, should be a proper SFT amount for that specific token, bigger than 0`,
  },
];

export const sendSft = async () => {
  try {
    const { address, token, amount } = await prompts(promptQuestions);

    if (!address || !token || !amount) {
      console.log('You have to provide the address, SFT token id and amount!');
      exit(9);
    }

    await areYouSureAnswer();

    const { signer, userAccount, provider } = await setup();

    const sftOnNetwork = await axios.get<{ nonce: number; ticker: string }>(
      `${publicApi[chain]}/nfts/${token.trim()}`,
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    const nonce = sftOnNetwork?.data?.nonce;
    const collectionTicker = sftOnNetwork?.data?.ticker;

    if (
      nonce !== undefined &&
      nonce !== null &&
      collectionTicker !== undefined &&
      collectionTicker !== null
    ) {
      const payment = TokenPayment.semiFungible(
        collectionTicker,
        nonce,
        amount
      );
      const data = new ESDTNFTTransferPayloadBuilder()
        .setPayment(payment)
        .setDestination(new Address(address.trim()))
        .build();

      const tx = new Transaction({
        nonce,
        data,
        gasLimit: 50000 + 1500 * data.length() + 300000,
        receiver: signer.getAddress(), // Same as sender address!
        sender: signer.getAddress(),
        chainID: shortChainId[chain],
      });

      await commonTxOperations(tx, userAccount, signer, provider);
    } else {
      console.log(
        "Can't get the information about the SFT token on the network. Check configuration and chain type."
      );
    }
  } catch (e) {
    console.log((e as Error)?.message);
  }
};
