import { Connection, PublicKey } from "@solana/web3.js";

export const connection = new Connection(
  process.env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com"
);

export const programId = new PublicKey(
  process.env.VITE_PROGRAM_ID || "YOUR_PROGRAM_ID"
);

export async function getCredentialAccount(hash: string) {
  // Implementation would depend on your specific Solana program structure
  // This is just a placeholder for the actual implementation
  return await connection.getProgramAccounts(programId, {
    filters: [
      {
        memcmp: {
          offset: 8, // Skip discriminator
          bytes: hash,
        },
      },
    ],
  });
}
