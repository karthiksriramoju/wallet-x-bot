"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const axios_1 = __importDefault(require("axios"));
// Load environment variables
(0, dotenv_1.config)();
// Constants
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const API_BASE_URL = process.env.API_BASE_URL;
const API_TOKEN = process.env.API_TOKEN;
const commands = [
    { command: "help", description: "Get a list of available commands with their use." },
    { command: "signup", description: "Register with your telegram account." },
    { command: "balance", description: "Check wallet balance." },
    { command: "transfer", description: "Transfer SOL to another wallet." },
    { command: "switchnetwork", description: "Switch Solana networks." },
    { command: "requestairdrop", description: "Request SOL airdrop." },
    { command: "getTransactions", description: "Get Recent Transactions." },
];
// Bot Class
class SolanaWalletTelegramBot {
    constructor(botToken, serverUrl) {
        this.botToken = botToken;
        this.serverUrl = serverUrl;
        this.bot = new node_telegram_bot_api_1.default(botToken, { polling: true });
        this.logger = console;
        this.conversationStates = new Map();
        this.setupHandlers();
    }
    extractTelegramUserInfo(msg) {
        const user = msg.from;
        return {
            telegramId: user.id.toString(),
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            language_code: user.language_code,
        };
    }
    handleServerError(msg, error) {
        return __awaiter(this, void 0, void 0, function* () {
            const errorMessage = error.error || 'Unknown Error';
            const details = error.details || '';
            const finalError = errorMessage === "Account not found"
                ? "You have 0 SOL in your account. Please deposit some SOL to continue."
                : errorMessage;
            let errorText = `❌ ${finalError}`;
            if (details) {
                if (details === "Cannot read properties of undefined (reading 'PrivateKey')") {
                    errorText += "\n📝 Details: The wallet you sent the index for doesn't exist.";
                }
                else {
                    errorText += `\n📝 Details: ${details}`;
                }
            }
            yield this.bot.sendMessage(msg.chat.id, errorText);
        });
    }
    setCommands() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.bot.setMyCommands(commands);
            }
            catch (error) {
                this.logger.error('Error setting commands:', error);
            }
        });
    }
    // /start and /help handler
    handleStart(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.setCommands();
            yield this.bot.sendMessage(msg.chat.id, "🚀 **Welcome to the Solana Wallet Bot!**\n\n" +
                "Here's how you can get started:\n\n" +
                "1️⃣ /signup - Register your telegram account\n" +
                "💰 /balance - Check your wallet balance\n" +
                "💸 /transfer - Send SOL to another wallet\n" +
                "💰 /requestairdrop - Airdrop SOL to Your wallet\n" +
                "🌐 /getTransactions - Get Recent Transactions of your Wallet\n" +
                "🌐 /switchnetwork - Switch between Solana networks\n\n" +
                " Available Networks:\n" +
                "   - mainnet-beta\n" +
                "   - testnet\n" +
                "   - devnet\n" +
                "   - custom (connect to Solana using your own RPC URL)\n\n" +
                "🔄 Use /help anytime to view this message again!");
        });
    }
    // **************** Signup Flow ****************
    handleSignup(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            this.conversationStates.set(msg.chat.id, { state: 'AWAITING_PASSWORD' });
            yield this.bot.sendMessage(msg.chat.id, "🚀 Welcome to Solana Wallet Signup!\nPlease enter a secure password to create your wallet:");
        });
    }
    handlePassword(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const state = this.conversationStates.get(msg.chat.id);
            if (!state || !msg.text)
                return;
            state.password = msg.text;
            state.state = 'AWAITING_WALLET_NAME';
            this.conversationStates.set(msg.chat.id, state);
            yield this.bot.sendMessage(msg.chat.id, "Great! Now, please enter a name for your wallet:");
        });
    }
    handleWalletName(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const state = this.conversationStates.get(msg.chat.id);
            if (!state || !msg.text)
                return;
            try {
                const signupPayload = Object.assign(Object.assign({}, this.extractTelegramUserInfo(msg)), { name: msg.text, password: state.password, API_TOKEN });
                console.log(signupPayload);
                const response = yield axios_1.default.post(`http://${this.serverUrl}/api/signup`, signupPayload);
                if (response.status === 201) {
                    yield this.bot.sendMessage(msg.chat.id, "🎉 Wallet created successfully!\n\n" +
                        "🔑 Your wallet details have been generated securely.\n\n" +
                        `🔐 Public Key: ${response.data.publicKey}`);
                }
            }
            catch (error) {
                yield this.handleServerError(msg, ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error);
            }
            this.conversationStates.delete(msg.chat.id);
        });
    }
    // **************** Balance Flow ****************
    handleBalance(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            // Begin balance conversation by asking wallet name
            this.conversationStates.set(msg.chat.id, { state: 'AWAITING_WALLET_NAME_FOR_BALANCE' });
            yield this.bot.sendMessage(msg.chat.id, "🏦 Enter the wallet name to check balance:");
        });
    }
    processBalanceWalletName(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const state = this.conversationStates.get(msg.chat.id);
            if (!state || !msg.text)
                return;
            state.walletName = msg.text;
            state.state = 'AWAITING_PASSWORD_FOR_BALANCE';
            this.conversationStates.set(msg.chat.id, state);
            yield this.bot.sendMessage(msg.chat.id, "🔑 Enter your password:");
        });
    }
    processBalance(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const state = this.conversationStates.get(msg.chat.id);
            if (!state || !msg.text)
                return;
            const payload = {
                telegramId: msg.from.id.toString(),
                password: msg.text,
                walletName: state.walletName,
                API_TOKEN,
            };
            try {
                const response = yield axios_1.default.post(`http://${this.serverUrl}/api/balance`, payload);
                if (response.status === 200) {
                    // Assuming balance is returned in lamports (1 SOL = 1_000_000_000 lamports)
                    console.log(response.data);
                    const solBalance = response.data.balanceInSol;
                    console.log(solBalance);
                    if (solBalance == 0) {
                        yield this.bot.sendMessage(msg.chat.id, "You have 0 SOL in your account. Please deposit some SOL to continue.");
                    }
                    else {
                        yield this.bot.sendMessage(msg.chat.id, `💰 Balance: ${solBalance} SOL`);
                    }
                }
            }
            catch (error) {
                yield this.handleServerError(msg, ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error);
            }
            this.conversationStates.delete(msg.chat.id);
        });
    }
    // **************** Request Airdrop Flow ****************
    handleRequestAirdrop(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            this.conversationStates.set(msg.chat.id, { state: 'AWAITING_WALLET_FOR_AIRDROP' });
            yield this.bot.sendMessage(msg.chat.id, "🏦 Enter the wallet name to receive the airdrop:");
        });
    }
    processAirdropWallet(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const state = this.conversationStates.get(msg.chat.id);
            if (!state || !msg.text)
                return;
            state.walletName = msg.text;
            state.state = 'AWAITING_AIRDROP_AMOUNT';
            this.conversationStates.set(msg.chat.id, state);
            yield this.bot.sendMessage(msg.chat.id, "💰 Enter the amount of SOL to airdrop:");
        });
    }
    processAirdropAmount(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const state = this.conversationStates.get(msg.chat.id);
            if (!state || !msg.text)
                return;
            const amount = parseFloat(msg.text);
            if (isNaN(amount)) {
                yield this.bot.sendMessage(msg.chat.id, "❌ Invalid amount. Please enter a valid number:");
                return;
            }
            state.airdropAmount = amount;
            state.state = 'AWAITING_PASSWORD_FOR_AIRDROP';
            this.conversationStates.set(msg.chat.id, state);
            yield this.bot.sendMessage(msg.chat.id, "🔑 Enter your password:");
        });
    }
    processAirdrop(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const state = this.conversationStates.get(msg.chat.id);
            if (!state || !msg.text)
                return;
            const payload = {
                telegramId: msg.from.id.toString(),
                password: msg.text,
                walletName: state.walletName,
                amount: state.airdropAmount,
                API_TOKEN,
            };
            try {
                const response = yield axios_1.default.post(`http://${this.serverUrl}/api/airdrop`, payload);
                if (response.status === 200) {
                    yield this.bot.sendMessage(msg.chat.id, `✅ Airdrop of ${state.airdropAmount} SOL successful!`);
                }
            }
            catch (error) {
                console.log(((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error);
                yield this.handleServerError(msg, ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error);
            }
            this.conversationStates.delete(msg.chat.id);
        });
    }
    // **************** Get Transaction Flow ****************
    handleTransactions(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            // Begin balance conversation by asking wallet name
            this.conversationStates.set(msg.chat.id, { state: 'AWAITING_WALLET_NAME_FOR_TRANSACTIONS' });
            yield this.bot.sendMessage(msg.chat.id, "🏦 Enter the wallet name to get Recent Transactions:");
        });
    }
    processTransactionsWalletName(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const state = this.conversationStates.get(msg.chat.id);
            if (!state || !msg.text)
                return;
            state.walletName = msg.text;
            state.state = 'AWAITING_PASSWORD_FOR_TRANSACTIONS';
            this.conversationStates.set(msg.chat.id, state);
            yield this.bot.sendMessage(msg.chat.id, "🔑 Enter your password:");
        });
    }
    processTransactions(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const state = this.conversationStates.get(msg.chat.id);
            if (!state || !msg.text)
                return;
            const payload = {
                telegramId: msg.from.id.toString(),
                password: msg.text,
                walletName: state.walletName,
                API_TOKEN,
            };
            try {
                const response = yield axios_1.default.post(`http://${this.serverUrl}/api/transactions`, payload);
                if (response.status === 200) {
                    const transactions = response.data.transactions;
                    if (transactions.length === 0) {
                        yield this.bot.sendMessage(msg.chat.id, "You haven't made any transactions yet.");
                    }
                    else {
                        // Format transactions
                        let formattedTransactions = transactions.map((transaction, index) => {
                            const blockTime = new Date(transaction.blockTime * 1000).toLocaleString(); // Convert blockTime to readable format
                            return `
                📌 Transaction ${index + 1}
                ⏰ Block Time: ${blockTime}
                ✅ Confirmation: ${transaction.confirmationStatus}
                🔐 Signature: ${transaction.signature}
                        `;
                        }).join('\n');
                        // Send the formatted message
                        yield this.bot.sendMessage(msg.chat.id, `📜 **Your Transactions:**\n${formattedTransactions}`, { parse_mode: 'Markdown' } // Enable Markdown formatting
                        );
                    }
                }
            }
            catch (error) {
                yield this.handleServerError(msg, ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error);
            }
            this.conversationStates.delete(msg.chat.id);
        });
    }
    // **************** Network Switch Flow ****************
    handleNetworkSwitch(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            // Begin network switch conversation
            this.conversationStates.set(msg.chat.id, { state: 'AWAITING_NETWORK_SELECTION' });
            yield this.bot.sendMessage(msg.chat.id, "🌐 Select a Solana network [Type](mainnet-beta, testnet, devnet, custom):");
        });
    }
    processNetworkSelection(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const state = this.conversationStates.get(msg.chat.id);
            if (!state || !msg.text)
                return;
            const validNetworks = ['mainnet-beta', 'testnet', 'devnet', 'custom'];
            if (!validNetworks.includes(msg.text.toLowerCase())) {
                yield this.bot.sendMessage(msg.chat.id, "❌ Invalid network selected. Please choose from mainnet-beta, testnet, devnet, or custom.");
                return;
            }
            state.network = msg.text.toLowerCase();
            if (state.network === 'custom') {
                state.state = 'AWAITING_CUSTOM_RPC';
                this.conversationStates.set(msg.chat.id, state);
                yield this.bot.sendMessage(msg.chat.id, "🔗 Enter your custom RPC URL:");
            }
            else {
                state.state = 'AWAITING_PASSWORD_FOR_NETWORK';
                this.conversationStates.set(msg.chat.id, state);
                yield this.bot.sendMessage(msg.chat.id, "🔑 Enter your password:");
            }
        });
    }
    processCustomRPC(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const state = this.conversationStates.get(msg.chat.id);
            if (!state || !msg.text)
                return;
            state.rpcUrl = msg.text;
            state.state = 'AWAITING_PASSWORD_FOR_NETWORK';
            this.conversationStates.set(msg.chat.id, state);
            yield this.bot.sendMessage(msg.chat.id, "🔑 Enter your password:");
        });
    }
    processNetworkSwitch(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const state = this.conversationStates.get(msg.chat.id);
            if (!state || !msg.text)
                return;
            const payload = Object.assign({ telegramId: msg.from.id.toString(), password: msg.text, network: state.network, API_TOKEN }, (state.rpcUrl ? { rpcUrl: state.rpcUrl } : {}));
            try {
                const response = yield axios_1.default.post(`http://${this.serverUrl}/api/network/switch`, payload);
                if (response.status === 200) {
                    yield this.bot.sendMessage(msg.chat.id, `✅ Switched to ${state.network} network successfully!`);
                }
            }
            catch (error) {
                yield this.handleServerError(msg, ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error);
            }
            this.conversationStates.delete(msg.chat.id);
        });
    }
    // **************** Transfer Flow ****************
    handleTransfer(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            this.conversationStates.set(msg.chat.id, { state: 'AWAITING_RECEIVER' });
            yield this.bot.sendMessage(msg.chat.id, "💸 Enter receiver's wallet address:");
        });
    }
    processTransferReceiver(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const state = this.conversationStates.get(msg.chat.id);
            if (!state || !msg.text)
                return;
            state.receiver = msg.text;
            state.state = 'AWAITING_TRANSFER_AMOUNT';
            this.conversationStates.set(msg.chat.id, state);
            yield this.bot.sendMessage(msg.chat.id, "💰 Enter amount of SOL to transfer:");
        });
    }
    processTransferAmount(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const state = this.conversationStates.get(msg.chat.id);
            if (!state || !msg.text)
                return;
            const amount = parseFloat(msg.text);
            if (isNaN(amount) || amount <= 0) {
                yield this.bot.sendMessage(msg.chat.id, "❌ Invalid amount. Please enter a valid number:");
                return;
            }
            state.amount = amount;
            state.state = 'AWAITING_WALLET_FOR_TRANSFER';
            this.conversationStates.set(msg.chat.id, state);
            yield this.bot.sendMessage(msg.chat.id, "🏦 Enter wallet name to send SOL from:");
        });
    }
    processTransferWallet(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const state = this.conversationStates.get(msg.chat.id);
            if (!state || !msg.text)
                return;
            state.walletName = msg.text;
            state.state = 'AWAITING_PASSWORD_FOR_TRANSFER';
            this.conversationStates.set(msg.chat.id, state);
            yield this.bot.sendMessage(msg.chat.id, "🔑 Enter your password:");
        });
    }
    processTransfer(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const state = this.conversationStates.get(msg.chat.id);
            if (!state || !msg.text)
                return;
            const payload = {
                telegramId: msg.from.id.toString(),
                password: msg.text,
                to: state.receiver,
                amount: state.amount,
                walletName: state.walletName,
                API_TOKEN,
            };
            try {
                const response = yield axios_1.default.post(`http://${this.serverUrl}/api/transfer`, payload);
                if (response.status === 200) {
                    yield this.bot.sendMessage(msg.chat.id, `✅ Transfer successful!\nTransaction Signature: ${response.data.signature}`);
                }
            }
            catch (error) {
                yield this.handleServerError(msg, ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error);
            }
            this.conversationStates.delete(msg.chat.id);
        });
    }
    // **************** Setup Handlers ****************
    setupHandlers() {
        // Command handlers
        this.bot.onText(/\/start|\/help/, this.handleStart.bind(this));
        this.bot.onText(/\/signup/, this.handleSignup.bind(this));
        this.bot.onText(/\/balance/, this.handleBalance.bind(this));
        this.bot.onText(/\/switchnetwork/, this.handleNetworkSwitch.bind(this));
        this.bot.onText(/\/transfer/, this.handleTransfer.bind(this));
        this.bot.onText(/\/requestairdrop/, this.handleRequestAirdrop.bind(this));
        this.bot.onText(/\/getTransactions/, this.handleTransactions.bind(this));
        // Message handler for conversation flow.
        this.bot.on('message', (msg) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            // If message is a command, ignore further processing.
            if ((_a = msg.text) === null || _a === void 0 ? void 0 : _a.startsWith('/'))
                return;
            const state = this.conversationStates.get(msg.chat.id);
            if (!state)
                return;
            switch (state.state) {
                // Signup flow
                case 'AWAITING_PASSWORD':
                    yield this.handlePassword(msg);
                    break;
                case 'AWAITING_WALLET_NAME':
                    yield this.handleWalletName(msg);
                    break;
                // Balance flow
                case 'AWAITING_WALLET_NAME_FOR_BALANCE':
                    yield this.processBalanceWalletName(msg);
                    break;
                case 'AWAITING_PASSWORD_FOR_BALANCE':
                    yield this.processBalance(msg);
                    break;
                // Network switch flow
                case 'AWAITING_NETWORK_SELECTION':
                    yield this.processNetworkSelection(msg);
                    break;
                case 'AWAITING_CUSTOM_RPC':
                    yield this.processCustomRPC(msg);
                    break;
                case 'AWAITING_PASSWORD_FOR_NETWORK':
                    yield this.processNetworkSwitch(msg);
                    break;
                // Transfer flow
                case 'AWAITING_RECEIVER':
                    yield this.processTransferReceiver(msg);
                    break;
                case 'AWAITING_TRANSFER_AMOUNT':
                    yield this.processTransferAmount(msg);
                    break;
                case 'AWAITING_WALLET_FOR_TRANSFER':
                    yield this.processTransferWallet(msg);
                    break;
                case 'AWAITING_PASSWORD_FOR_TRANSFER':
                    yield this.processTransfer(msg);
                    break;
                // Airdrop flow
                case 'AWAITING_WALLET_FOR_AIRDROP':
                    yield this.processAirdropWallet(msg);
                    break;
                case 'AWAITING_AIRDROP_AMOUNT':
                    yield this.processAirdropAmount(msg);
                    break;
                case 'AWAITING_PASSWORD_FOR_AIRDROP':
                    yield this.processAirdrop(msg);
                    break;
                // Transaction flow
                case 'AWAITING_WALLET_NAME_FOR_TRANSACTIONS':
                    yield this.processTransactionsWalletName(msg);
                    break;
                case 'AWAITING_PASSWORD_FOR_TRANSACTIONS':
                    yield this.processTransactions(msg);
                    break;
                default:
                    break;
            }
        }));
    }
}
// Main execution
const main = () => {
    new SolanaWalletTelegramBot(TELEGRAM_TOKEN, API_BASE_URL);
};
if (require.main === module) {
    main();
}
exports.default = SolanaWalletTelegramBot;
