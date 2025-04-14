# Solana Telegram Bot

A **Node.js Telegram bot** built with **TypeScript** using `node-telegram-bot-api`. This bot allows users to interact with the **Solana Blockchain** via a Telegram chat, enabling wallet creation, balance checking, SOL transfers, airdrop requests, and transaction history retrieval. The bot communicates with the backend API for all blockchain interactions.

## Features
- **Register & Create Wallet** (`/signup`)
- **Check Balance** (`/balance`)
- **Transfer SOL** (`/transfer`)
- **Request Airdrop (Devnet only)** (`/requestairdrop`)
- **View Transactions** (`/getTransactions`)
- **Switch Network** (`/switchnetwork`)
- **Start Command** (`/start`)

## Commands & Usage

### `/start`
- Initializes the bot and provides a welcome message with available commands.

### `/signup`
- Registers the user and creates a **Solana wallet**.
- Users need to enter a **password** for secure access.

### `/balance`
- Retrieves the current **SOL balance** of the user's wallet.

### `/transfer`
- Sends **SOL** from the user's wallet to another wallet.
- Requires the recipient's wallet address and the amount to transfer.

### `/requestairdrop`
- Requests **SOL airdrop** (only on Devnet).
- Useful for testing transactions without spending real SOL.

### `/getTransactions`
- Fetches the user's **recent transactions** on the blockchain.

### `/switchnetwork`
- Switch between **Solana Devnet, Testnet, or Mainnet**.
- Users can specify the network they want to use.

## Getting Started

### Prerequisites
Ensure you have the following installed:
- **Node.js** (>=16.x)
- **Telegram Account** (to use the bot)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/karthiksriramoju/wallet-x-bot.git
   cd wallet-x-bot
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Environment Setup
Create a `.env` file in the root directory and configure the following:
```env
TELEGRAM_TOKEN=your_telegram_bots_token
API_BASE_URL= backend_api_url
API_TOKEN= your_key_to_authorize_requests_same_as_api's_key
```

### Running the Bot
#### Development Mode
```bash
npm run dev
```

## How It Works
1. Start the bot in **Telegram** by sending `/start`.
2. Create a wallet using `/signup`.
3. Check your **SOL balance** with `/balance`.
4. Transfer **SOL** using `/transfer`.
5. Request **airdrop** (Devnet only) with `/requestairdrop`.
6. View transaction history using `/getTransactions`.
7. Switch networks with `/switchnetwork`.

## License
This project is licensed under the **MIT License**.

---
Enjoy using the bot! 🚀
