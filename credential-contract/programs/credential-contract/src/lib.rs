use anchor_lang::prelude::*;

declare_id!("4TzHgfTzZUjvCDNvj19qNSj1UgZYNQHZUZkiTZrTCN9m");

#[program]
pub mod credential_contract {
    use super::*;

    pub fn store_credential(ctx: Context<StoreCredential>, hash: String) -> Result<()> {
        let credential = &mut ctx.accounts.credential;
        credential.hash = hash;
        Ok(())
    }

    
}

#[derive(Accounts)]
pub struct StoreCredential<'info> {
    #[account(init, payer = authority, space = 64)]
    pub credential: Account<'info, Credential>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Credential {
    pub hash: String,
}