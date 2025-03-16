import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertCredentialSchema } from "@shared/schema";
import { Connection, PublicKey } from "@solana/web3.js";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com");

  app.post("/api/credentials/issue", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== "university") {
      return res.status(403).send("Unauthorized");
    }

    try {
      const data = insertCredentialSchema.parse(req.body);
      
      // Store credential hash on Solana blockchain
      // This is a simplified example - in production you would use a proper Solana program
      const transaction = await connection.sendTransaction(/* transaction details */);
      
      const credential = await storage.createCredential({
        ...data,
        universityId: req.user.id,
        transactionId: transaction.signature
      });

      res.json(credential);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get("/api/credentials/verify/:hash", async (req, res) => {
    try {
      const credential = await storage.getCredentialByHash(req.params.hash);
      if (!credential) {
        return res.status(404).send("Credential not found");
      }

      // Verify on Solana blockchain
      const transaction = await connection.getTransaction(credential.transactionId);
      if (!transaction) {
        return res.status(404).send("Transaction not found");
      }

      res.json({
        verified: true,
        credential,
        blockchainProof: {
          transactionId: credential.transactionId,
          blockTime: transaction.blockTime,
          slot: transaction.slot
        }
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
