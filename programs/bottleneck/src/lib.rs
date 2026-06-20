use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("CmcEwPFFefG2BpzPe2q4eUCAVijdxLf18ppDyLWYRCti");

// ─── Enums ───────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ContainerType {
    Pet,
    Glass,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ContainerStatus {
    InCirculation,
    Returned,
    Settled,
}

// ─── State Accounts ──────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct SystemConfig {
    pub authority: Pubkey,
    pub deposit_pet_lamports: u64,
    pub deposit_glass_lamports: u64,
    pub total_in_circulation: u64,
    pub total_returned: u64,
    pub total_unclaimed_lamports: u64,
    pub unclaim_threshold_slots: u64,
    pub vault_bump: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Container {
    pub container_id: u64,
    pub container_type: ContainerType,
    pub deposit_lamports: u64,
    pub status: ContainerStatus,
    pub producer: Pubkey,
    pub registered_slot: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct CollectionPoint {
    pub store: Pubkey,
    pub reimbursable_lamports: u64,
    pub bump: u8,
}

// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum DrsError {
    #[msg("Container already returned")]
    AlreadyReturned,
    #[msg("Container not in circulation")]
    NotInCirculation,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Nothing to settle")]
    NothingToSettle,
    #[msg("Sweep not allowed: threshold not reached")]
    SweepNotAllowed,
    #[msg("Insufficient vault balance")]
    InsufficientVault,
}

// ─── Events ──────────────────────────────────────────────────────────────────

#[event]
pub struct ContainerRegistered {
    pub id: u64,
    pub container_type: ContainerType,
    pub deposit: u64,
    pub producer: Pubkey,
    pub slot: u64,
}

#[event]
pub struct ContainerReturned {
    pub id: u64,
    pub store: Pubkey,
    pub deposit: u64,
}

#[event]
pub struct StoreSettled {
    pub store: Pubkey,
    pub amount: u64,
}

#[event]
pub struct UnclaimedSwept {
    pub id: u64,
    pub deposit: u64,
}

// ─── Program ─────────────────────────────────────────────────────────────────

#[program]
pub mod bottleneck {
    use super::*;

    pub fn initialize_system(
        ctx: Context<InitializeSystem>,
        deposit_pet: u64,
        deposit_glass: u64,
        unclaim_threshold_slots: u64,
    ) -> Result<()> {
        let vault_bump = *ctx.bumps.get("vault").unwrap();

        let rent = Rent::get()?;
        let vault_lamports = rent.minimum_balance(0);

        anchor_lang::solana_program::program::invoke_signed(
            &anchor_lang::solana_program::system_instruction::create_account(
                ctx.accounts.authority.key,
                ctx.accounts.vault.key,
                vault_lamports,
                0,
                ctx.program_id,
            ),
            &[
                ctx.accounts.authority.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[&[b"vault", &[vault_bump]]],
        )?;

        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.deposit_pet_lamports = deposit_pet;
        config.deposit_glass_lamports = deposit_glass;
        config.total_in_circulation = 0;
        config.total_returned = 0;
        config.total_unclaimed_lamports = 0;
        config.unclaim_threshold_slots = unclaim_threshold_slots;
        config.vault_bump = vault_bump;
        config.bump = *ctx.bumps.get("config").unwrap();

        Ok(())
    }

    pub fn register_container(
        ctx: Context<RegisterContainer>,
        id: u64,
        container_type: ContainerType,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        let deposit = match container_type {
            ContainerType::Pet => config.deposit_pet_lamports,
            ContainerType::Glass => config.deposit_glass_lamports,
        };

        let slot = Clock::get()?.slot;

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.producer.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            deposit,
        )?;

        let container = &mut ctx.accounts.container;
        container.container_id = id;
        container.container_type = container_type;
        container.deposit_lamports = deposit;
        container.status = ContainerStatus::InCirculation;
        container.producer = ctx.accounts.producer.key();
        container.registered_slot = slot;
        container.bump = *ctx.bumps.get("container").unwrap();

        config.total_in_circulation = config
            .total_in_circulation
            .checked_add(1)
            .ok_or(DrsError::MathOverflow)?;

        emit!(ContainerRegistered {
            id,
            container_type,
            deposit,
            producer: ctx.accounts.producer.key(),
            slot,
        });

        Ok(())
    }

