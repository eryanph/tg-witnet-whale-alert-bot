# Witnet Whale Alerts Telegram Bot
A telegram bot for Witnet Network whale alerts. It scans the block explorer and once it finds a transaction that exceeds the treshold set, it will send a message to the configured chat group. 

Feel free to modify and deploy your own bot using this Node.js project.

# Getting Started
- This project requires Node.js. You can download it [here](https://nodejs.org/en/download/).
- Create a telegram bot. You can learn how to create your own bot [here](https://core.telegram.org/bots).
- Add your telegram bot to the channel you want it to send alerts and get the channel's chat ID. If you don't know how to get the chat ID, here is a [helpful stackoverflow](https://stackoverflow.com/questions/45414021/get-telegram-channel-group-id) I found.
- Create `.env` file from `sample.env` file and supply the proper values to the fields.
- Install the project's dependencies `npm i`.
- You can now run the bot using `npm run start`.
