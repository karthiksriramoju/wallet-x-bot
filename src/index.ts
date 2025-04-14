import { config } from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

// Load environment variables
config();

// Types and Interfaces
interface Command {
    command: string;
    description: string;
}

interface UserInfo {
    telegramId: string;
    username: string | undefined;
    first_name: string | undefined;
    last_name: string | undefined;
    language_code: string | undefined;
}

interface SignupPayload extends UserInfo {
    name: string;
    password: string;
    API_TOKEN: string;
}

interface NetworkSwitchPayload {
    telegramId: string;
    password: string;
    network: string;
    rpcUrl?: string;
    API_TOKEN: string;
}

interface BalancePayload {
    telegramId: string;
    password: string;
    walletName: string;
    API_TOKEN: string;
}
interface TransactionsPayload {
    telegramId: string;
    password: string;
    walletName: string;
    API_TOKEN: string;
}
interface AirdropPayload {
    telegramId: string;
    password: string;
    walletName: string;
    amount: number;
    API_TOKEN: string;
}

interface TransferPayload {
    telegramId: string;
    password: string;
    to: string;
    amount: number;
    walletName: string;
    API_TOKEN: string;
}

interface WalletResponse {
    publicKey: string;
    mnemonic?: string;
    privateKey?: string;
}

interface AirdropResponse {
    publicKey: string;
    signature: string;
}

interface BalanceResponse {
    balanceInSol: number;
}

interface TransferResponse {
    signature: string;
}

type TransactionResponse = {
    blockTime: number; // Unix timestamp of when the transaction was confirmed
    confirmationStatus: 'processed' | 'confirmed' | 'finalized'; // Transaction status
    err: null | string; // Error message (null if no error)
    memo: null | string; // Optional memo field
    signature: string; // Unique transaction identifier
    slot: number; // Slot number where the transaction was confirmed
  };

// Constants
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
const API_BASE_URL = process.env.API_BASE_URL!;
const API_TOKEN = process.env.API_TOKEN!;

const commands: Command[] = [
    { command: "help", description: "Get a list of available commands with their use." },
    { command: "signup", description: "Register with your telegram account." },
    { command: "balance", description: "Check wallet balance." },
    { command: "transfer", description: "Transfer SOL to another wallet." },
    { command: "switchnetwork", description: "Switch Solana networks." },
    { command: "requestairdrop", description: "Request SOL airdrop." },
    { command: "getTransactions", description: "Get Recent Transactions." },
];

type ConversationState = {
    state: string;
    // Optional values stored during the conversation.
    password?: string;
    walletName?: string;
    receiver?: string;
    amount?: number;
    network?: string;
    rpcUrl?: string;
    airdropAmount?: number; 
};

// Bot Class
class SolanaWalletTelegramBot {
    private bot: TelegramBot;
    private logger: Console;
    private conversationStates: Map<number, ConversationState>;

    constructor(private botToken: string, private serverUrl: string) {
        this.bot = new TelegramBot(botToken, { polling: true });
        this.logger = console;
        this.conversationStates = new Map();

        this.setupHandlers();
    }

    private extractTelegramUserInfo(msg: TelegramBot.Message): UserInfo {
        const user = msg.from!;
        return {
            telegramId: user.id.toString(),
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name,
            language_code: user.language_code,
        };
    }

    private async handleServerError(msg: TelegramBot.Message, error: any): Promise<void> {
        const errorMessage = error.error || ' Error. Check credentials and Please Try Again';
        const details = error.details || '';

        const finalError =
            errorMessage === "Account not found"
                ? "You have 0 SOL in your account. Please deposit some SOL to continue."
                : errorMessage;

        let errorText = `❌ ${finalError}`;
        if (details) {
            if (details === "Cannot read properties of undefined (reading 'PrivateKey')") {
                errorText += "\n📝 Details: The wallet you sent the index for doesn't exist.";
            } else {
                errorText += `\n📝 Details: ${details}`;
            }
        }
        await this.bot.sendMessage(msg.chat.id, errorText);
    }

    private async setCommands(): Promise<void> {
        try {
            await this.bot.setMyCommands(commands);
        } catch (error) {
            this.logger.error('Error setting commands:', error);
        }
    }

