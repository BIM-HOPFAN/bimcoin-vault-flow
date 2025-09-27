# BimCoin TON DeFi Protocol

A comprehensive decentralized finance application built on The Open Network (TON) blockchain, featuring token deposits, passive mining, task completion, and referral rewards.

## Overview

BimCoin is a DeFi protocol that allows users to deposit TON tokens to mint BIM tokens and earn OBA rewards through various activities including passive mining, task completion, and referrals. The platform provides a seamless Web3 experience with modern UI/UX design.

## Key Features

### 💰 Token System
- **BIM Token**: Primary ecosystem token (1 TON = 200 BIM)
- **OBA Token**: Reward token earned through platform activities
- **Token Burning**: Convert BIM/OBA back to TON

### ⛏️ Mining & Rewards
- **Passive Mining**: Earn 50% OBA daily on active BIM deposits
- **Task Rewards**: Complete social and trading tasks for 3% OBA daily
- **Referral Program**: Earn 2% OBA on friend deposits

### 🔗 TON Integration
- **Wallet Support**: TonConnect integration with Tonkeeper, MyTonWallet
- **Smart Contracts**: Jetton standard (TEP-74) implementation
- **Real-time Tracking**: Blockchain transaction monitoring

### 🎨 User Experience
- **Modern Interface**: Dark theme with TON blue and gold accents
- **Responsive Design**: Mobile-first approach
- **Real-time Updates**: Live balance and mining status
- **Smooth Animations**: Enhanced visual feedback

## Tech Stack

### Frontend
- **React 18** + TypeScript + Vite
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: shadcn/ui + Radix UI primitives
- **State Management**: TanStack Query
- **TON Integration**: @tonconnect/ui-react, @ton/ton, @ton/crypto

### Backend (Supabase)
- **Database**: PostgreSQL with Row Level Security
- **API**: Supabase Edge Functions (Deno runtime)
- **Authentication**: Built-in user management
- **Real-time**: Subscriptions and live updates

## Getting Started

### Prerequisites
- Node.js 18 or higher
- npm or yarn package manager
- TON wallet (Tonkeeper or MyTonWallet recommended)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd bimcoin-dapp

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Environment Setup

The application uses Supabase for backend services. Configuration is handled through:
- `src/integrations/supabase/client.ts` - Database connection
- `.env` - Environment variables (if needed)

## Project Structure

```
src/
├── components/
│   ├── ui/                    # shadcn/ui component library
│   ├── WalletConnectButton.tsx    # TON wallet integration
│   ├── DepositCard.tsx        # Deposit interface
│   ├── MiningCard.tsx         # Mining dashboard
│   ├── TaskCard.tsx           # Task management
│   ├── ReferralCard.tsx       # Referral system
│   ├── BalanceCard.tsx        # Portfolio tracking
│   ├── BIMBurnCard.tsx        # BIM burning interface
│   ├── OBABurnCard.tsx        # OBA conversion
│   ├── HeroSection.tsx        # Landing hero
│   └── TonConnectProvider.tsx # TON connection wrapper
├── pages/
│   ├── Index.tsx              # Main application
│   ├── Admin.tsx              # Admin dashboard
│   ├── Terms.tsx              # Terms of service
│   ├── Privacy.tsx            # Privacy policy
│   └── Whitepaper.tsx         # Technical documentation
├── hooks/
│   ├── useReferral.ts         # Referral management
│   └── use-mobile.tsx         # Mobile detection
├── lib/
│   ├── api.ts                 # API client
│   └── utils.ts               # Utility functions
└── integrations/supabase/     # Database integration

supabase/
├── functions/
│   ├── user-api/              # User management
│   ├── deposit-api/           # Deposit processing
│   ├── mining-api/            # Mining operations
│   ├── task-api/              # Task system
│   ├── burn-api/              # Token burning
│   ├── jetton-minter/         # Token minting
│   └── ton-watcher/           # Blockchain monitoring
└── migrations/                # Database schema
```

## Token Economics

### BIM Token (Primary)
- **Minting Rate**: 1 TON = 200 BIM
- **Purpose**: Ecosystem participation and rewards
- **Burning**: Convert back to TON (configurable exchange rate)

### OBA Token (Rewards)
- **Mining**: 50% daily yield on active BIM deposits
- **Tasks**: 3% daily rewards for completed activities
- **Referrals**: 2% rewards on successful referrals
- **Activity Window**: 365-day reward eligibility

## Smart Contracts

