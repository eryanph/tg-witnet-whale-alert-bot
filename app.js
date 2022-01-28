import axios from 'axios';
import { Telegraf } from 'telegraf';
import dotenv from 'dotenv'
dotenv.config();

const startEpoch = process.env.EPOCH_START;
const chatIds = process.env.CHAT_ID.split(",");
const witnetExplorer = process.env.WITNET_EXPLORER;
const whaleThreshold = process.env.WHALE_THRESHOLD;
const bot = new Telegraf(process.env.BOT_TOKEN);

const explorerClient = axios.create({
  timeout: 30000,
  baseURL: witnetExplorer
})

const HASH = 0;
const EPOCH = 1;
const TRANSACTION_VALUE = 4;
const CONFIRMATION = 10;

const BLUE_WHALE_TIER = whaleThreshold * 2;
const KRAKEN_TIER = whaleThreshold * 10;
const LEVIATHAN_TIER = whaleThreshold * 20;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const request = (url) => new Promise(async (resolve) => {
  explorerClient.get(url)
    .then(res => {
      resolve(res.data);
    })
    .catch(err => {
      console.log(err);
      resolve(null);
    });
});

const getWhaleTier = (value) => {
  if (value < BLUE_WHALE_TIER) {
    return 'A <code>[humpback whale]</code> has made its move!';
  } else if (value < KRAKEN_TIER) {
    return 'A <code>[blue whale]</code> has made its appearance!';
  } else if (value < LEVIATHAN_TIER) {
    return 'A <code>[kraken]</code> has made its move!';
  } else {
    return 'A <code>[leviathan]</code> has revealed itself!';
  }
}

const constructTgMessage = (hash, value) => {
  let msg = '🐳🐳 <b>WHALE ALERT</b> 🐳🐳\n\n';
  msg += `${getWhaleTier(value)}\n\n`;
  msg += `A TXN involving <code>${value.toLocaleString()} WIT</code> has occurred.\n\n`;
  msg += `🔍 ${witnetExplorer}/search/${hash}`;
  return msg;
}

const getBlockTxns = async (hash) => {
  const data = await request(`/api/hash?value=${hash}`);
  if (data) {
    return data.value_transfer_txns;
  } else {
    return null;
  }
};

const getLastEpoch = async () => {
  const data = await request('/api/blockchain?action=init&block=-1');
  if (data) {
    let lastEpoch = null;
    if (data.blockchain) {
      try {
        lastEpoch = data.blockchain[0][EPOCH];
      } catch (err) {
        console.log(err);
      }
    }
    return lastEpoch;
  } else {
    return null;
  }
};

const getBlocks = async (epoch) => {
  const data = await request(`/api/blockchain?action=update&block=${epoch}`); 
  if (data) {
    let blocks = null;
    if (data.blockchain) {
      blocks = data.blockchain;
    }
    return blocks;
  } else {
    return null;
  }
};

const getLastConfirmedEpoch = async () => {
  const lastEpoch = await getLastEpoch();
  console.log(`last epoch: ${lastEpoch}`);

  if (lastEpoch) {
    let lastConfirmedEpoch = null;
    let epochOffset = 0;

    while (lastConfirmedEpoch == null) {
      const readEpoch = lastEpoch - epochOffset;
      const blocks = await getBlocks(readEpoch);
      
      if (blocks) {
        for (const block of blocks) {
          if (block[CONFIRMATION]) {
            lastConfirmedEpoch = block[EPOCH];
            break;
          }
        }
      } else {
        await sleep(1000);
        continue;
      }
      epochOffset += 10;
    }
    
    return lastConfirmedEpoch;
  } else {
    return null;
  }
}

const explorerScanner = async () => {
  let lastReadEpoch = null;
  while (lastReadEpoch == null) {
    if (startEpoch == -1) {
      lastReadEpoch = await getLastConfirmedEpoch() - 1;
    } else {
      lastReadEpoch = startEpoch;
    }

    if (lastReadEpoch == null) {
      await sleep(10000);
    }
  }

  while (true) {
    const lastEpoch = await getLastEpoch();

    if (lastEpoch) {
      console.log(`last epoch: ${lastEpoch}\nlast read epoch: ${lastReadEpoch}`);

      if (lastEpoch > lastReadEpoch) {
        const blocks = await getBlocks(lastReadEpoch);
        
        if (blocks) {
          console.log(`found ${blocks.length} blocks`);

          let blockIndex = 1;
          for (const block of blocks) {
            console.log(`[${blockIndex++}/${blocks.length}] reading block ${block[HASH]}`);

            if (block[CONFIRMATION]) {
              lastReadEpoch = block[EPOCH];

              if (block[TRANSACTION_VALUE] > 0) {
                console.log('- found transaction value. reading txns...');

                let txns = null;
                while (txns == null) {
                  txns = await getBlockTxns(block[HASH]);

                  if (txns == null) {
                    await sleep(10000);
                    console.log('- retrying reading txns...');
                  }
                }

                for (const txn of txns) {
                  const hash = txn.txn_hash;
                  console.log(`- reading txn ${hash}`);

                  const value = txn.value * 1e-9;
                  if (value >= whaleThreshold) {
                    console.log('- exceeded threshold. sending alert...')

                    const msg = constructTgMessage(hash, value);
                    for (const chatId of chatIds) {
                      await bot.telegram.sendMessage(chatId, msg, {parse_mode: 'html'})
                    }
                  }

                  await sleep(5000);
                }
              }
            }
          }
        }
      }
    }

    await sleep(10000);
  }
}

bot.launch();
console.log('Telegram bot is now running...');
explorerScanner();

// Graceful exits
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  process.exit(0);
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  process.exit(0);
});