    // /start and /help handler
    private async handleStart(msg: TelegramBot.Message): Promise<void> {
        await this.setCommands();
        await this.bot.sendMessage(
            msg.chat.id,
            "🚀 **Welcome to the Solana Wallet Bot!**\n\n" +
"Your gateway to managing Solana wallets seamlessly on Telegram!\n" +
"Here’s how you can get started:\n\n" +
"1️⃣ /signup - Register your Telegram account and create your wallet\n" +
"💰 /balance - Check your wallet balance in SOL\n" +
"💸 /transfer - Send SOL to another wallet securely\n" +
"🎁 /requestairdrop - Request an airdrop of SOL to your wallet\n" +
"📜 /getTransactions - View your recent transactions\n" +
"🌐 /switchnetwork - Switch between Solana networks\n\n" +

"Switch to Devnet after Signup using /switchnetwork to test out the bot\n\n"+
"🔄 Use /help anytime to view this message again!"
        );
    }

    // **************** Signup Flow ****************
    private async handleSignup(msg: TelegramBot.Message): Promise<void> {
        this.conversationStates.set(msg.chat.id, { state: 'AWAITING_PASSWORD' });
        await this.bot.sendMessage(
            msg.chat.id,
            "🚀 Welcome to Solana Wallet Signup!\nPlease enter a secure password to create your wallet:"
        );
    }

    private async handlePassword(msg: TelegramBot.Message): Promise<void> {
        const state = this.conversationStates.get(msg.chat.id);
        if (!state || !msg.text) return;

        state.password = msg.text;
        state.state = 'AWAITING_WALLET_NAME';
        this.conversationStates.set(msg.chat.id, state);

        await this.bot.sendMessage(msg.chat.id, "Great! Now, please enter a name for your wallet:");
    }

    private async handleWalletName(msg: TelegramBot.Message): Promise<void> {
        const state = this.conversationStates.get(msg.chat.id);
        if (!state || !msg.text) return;

        try {
            const signupPayload: SignupPayload = {
                ...this.extractTelegramUserInfo(msg),
                name: msg.text,
                password: state.password!,
                API_TOKEN,
            };
            console.log(signupPayload)
            const response = await axios.post<WalletResponse>(
                `https://${this.serverUrl}/api/signup`,
                signupPayload
            );

            if (response.status === 201) {
                await this.bot.sendMessage(
                    msg.chat.id,
                    "🎉 Wallet created successfully!\n\n" +
                        "🔑 Your wallet details have been generated securely.\n\n" +
                        `🔐 Public Key: ${response.data.publicKey}`
                );
            }
        } catch (error: any) {
            await this.handleServerError(msg, error.response?.data || error);
        }
        this.conversationStates.delete(msg.chat.id);
    }

    // **************** Balance Flow ****************
    private async handleBalance(msg: TelegramBot.Message): Promise<void> {
        // Begin balance conversation by asking wallet name
        this.conversationStates.set(msg.chat.id, { state: 'AWAITING_WALLET_NAME_FOR_BALANCE' });
        await this.bot.sendMessage(msg.chat.id, "🏦 Enter the wallet name to check balance:");
    }

    private async processBalanceWalletName(msg: TelegramBot.Message): Promise<void> {
        const state = this.conversationStates.get(msg.chat.id);
        if (!state || !msg.text) return;

        state.walletName = msg.text;
        state.state = 'AWAITING_PASSWORD_FOR_BALANCE';
        this.conversationStates.set(msg.chat.id, state);

        await this.bot.sendMessage(msg.chat.id, "🔑 Enter your password:");
    }

    private async processBalance(msg: TelegramBot.Message): Promise<void> {
        const state = this.conversationStates.get(msg.chat.id);
        if (!state || !msg.text) return;

        const payload: BalancePayload = {
            telegramId: msg.from!.id.toString(),
            password: msg.text,
            walletName: state.walletName!,
            API_TOKEN,
        };

        try {
            const response = await axios.post<BalanceResponse>(
                `https://${this.serverUrl}/api/balance`,
                payload
            );

            if (response.status === 200) {
                // Assuming balance is returned in lamports (1 SOL = 1_000_000_000 lamports)

                console.log(response.data);
                const solBalance = response.data.balanceInSol ;
                console.log(solBalance);
                if (solBalance == 0) {
                    await this.bot.sendMessage(msg.chat.id, "You have 0 SOL in your account. Please deposit some SOL to continue.");
                }
                else{
                await this.bot.sendMessage(msg.chat.id, `💰 Balance: ${solBalance} SOL`);
                }
            }
        } catch (error: any) {
            await this.handleServerError(msg, error.response?.data || error);
        }
        this.conversationStates.delete(msg.chat.id);
    }

        // **************** Request Airdrop Flow ****************

