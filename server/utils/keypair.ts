import { Keypair } from "@solana/web3.js";
import * as bs58 from "bs58";
import { logger } from "./logger";

export class KeyManager {
    private cachedKeypair: Keypair | null = null;

    constructor() {
        logger.info("Initializing simplified key manager using environment variables");
    }

    /**
     * Gets the signing keypair for blockchain transactions
     * Uses environment variable or generates a development keypair
     */
    async getSigningKeypair(): Promise<Keypair> {
        // Return cached keypair if available
        if (this.cachedKeypair) {
            return this.cachedKeypair;
        }

        // Check if private key is provided in environment
        const privateKeyEnv = process.env.SOLANA_PRIVATE_KEY;
        if (privateKeyEnv) {
            try {
                // Handle different formats - base58 or array format
                if (privateKeyEnv.startsWith('[')) {
                    // Array format: [1,2,3,...]
                    const privateKeyArray = JSON.parse(privateKeyEnv);
                    const privateKeyUint8 = new Uint8Array(privateKeyArray);
                    this.cachedKeypair = Keypair.fromSecretKey(privateKeyUint8);
                } else {
                    // Base58 format
                    const privateKeyBytes = bs58.decode(privateKeyEnv);
                    this.cachedKeypair = Keypair.fromSecretKey(privateKeyBytes);
                }
                logger.info("Keypair loaded from environment variable", {
                    publicKey: this.cachedKeypair.publicKey.toString()
                });
            } catch (error) {
                logger.error("Failed to load keypair from environment", { error });
                throw new Error("Invalid keypair format in environment variable");
            }
        } else {
            // Generate new keypair if none provided
            this.cachedKeypair = Keypair.generate();
            const publicKey = this.cachedKeypair.publicKey.toString();
            logger.info("Generated new keypair", { publicKey });

            // Log private key for setup purposes
            const privateKeyBase58 = bs58.encode(this.cachedKeypair.secretKey);
            const privateKeyArray = Array.from(this.cachedKeypair.secretKey);

            logger.info("Set these credentials in your environment variables:", {
                SOLANA_PRIVATE_KEY: privateKeyBase58,
                publicKey: publicKey,
                privateKeyArray: JSON.stringify(privateKeyArray)
            });

            console.log("\n=== IMPORTANT: SAVE THESE CREDENTIALS ===");
            console.log(`Public Key: ${publicKey}`);
            console.log(`Private Key (base58): ${privateKeyBase58}`);
            console.log(`Private Key (array): ${JSON.stringify(privateKeyArray)}`);
            console.log("Add to your .env file: SOLANA_PRIVATE_KEY=" + privateKeyBase58);
            console.log("=======================================\n");
        }

        return this.cachedKeypair as Keypair;
    }

    /**
     * Generate a new keypair and display credentials
     * Useful for initial setup
     */
    generateNewKeypair(): { publicKey: string, privateKey: string } {
        const newKeypair = Keypair.generate();
        const publicKey = newKeypair.publicKey.toString();
        const privateKeyBase58 = bs58.encode(newKeypair.secretKey);

        logger.info("Generated new keypair", { publicKey });

        return {
            publicKey,
            privateKey: privateKeyBase58
        };
    }
}