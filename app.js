const { default: axios } = require('axios');
const { Telegraf } = require('telegraf');
require('dotenv').config();

const chatId = process.env.CHAT_ID;
const witnetExplorer = process.env.WITNET_EXPLORER;
const whaleThreshold = process.env.WHALE_THRESHOLD;
const bot = new Telegraf(process.env.BOT_TOKEN);

const HASH = 0;
const EPOCH = 1;
const TRANSACTION_VALUE = 4;
const CONFIRMATION = 10;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const constructTgMessage = (hash, value) => {
  let msg = '🐳🐳 <b>WHALE ALERT</b> 🐳🐳\n\n';
  msg += `A TXN involving <code>${value}</code> WITs has occurred.\n\n`;
  msg += `🔍 ${witnetExplorer}/search/${hash}`;
  return msg;
}

const getBlockTxns = (hash) => new Promise((resolve) => {
  axios.get(`${witnetExplorer}/api/hash?value=${hash}`)
    .then(res => {
      const data = res.data;
      resolve(data.value_transfer_txns);
    })
    .catch(err => {
      console.log(err);
      resolve(null);
    });
});

// TODO: add timeout
const getLastEpoch = () => new Promise((resolve) => {
  axios.get(`${witnetExplorer}/api/blockchain?action=init&block=-1`)
    .then(res => {
      const data = res.data;
      let lastEpoch = null;
      if (data.blockchain) {
        lastEpoch = data.blockchain[0][EPOCH];
      }
      resolve(lastEpoch);
    })
    .catch(err => {
      console.log(err);
      resolve(null);
    });
});

const getBlocks = (epoch) => new Promise((resolve) => {
  axios.get(`${witnetExplorer}/api/blockchain?action=update&block=${epoch}`)
    .then(res => {
      const data = res.data;
      let blocks = null;
      if (data.blockchain) {
        blocks = data.blockchain;
      }
      resolve(blocks);
    })
    .catch(err => {
      console.log(err);
      resolve(null);
    });
});

const getLastConfirmedEpoch = async () => {
  const lastEpoch = await getLastEpoch();
  console.log(`last epoch: ${lastEpoch}`);
  let lastConfirmedEpoch = null;

  let epochOffset = 0;

  while(lastConfirmedEpoch == null) {
    epochOffset += 10;
    const readEpoch = lastEpoch - epochOffset;
    const blocks = await getBlocks(readEpoch);
    
    for (const block of blocks) {
      if (block[CONFIRMATION]) {
        lastConfirmedEpoch = block[EPOCH];
        break;
      }
    }
  }

  return lastConfirmedEpoch;
}

const explorerScanner = async () => {
  let lastReadEpoch = await getLastConfirmedEpoch() - 1;
  // let lastReadEpoch = 888302;

  while(true) {
    const lastEpoch = await getLastEpoch();
    console.log(`last epoch: ${lastEpoch}\nlast read epoch: ${lastReadEpoch}`);

    if (lastEpoch > lastReadEpoch) {
      const blocks = await getBlocks(lastReadEpoch);
      
      console.log(`found ${blocks.length} blocks`);
      let blockIndex = 1;
      for (const block of blocks) {
        console.log(`[${blockIndex++}/${blocks.length}] reading block ${block[HASH]}`);
        if (block[CONFIRMATION]) {
          lastReadEpoch = block[EPOCH];
          if (block[TRANSACTION_VALUE] > 0) {
            const txns = await getBlockTxns(block[HASH]);
            for (const txn of txns) {
              const hash = txn.txn_hash;
              const value = txn.value * 1e-9;

              if (value > whaleThreshold) {
                const msg = constructTgMessage(hash, value);
                await bot.telegram.sendMessage(chatId, msg, {parse_mode: 'html'})
              }

              await sleep(5000);
            }
          }
        }
      }
    }

    await sleep(1000);
  }
}

bot.launch();
console.log('Telegram bot is now running...');
explorerScanner();

// Graceful exits
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