    private async handleRequestAirdrop(msg: TelegramBot.Message): Promise<void> {
        this.conversationStates.set(msg.chat.id, { state: 'AWAITING_WALLET_FOR_AIRDROP' });
        await this.bot.sendMessage(msg.chat.id, "🏦 Enter the wallet name to receive the airdrop:");
    }

    private async processAirdropWallet(msg: TelegramBot.Message): Promise<void> {
        const state = this.conversationStates.get(msg.chat.id);
        if (!state || !msg.text) return;
    
        state.walletName = msg.text;
        state.state = 'AWAITING_AIRDROP_AMOUNT';
        this.conversationStates.set(msg.chat.id, state);
        await this.bot.sendMessage(msg.chat.id, "💰 Enter the amount of SOL to airdrop:");
    }
    
    private async processAirdropAmount(msg: TelegramBot.Message): Promise<void> {
        const state = this.conversationStates.get(msg.chat.id);
        if (!state || !msg.text) return;
    
        const amount = parseFloat(msg.text);
        if (isNaN(amount)) {
            await this.bot.sendMessage(msg.chat.id, "❌ Invalid amount. Please enter a valid number:");
            return;
        }
    
        state.airdropAmount = amount;
        state.state = 'AWAITING_PASSWORD_FOR_AIRDROP';
        this.conversationStates.set(msg.chat.id, state);
        await this.bot.sendMessage(msg.chat.id, "🔑 Enter your password:");
    }
    
    private async processAirdrop(msg: TelegramBot.Message): Promise<void> {
        const state = this.conversationStates.get(msg.chat.id);
        if (!state || !msg.text) return;
    
        const payload : AirdropPayload = {
            telegramId: msg.from!.id.toString(),
            password: msg.text,
            walletName: state.walletName!,
            amount: state.airdropAmount!,
            API_TOKEN,
        };
    
        try {
            const response = await axios.post<AirdropResponse>(
                `https://${this.serverUrl}/api/airdrop`,
                payload
            );
            if (response.status === 200) {
                await this.bot.sendMessage(
                    msg.chat.id,
                    `✅ Airdrop of ${state.airdropAmount} SOL successful!`
                );
            }
        } catch (error: any) {
            console.log(error.response?.data || error);
            await this.handleServerError(msg, error.response?.data || error);
        }
        this.conversationStates.delete(msg.chat.id);
    }

    // **************** Get Transaction Flow ****************

    private async handleTransactions(msg: TelegramBot.Message): Promise<void> {
        // Begin balance conversation by asking wallet name
        this.conversationStates.set(msg.chat.id, { state: 'AWAITING_WALLET_NAME_FOR_TRANSACTIONS' });
        await this.bot.sendMessage(msg.chat.id, "🏦 Enter the wallet name to get Recent Transactions:");
    }

    private async processTransactionsWalletName(msg: TelegramBot.Message): Promise<void> {
        const state = this.conversationStates.get(msg.chat.id);
        if (!state || !msg.text) return;

        state.walletName = msg.text;
        state.state = 'AWAITING_PASSWORD_FOR_TRANSACTIONS';
        this.conversationStates.set(msg.chat.id, state);

        await this.bot.sendMessage(msg.chat.id, "🔑 Enter your password:");
    }

    private async processTransactions(msg: TelegramBot.Message): Promise<void> {
        const state = this.conversationStates.get(msg.chat.id);
        if (!state || !msg.text) return;

        const payload: TransactionsPayload = {
            telegramId: msg.from!.id.toString(),
            password: msg.text,
            walletName: state.walletName!,
            API_TOKEN,
        };

        try {
            const response = await axios.post(
                `https://${this.serverUrl}/api/transactions`,
                payload
            );

            if (response.status === 200) {
                const transactions : TransactionResponse[] = response.data.transactions ;
                if (transactions.length === 0) {
                    await this.bot.sendMessage(msg.chat.id, "You haven't made any transactions yet.");
                } else {
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
                    await this.bot.sendMessage(
                        msg.chat.id,
                        `📜 **Your Transactions:**\n${formattedTransactions}`,
                        { parse_mode: 'Markdown' } // Enable Markdown formatting
                    );
                }

            }
        } catch (error: any) {
            await this.handleServerError(msg, error.response?.data || error);
        }
        this.conversationStates.delete(msg.chat.id);
    }