### Jetton Master Contract
- **Address**: `EQBiJdfXqgRRO0asz71X0MBhS8__FY_Kc9bq6d7o-dVDshja`
- **Standard**: TON Jetton (TEP-74)
- **Functions**: Token minting, burning, and transfers

### Treasury Operations
- **Deposit Tracking**: Unique comment format `BIM:DEPOSIT:<uuid>`
- **Automatic Processing**: Real-time deposit confirmation
- **Withdrawal System**: Automated TON payouts on burns

## Backend Architecture

### Edge Functions (Serverless APIs)
Each function handles specific business logic:

- **user-api**: Profile management, balance tracking, leaderboard
- **deposit-api**: TON deposit processing, BIM minting, referral rewards
- **mining-api**: Mining session management (start/claim/status/history)
- **task-api**: Task completion, verification, reward distribution
- **burn-api**: Token burning operations (BIM/OBA to TON)
- **jetton-minter**: Smart contract interactions, token minting
- **ton-watcher**: Blockchain event monitoring, transaction verification

### Database Schema
PostgreSQL tables with comprehensive RLS policies:

- **users**: Wallet addresses, balances, activity tracking
- **deposits**: Transaction history, confirmation status
- **mining_sessions**: Active mining tracking, earnings calculation
- **tasks**: Task definitions, verification requirements
- **user_tasks**: Completion tracking, reward distribution
- **referrals**: Referral relationships, reward history
- **burns**: Token burning history, payout tracking
- **config**: System configuration, exchange rates

## Security Implementation

### Frontend Security
- **No Private Keys**: All signing done via wallet
- **Input Validation**: Comprehensive client-side validation
- **Secure Communication**: HTTPS-only API communication
- **Error Handling**: Graceful error states and user feedback

### Backend Security
- **Row Level Security**: Database-level access control
- **User Isolation**: Each user can only access their own data
- **Transaction Verification**: All blockchain interactions verified
- **Rate Limiting**: API abuse protection
- **Referral Protection**: Prevents duplicate rewards and manipulation

### Recent Security Updates
- ✅ Fixed mining session access policies
- ✅ Implemented user-specific data isolation
- ✅ Enhanced referral system security
- ✅ Added comprehensive input validation
- ✅ Secured all RLS policies against unauthorized access

## Development

### Design System
The application uses a custom design system defined in `src/index.css`:

```css
:root {
  --primary: 215 100% 60%;        /* TON Blue */
  --secondary: 45 100% 60%;       /* BIM Gold */
  --accent: 280 100% 70%;         /* Purple accent */
  /* Gradients, shadows, and animations */
}
```

### Component Guidelines
- Use semantic design tokens (no hardcoded colors)
- Implement proper loading and error states
- Follow responsive design principles
- Maintain consistent TON branding

### State Management
- **Wallet State**: TonConnect provider
- **API Data**: TanStack Query for caching
- **Local State**: React hooks for UI interactions
- **Notifications**: Toast system for user feedback

## Deployment

### Production Build
```bash
# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview
```

### Environment Configuration
- Configure TON network endpoints (mainnet/testnet)
- Set up Supabase connection details
- Configure monitoring and analytics

## API Documentation

### User Management
- `GET /user-api/profile` - Get user profile
- `POST /user-api/register` - Register new user
- `GET /user-api/stats` - Get user statistics

### Deposits
- `POST /deposit-api/create-intent` - Create deposit intent
- `GET /deposit-api/history` - Get deposit history
- `GET /deposit-api/status` - Check deposit status

### Mining
- `POST /mining-api/start` - Start mining session
- `POST /mining-api/claim` - Claim mining rewards
- `GET /mining-api/status` - Get mining status

### Tasks
- `GET /task-api/available` - List available tasks
- `POST /task-api/complete` - Complete task
- `GET /task-api/user-history` - Get user task history

## Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Follow** existing code style and patterns
4. **Add** proper TypeScript types
5. **Test** across different wallets and devices
6. **Commit** changes (`git commit -m 'Add amazing feature'`)
7. **Push** to branch (`git push origin feature/amazing-feature`)
8. **Open** a Pull Request

### Code Standards
- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- Conventional commits for git history

## Support & Resources

### Documentation
- [TON Blockchain](https://ton.org)
- [TonConnect Documentation](https://docs.ton.org/develop/dapps/ton-connect/overview)
- [Jetton Standard (TEP-74)](https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md)
- [Supabase Documentation](https://supabase.com/docs)

### Community
- TON Developer Chat
- BimCoin Community Discord
- GitHub Issues for bug reports

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for the TON ecosystem**

*Empowering decentralized finance through innovative token mechanics and user-centric design.*