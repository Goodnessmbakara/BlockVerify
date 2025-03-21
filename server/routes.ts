import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertCredentialSchema } from "@shared/schema";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  Keypair
} from "@solana/web3.js";
import { z } from "zod";
import crypto from 'node:crypto';
import rateLimit from "express-rate-limit";
import { logger } from "./utils/logger";

// Extract only user input fields for validation
const userInputSchema = z.object({
  studentId: insertCredentialSchema.shape.studentId,
  credentialType: insertCredentialSchema.shape.credentialType,
});

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Use environment-specific RPC URL with fallback
  const connection = new Connection(
    process.env.SOLANA_RPC_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com"),
    { commitment: "confirmed" }
  );

  // Generate a dedicated keypair for this application instance
  // In production, you would want to persist this between restarts
  const keypair = Keypair.generate();
  const publicKey = keypair.publicKey.toString();

  logger.info("Generated application keypair", { publicKey });
  console.log("\n===== APPLICATION KEYPAIR (DEV ONLY) =====");
  console.log(`Public Key: ${publicKey}`);
  console.log("This key requires SOL for transaction fees");
  console.log("==========================================\n");

  // Memo program ID
  const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

  // Set up rate limiting to prevent abuse
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.post("/api/credentials/issue", apiLimiter, async (req, res) => {
    try {
      if (!req.isAuthenticated() || req.user.role !== "university") {
        logger.warn("Unauthorized credential issuance attempt", {
          userId: req.user?.id,
          ip: req.ip
        });
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Generate cryptographically secure nonce
      const nonce = crypto.randomBytes(32).toString('hex');

      // Validate request body
      const validationResult = userInputSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: validationResult.error.format()
        });
      }

      const { studentId, credentialType } = validationResult.data;
      const issuedAt = new Date();
      const universityId = req.user.id;

      // Create deterministic but secure hash of credential data
      const dataToHash = `${studentId}-${universityId}-${credentialType}-${issuedAt.toISOString()}-${nonce}`;
      const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');

      // Generate a simulated transaction ID for dev/testing
      // In production with proper wallet setup, replace with actual transaction
      let transactionId: string;

      // Check if we're in dev mode or have insufficient funds
      try {
        // Get balance to check if we can make a real transaction
        const balance = await connection.getBalance(keypair.publicKey);

        if (balance > 5000) { // More than 0.000005 SOL (enough for a simple transaction)
          // Create and sign an actual blockchain transaction
          const transaction = new Transaction().add({
            keys: [],
            programId: MEMO_PROGRAM_ID,
            data: Buffer.from(hash),
          });

          transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
          transaction.feePayer = keypair.publicKey;

          // Send actual transaction to blockchain
          transactionId = await sendAndConfirmTransaction(
            connection,
            transaction,
            [keypair],
            { commitment: 'confirmed' }
          );

          logger.info("Credential recorded on blockchain", {
            transactionId,
            hash
          });
        } else {
          // Insufficient funds - use simulated transaction
          transactionId = "simulated_" + crypto.randomBytes(32).toString('hex');
          logger.warn("Using simulated transaction - insufficient funds", {
            balance,
            publicKey: keypair.publicKey.toString()
          });
        }
      } catch (txError) {
        // Error with blockchain - use simulated transaction
        transactionId = "simulated_" + crypto.randomBytes(32).toString('hex');
        logger.error("Blockchain error - using simulated transaction", {
          error: txError instanceof Error ? txError.message : "Unknown error"
        });
      }

      // Store credential in database 
      const data = insertCredentialSchema.parse({
        studentId,
        credentialType,
        universityId,
        hash,
        transactionId,
        issuedAt,
        nonce
      });

      const credential = await storage.createCredential({
        ...data,
        universityId: req.user.id
      });

      // Return success response
      res.json({
        success: true,
        credential: {
          id: credential.id,
          hash: credential.hash,
          transactionId: credential.transactionId,
          issuedAt: credential.issuedAt,
          isSimulated: transactionId.startsWith("simulated_")
        }
      });
    } catch (error) {
      logger.error("Error issuing credential", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        error: "Failed to issue credential",
        // Don't expose internal error details in production
        ...(process.env.NODE_ENV !== "production" && {
          details: error instanceof Error ? error.message : "Unknown error"
        })
      });
    }
  });

  app.get("/api/credentials/verify/:hash", apiLimiter, async (req, res) => {
    try {
      const { hash } = req.params;

      if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
        return res.status(400).json({ error: "Invalid credential hash format" });
      }

      // Retrieve credential from database
      const credential = await storage.getCredentialByHash(hash);
      if (!credential) {
        return res.status(404).json({ error: "Credential not found" });
      }

      // Check if this is a simulated transaction
      const isSimulated = credential.transactionId.startsWith("simulated_");

      if (isSimulated) {
        // For simulated transactions, we trust the database record
        // but mark it as simulation-based verification
        res.json({
          verified: true,
          simulatedOnly: true,
          credential: {
            id: credential.id,
            studentId: credential.studentId,
            credentialType: credential.credentialType,
            universityId: credential.universityId,
            issuedAt: credential.issuedAt
          }
        });
      } else {
        // For real transactions, verify on blockchain
        try {
          const transaction = await connection.getTransaction(credential.transactionId, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0
          });

          if (!transaction) {
            logger.warn("Transaction not found on blockchain", {
              transactionId: credential.transactionId
            });
            return res.status(404).json({
              error: "Blockchain verification failed: Transaction not found"
            });
          }

          // Verify transaction contains our hash in the memo
          let hashVerified = false;
          for (const instruction of transaction.transaction.message.instructions) {
            if (instruction.programId.equals(MEMO_PROGRAM_ID)) {
              const data = Buffer.from(instruction.data, 'base64').toString('utf8');
              if (data === hash) {
                hashVerified = true;
                break;
              }
            }
          }

          if (!hashVerified) {
            logger.warn("Hash not found in transaction", {
              transactionId: credential.transactionId,
              hash: credential.hash
            });
            return res.status(400).json({ error: "Credential hash verification failed" });
          }

          // Return successful verification with blockchain proof
          res.json({
            verified: true,
            simulatedOnly: false,
            credential: {
              id: credential.id,
              studentId: credential.studentId,
              credentialType: credential.credentialType,
              universityId: credential.universityId,
              issuedAt: credential.issuedAt
            },
            blockchainProof: {
              transactionId: credential.transactionId,
              blockTime: transaction.blockTime,
              slot: transaction.slot,
              confirmations: transaction.meta?.confirmations || 0
            }
          });
        } catch (verifyError) {
          logger.error("Blockchain verification error", {
            error: verifyError instanceof Error ? verifyError.message : "Unknown error",
            transactionId: credential.transactionId
          });

          return res.status(500).json({
            error: "Blockchain verification failed",
            ...(process.env.NODE_ENV !== "production" && {
              details: verifyError instanceof Error ? verifyError.message : "Unknown error"
            })
          });
        }
      }
    } catch (error) {
      logger.error("Error verifying credential", {
        error: error instanceof Error ? error.message : "Unknown error"
      });

      res.status(500).json({
        error: "Failed to verify credential",
        ...(process.env.NODE_ENV !== "production" && {
          details: error instanceof Error ? error.message : "Unknown error"
        })
      });
    }
  });

  // Add comprehensive health check endpoint
  app.get("/api/health", async (_req, res) => {
    try {
      // Check memstore connection/status
      const memstoreStatus = {
        healthy: storage.isConnected(),
        status: storage.isConnected() ? "connected" : "disconnected",
        latency: await measureMemstoreLatency()
      };

      // Check blockchain connection
      let blockchainStatus = "unknown";
      try {
        await connection.getLatestBlockhash();
        blockchainStatus = "connected";
      } catch (error) {
        blockchainStatus = "disconnected";
        logger.error("Blockchain connection error during health check", { error });
      }

      // Check keypair balance
      let balance = 0;
      let walletStatus = "no_funds";
      try {
        balance = await connection.getBalance(keypair.publicKey);
        walletStatus = balance > 5000 ? "funded" : "insufficient_funds";
      } catch (error) {
        logger.error("Error checking wallet balance", { error });
      }

      const allHealthy = memstoreStatus.healthy && blockchainStatus === "connected";

      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        services: {
          memstore: memstoreStatus,
          blockchain: {
            status: blockchainStatus,
            network: process.env.NODE_ENV === "production" ? "mainnet" : "devnet"
          },
          wallet: {
            publicKey: keypair.publicKey.toString(),
            status: walletStatus,
            balance,
            canIssueTxs: balance > 5000
          }
        }
      });
    } catch (error) {
      logger.error("Health check failed", { error });
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Health check failed"
      });
    }
  });

  // Helper function to measure memstore latency
  async function measureMemstoreLatency() {
    const start = performance.now();
    await storage.ping();
    return Math.round(performance.now() - start);
  }

  const httpServer = createServer(app);
  return httpServer;
}