    // **************** Network Switch Flow ****************
    private async handleNetworkSwitch(msg: TelegramBot.Message): Promise<void> {
        // Begin network switch conversation
        this.conversationStates.set(msg.chat.id, { state: 'AWAITING_NETWORK_SELECTION' });
        await this.bot.sendMessage(
            msg.chat.id,
                " Available Networks:\n" +
                "   - mainnet-beta\n" +
                "   - testnet\n" +
                "   - devnet\n" +
                "   - custom (connect to Solana using your own RPC URL)\n"+"\n" +"🌐 Type a Solana network:"
        );
    }

    private async processNetworkSelection(msg: TelegramBot.Message): Promise<void> {
        const state = this.conversationStates.get(msg.chat.id);
        if (!state || !msg.text) return;

        const validNetworks = ['mainnet-beta', 'testnet', 'devnet', 'custom'];
        if (!validNetworks.includes(msg.text.toLowerCase())) {
            await this.bot.sendMessage(
                msg.chat.id,
                "❌ Invalid network selected. Please choose from mainnet-beta, testnet, devnet, or custom."
            );
            return;
        }

        state.network = msg.text.toLowerCase();

        if (state.network === 'custom') {
            state.state = 'AWAITING_CUSTOM_RPC';
            this.conversationStates.set(msg.chat.id, state);
            await this.bot.sendMessage(msg.chat.id, "🔗 Enter your custom RPC URL:");
        } else {
            state.state = 'AWAITING_PASSWORD_FOR_NETWORK';
            this.conversationStates.set(msg.chat.id, state);
            await this.bot.sendMessage(msg.chat.id, "🔑 Enter your password:");
        }
    }

    private async processCustomRPC(msg: TelegramBot.Message): Promise<void> {
        const state = this.conversationStates.get(msg.chat.id);
        if (!state || !msg.text) return;

        state.rpcUrl = msg.text;
        state.state = 'AWAITING_PASSWORD_FOR_NETWORK';
        this.conversationStates.set(msg.chat.id, state);
        await this.bot.sendMessage(msg.chat.id, "🔑 Enter your password:");
    }

    private async processNetworkSwitch(msg: TelegramBot.Message): Promise<void> {
        const state = this.conversationStates.get(msg.chat.id);
        if (!state || !msg.text) return;

        const payload: NetworkSwitchPayload = {
            telegramId: msg.from!.id.toString(),
            password: msg.text,
            network: state.network!,
            API_TOKEN,
            ...(state.rpcUrl ? { rpcUrl: state.rpcUrl } : {})
        };

        try {
            const response = await axios.post(
                `https://${this.serverUrl}/api/network/switch`,
                payload
            );
            if (response.status === 200) {
                await this.bot.sendMessage(
                    msg.chat.id,
                    `✅ Switched to ${state.network} network successfully!`
                );
            }
        } catch (error: any) {
            await this.handleServerError(msg, error.response?.data || error);
        }
        this.conversationStates.delete(msg.chat.id);
    }

    // **************** Transfer Flow ****************
    private async handleTransfer(msg: TelegramBot.Message): Promise<void> {
        this.conversationStates.set(msg.chat.id, { state: 'AWAITING_RECEIVER' });
        await this.bot.sendMessage(msg.chat.id, "💸 Enter receiver's wallet address:");
    }

    private async processTransferReceiver(msg: TelegramBot.Message): Promise<void> {
        const state = this.conversationStates.get(msg.chat.id);
        if (!state || !msg.text) return;

        state.receiver = msg.text;
        state.state = 'AWAITING_TRANSFER_AMOUNT';
        this.conversationStates.set(msg.chat.id, state);
        await this.bot.sendMessage(msg.chat.id, "💰 Enter amount of SOL to transfer:");
    }

    private async processTransferAmount(msg: TelegramBot.Message): Promise<void> {
        const state = this.conversationStates.get(msg.chat.id);
        if (!state || !msg.text) return;

        const amount = parseFloat(msg.text);
        if (isNaN(amount) || amount <= 0) {
            await this.bot.sendMessage(msg.chat.id, "❌ Invalid amount. Please enter a valid number:");
            return;
        }
        state.amount = amount;
        state.state = 'AWAITING_WALLET_FOR_TRANSFER';
        this.conversationStates.set(msg.chat.id, state);
        await this.bot.sendMessage(msg.chat.id, "🏦 Enter wallet name to send SOL from:");
    }