    pub fn return_container(ctx: Context<ReturnContainer>, id: u64) -> Result<()> {
        let container = &mut ctx.accounts.container;
        let collection_point = &mut ctx.accounts.collection_point;
        let config = &mut ctx.accounts.config;
        let store_key = ctx.accounts.store.key();

        require!(
            container.status == ContainerStatus::InCirculation,
            DrsError::AlreadyReturned
        );

        let deposit = container.deposit_lamports;
        container.status = ContainerStatus::Returned;

        if collection_point.store == Pubkey::default() {
            collection_point.store = store_key;
            collection_point.bump = *ctx.bumps.get("collection_point").unwrap();
        }

        collection_point.reimbursable_lamports = collection_point
            .reimbursable_lamports
            .checked_add(deposit)
            .ok_or(DrsError::MathOverflow)?;

        config.total_returned = config
            .total_returned
            .checked_add(1)
            .ok_or(DrsError::MathOverflow)?;
        config.total_in_circulation = config
            .total_in_circulation
            .checked_sub(1)
            .ok_or(DrsError::MathOverflow)?;

        emit!(ContainerReturned {
            id,
            store: store_key,
            deposit,
        });

        Ok(())
    }

    pub fn settle_store(ctx: Context<SettleStore>) -> Result<()> {
        let amount = ctx.accounts.collection_point.reimbursable_lamports;
        let rent_min = Rent::get()?.minimum_balance(0);

        require!(amount > 0, DrsError::NothingToSettle);
        require!(
            **ctx.accounts.vault.lamports.borrow() >= amount.checked_add(rent_min).ok_or(DrsError::MathOverflow)?,
            DrsError::InsufficientVault
        );

        ctx.accounts.collection_point.reimbursable_lamports = 0;

        **ctx.accounts.vault.try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.store.to_account_info().try_borrow_mut_lamports()? += amount;

        emit!(StoreSettled {
            store: ctx.accounts.store.key(),
            amount,
        });

        Ok(())
    }

    pub fn sweep_unclaimed(ctx: Context<SweepUnclaimed>, id: u64) -> Result<()> {
        let container = &mut ctx.accounts.container;
        let config = &mut ctx.accounts.config;

        require!(
            container.status == ContainerStatus::InCirculation,
            DrsError::NotInCirculation
        );

        let clock = Clock::get()?;
        let threshold = container
            .registered_slot
            .checked_add(config.unclaim_threshold_slots)
            .ok_or(DrsError::MathOverflow)?;
        require!(clock.slot >= threshold, DrsError::SweepNotAllowed);

        let deposit = container.deposit_lamports;
        container.status = ContainerStatus::Settled;

        config.total_unclaimed_lamports = config
            .total_unclaimed_lamports
            .checked_add(deposit)
            .ok_or(DrsError::MathOverflow)?;
        config.total_in_circulation = config
            .total_in_circulation
            .checked_sub(1)
            .ok_or(DrsError::MathOverflow)?;

        emit!(UnclaimedSwept { id, deposit });

        Ok(())
    }
}

// ─── Contexts ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeSystem<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + SystemConfig::INIT_SPACE,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, SystemConfig>,

    /// CHECK: PDA vault validated by seeds; initialized via create_account CPI
    #[account(
        mut,
        seeds = [b"vault"],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct SweepUnclaimed<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority,
    )]
    pub config: Account<'info, SystemConfig>,

    #[account(
        mut,
        seeds = [b"container", id.to_le_bytes().as_ref()],
        bump = container.bump,
    )]
    pub container: Account<'info, Container>,
}

#[derive(Accounts)]
pub struct SettleStore<'info> {
    #[account(mut)]
    pub store: Signer<'info>,

    #[account(
        mut,
        seeds = [b"store", store.key().as_ref()],
        bump = collection_point.bump,
    )]
    pub collection_point: Account<'info, CollectionPoint>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, SystemConfig>,

    /// CHECK: PDA vault validated by seeds and vault_bump stored in config
    #[account(
        mut,
        seeds = [b"vault"],
        bump = config.vault_bump,
    )]
    pub vault: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct ReturnContainer<'info> {
    #[account(mut)]
    pub store: Signer<'info>,

    #[account(
        mut,
        seeds = [b"container", id.to_le_bytes().as_ref()],
        bump = container.bump,
    )]
    pub container: Account<'info, Container>,

    #[account(
        init_if_needed,
        payer = store,
        space = 8 + CollectionPoint::INIT_SPACE,
        seeds = [b"store", store.key().as_ref()],
        bump,
    )]
    pub collection_point: Account<'info, CollectionPoint>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, SystemConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct RegisterContainer<'info> {
    #[account(mut)]
    pub producer: Signer<'info>,

    #[account(
        init,
        payer = producer,
        space = 8 + Container::INIT_SPACE,
        seeds = [b"container", id.to_le_bytes().as_ref()],
        bump,
    )]
    pub container: Account<'info, Container>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, SystemConfig>,

    /// CHECK: PDA vault validated by seeds and vault_bump stored in config
    #[account(
        mut,
        seeds = [b"vault"],
        bump = config.vault_bump,
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