    private async processTransferWallet(msg: TelegramBot.Message): Promise<void> {
        const state = this.conversationStates.get(msg.chat.id);
        if (!state || !msg.text) return;

        state.walletName = msg.text;
        state.state = 'AWAITING_PASSWORD_FOR_TRANSFER';
        this.conversationStates.set(msg.chat.id, state);
        await this.bot.sendMessage(msg.chat.id, "🔑 Enter your password:");
    }

    private async processTransfer(msg: TelegramBot.Message): Promise<void> {
        const state = this.conversationStates.get(msg.chat.id);
        if (!state || !msg.text) return;

        const payload: TransferPayload = {
            telegramId: msg.from!.id.toString(),
            password: msg.text,
            to: state.receiver!,
            amount: state.amount!,
            walletName: state.walletName!,
            API_TOKEN,
        };

        try {
            const response = await axios.post<TransferResponse>(
                `https://${this.serverUrl}/api/transfer`,
                payload
            );
            if (response.status === 200) {
                await this.bot.sendMessage(
                    msg.chat.id,
                    `✅ Transfer successful!\nTransaction Signature: ${response.data.signature}`
                );
            }
        } catch (error: any) {
            await this.handleServerError(msg, error.response?.data || error);
        }
        this.conversationStates.delete(msg.chat.id);
    }

    // **************** Setup Handlers ****************
    private setupHandlers(): void {
        // Command handlers
        this.bot.onText(/\/start|\/help/, this.handleStart.bind(this));
        this.bot.onText(/\/signup/, this.handleSignup.bind(this));
        this.bot.onText(/\/balance/, this.handleBalance.bind(this));
        this.bot.onText(/\/switchnetwork/, this.handleNetworkSwitch.bind(this));
        this.bot.onText(/\/transfer/, this.handleTransfer.bind(this));
        this.bot.onText(/\/requestairdrop/, this.handleRequestAirdrop.bind(this));
        this.bot.onText(/\/getTransactions/, this.handleTransactions.bind(this));


        // Message handler for conversation flow.
        this.bot.on('message', async (msg: TelegramBot.Message) => {
            // If message is a command, ignore further processing.
            if (msg.text?.startsWith('/')) return;

            const state = this.conversationStates.get(msg.chat.id);
            if (!state) return;

            switch (state.state) {
                // Signup flow
                case 'AWAITING_PASSWORD':
                    await this.handlePassword(msg);
                    break;
                case 'AWAITING_WALLET_NAME':
                    await this.handleWalletName(msg);
                    break;

                // Balance flow
                case 'AWAITING_WALLET_NAME_FOR_BALANCE':
                    await this.processBalanceWalletName(msg);
                    break;
                case 'AWAITING_PASSWORD_FOR_BALANCE':
                    await this.processBalance(msg);
                    break;

                // Network switch flow
                case 'AWAITING_NETWORK_SELECTION':
                    await this.processNetworkSelection(msg);
                    break;
                case 'AWAITING_CUSTOM_RPC':
                    await this.processCustomRPC(msg);
                    break;
                case 'AWAITING_PASSWORD_FOR_NETWORK':
                    await this.processNetworkSwitch(msg);
                    break;

                // Transfer flow
                case 'AWAITING_RECEIVER':
                    await this.processTransferReceiver(msg);
                    break;
                case 'AWAITING_TRANSFER_AMOUNT':
                    await this.processTransferAmount(msg);
                    break;
                case 'AWAITING_WALLET_FOR_TRANSFER':
                    await this.processTransferWallet(msg);
                    break;
                case 'AWAITING_PASSWORD_FOR_TRANSFER':
                    await this.processTransfer(msg);
                    break;

                // Airdrop flow
                    case 'AWAITING_WALLET_FOR_AIRDROP':
                        await this.processAirdropWallet(msg);
                        break;
                    case 'AWAITING_AIRDROP_AMOUNT':
                        await this.processAirdropAmount(msg);
                        break;
                    case 'AWAITING_PASSWORD_FOR_AIRDROP':
                        await this.processAirdrop(msg);
                        break;       
                        
                // Transaction flow
                case 'AWAITING_WALLET_NAME_FOR_TRANSACTIONS':
                    await this.processTransactionsWalletName(msg);
                    break;
                case 'AWAITING_PASSWORD_FOR_TRANSACTIONS':
                    await this.processTransactions(msg);
                    break;                        

                default:
                    break;
            }
        });
    }
}

// Main execution
const main = (): void => {
    new SolanaWalletTelegramBot(TELEGRAM_TOKEN, API_BASE_URL);
};

if (require.main === module) {
    main();
}

export default SolanaWalletTelegramBot;

