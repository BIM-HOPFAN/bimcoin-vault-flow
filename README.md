# Bimcoin TON DeFi Protocol

A modern React-based decentralized application built on The Open Network (TON) blockchain for earning BIM and OBA tokens through deposits, mining, tasks, and referrals.

## Features

### 🌟 Core Functionality
- **TON Wallet Integration**: Connect via TonConnect UI with support for Tonkeeper and MyTonWallet
- **Token Deposits**: Deposit TON to mint Bimcoin tokens (1 TON = 1,000 BIM)
- **OBA Mining**: Earn 50% OBA tokens daily through passive mining
- **Task System**: Complete social and trading tasks for 3% OBA daily rewards
- **Referral Program**: Earn 2% OBA on friend deposits with 365-day activity window
- **Portfolio Tracking**: Real-time balance display and portfolio analytics

### 🎨 Design System
- **Modern DeFi Interface**: Dark theme with TON blue and gold accents
- **Responsive Design**: Mobile-first approach with beautiful gradients
- **Smooth Animations**: Enhanced user experience with floating elements and glow effects
- **Component Library**: Built with shadcn/ui and Tailwind CSS

### 🔧 Technical Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Supabase with PostgreSQL database and Edge Functions
- **Styling**: Tailwind CSS with custom design tokens
- **TON Integration**: @tonconnect/ui-react, @ton/ton, @ton/crypto
- **State Management**: TanStack Query for async state
- **UI Components**: Radix UI primitives with shadcn/ui
- **Security**: Row Level Security (RLS) policies and secure API endpoints

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- TON wallet (Tonkeeper or MyTonWallet recommended)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd bimcoin-ton-dapp

# Install dependencies
npm install

# Start development server
npm run dev
```

### Project Structure

```
src/
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── WalletConnectButton.tsx    # TON wallet connection
│   ├── DepositCard.tsx     # TON deposit interface
│   ├── MiningCard.tsx      # OBA mining dashboard
│   ├── TaskCard.tsx        # Task completion system
│   ├── ReferralCard.tsx    # Referral program interface
│   ├── BalanceCard.tsx     # Portfolio balance display
│   ├── HeroSection.tsx     # Landing page hero
│   ├── BIMBurnCard.tsx     # BIM token burning interface
│   ├── OBABurnCard.tsx     # OBA token burning interface
│   └── TonConnectProvider.tsx     # TON connection provider
├── pages/
│   ├── Index.tsx           # Main application page
│   ├── Admin.tsx           # Admin dashboard
│   ├── Privacy.tsx         # Privacy policy page
│   └── Terms.tsx           # Terms of service page
├── hooks/
│   ├── useReferral.ts      # Referral code handling hook
│   └── use-mobile.tsx      # Mobile detection hook
├── lib/                    # Utility functions and API clients
└── index.css              # Design system and global styles

supabase/
├── functions/
│   ├── deposit-api/        # Handles TON deposits and BIM minting
│   ├── mining-api/         # Manages OBA mining sessions
│   ├── task-api/           # Task management and completion
│   ├── user-api/           # User profile and balance management
│   ├── burn-api/           # Token burning operations
│   ├── jetton-minter/      # Jetton contract deployment and minting
│   └── ton-watcher/        # Blockchain event monitoring
└── migrations/             # Database schema and RLS policies
```

## Token Economics

### Bimcoin (BIM)
- **Minting**: 1 TON = 1,000 BIM tokens
- **Burning**: Convert BIM back to TON (configurable rate)
- **Usage**: Primary token for ecosystem participation

### OBA Rewards
- **Mining**: 50% OBA per day (continuous stream)
- **Tasks**: 3% OBA daily for completed activities
- **Referrals**: 2% OBA on valid friend deposits
- **Activity Window**: 365-day participation tracking

## Smart Contract Integration

### Jetton Master
- **Contract**: `EQBiJdfXqgRRO0asz71X0MBhS8__FY_Kc9bq6d7o-dVDshja`
- **Standard**: TON Jetton (TEP-74)
- **Functions**: Mint/burn Bimcoin tokens

### Treasury Operations
- **Deposits**: Tracked via comment `BIM:DEPOSIT:<uuid>`
- **Withdrawals**: Automatic TON payouts on burn events
- **Security**: Admin wallet controls minting operations

## Wallet Connection

The app supports multiple TON wallets through TonConnect:

- **Tonkeeper**: Mobile and browser extension
- **MyTonWallet**: Cross-platform wallet solution
- **Custom Integration**: Easy to add more wallets

## Development

### Design System
All styles are defined in `src/index.css` using CSS custom properties:

```css
:root {
  --primary: 215 100% 60%;        /* TON Blue */
  --secondary: 45 100% 60%;       /* BIM Gold */
  --gradient-primary: linear-gradient(135deg, ...);
  --shadow-primary: 0 10px 40px -10px ...;
}
```

### Component Guidelines
- Use semantic design tokens (never hardcode colors)
- Implement proper error handling and loading states
- Follow TON transaction patterns with proper validation
- Maintain responsive design across all screen sizes

### State Management
- TonConnect for wallet state
- React Query for async operations
- Local state for UI interactions
- Toast notifications for user feedback

## Backend Architecture

The application features a fully implemented Supabase backend with the following components:

### 🔄 Edge Functions (Serverless APIs)
- **deposit-api**: Handles TON deposit intents, processes confirmed deposits, manages referral rewards
- **mining-api**: Manages OBA mining sessions (start, claim, status, history)
- **task-api**: Task management system with verification logic for social/trading tasks
- **user-api**: User profile management, balance tracking, and portfolio analytics
- **burn-api**: Token burning operations for BIM and OBA tokens
- **jetton-minter**: Jetton contract deployment and token minting operations
- **ton-watcher**: Real-time blockchain event monitoring and transaction processing

### 🗄️ Database Schema (PostgreSQL)
- **users**: Wallet addresses, balances, activity tracking, referral relationships
- **deposits**: Deposit history, transaction hashes, confirmation status
- **mining_sessions**: Mining start/end times, earnings, session status
- **tasks**: Task definitions, rewards, verification requirements
- **user_tasks**: Task completion tracking and reward distribution
- **referrals**: Referral relationships and reward history
- **config**: System configuration, rates, addresses

### 🔒 Security Features
- **Row Level Security (RLS)**: All tables protected with user-specific access policies
- **Secure Mining Access**: Users can only view/modify their own mining sessions
- **Referral Protection**: Prevents duplicate rewards and validates referral chains
- **Transaction Validation**: Comprehensive verification of all blockchain transactions
- **Rate Limiting**: Built-in protection against API abuse

## Deployment

### Frontend Deployment
```bash
# Build for production
npm run build

# Preview build locally
npm run preview
```

### Environment Configuration
Create appropriate environment files for:
- TON network endpoints (mainnet/testnet)
- API endpoints and authentication
- Monitoring and analytics services

## Security Implementation

### 🔐 Frontend Security
- **Client-Side**: No private keys stored in frontend
- **Transactions**: User signs all transactions via wallet
- **Input Validation**: Comprehensive validation on all user inputs
- **Secure Communication**: All API calls use HTTPS with proper authentication

### 🛡️ Backend Security (Recently Enhanced)
- **Row Level Security**: Every database table has RLS policies restricting access to user's own data
- **Mining Session Protection**: Users can only access their own mining sessions and earnings
- **Referral System Security**: Prevents double-spending and validates referral relationships
- **Transaction Verification**: All blockchain transactions are verified before processing
- **Admin Controls**: Separate admin policies for system management
- **API Rate Limiting**: Protection against abuse and spam requests

### 🔍 Recent Security Updates
- Fixed overly permissive mining_sessions policies that allowed unauthorized data access
- Implemented user-specific data isolation across all tables
- Added comprehensive input validation for all API endpoints
- **Fixed critical referral system vulnerability**: Replaced unrestricted access policy with secure RLS policies that only allow users to view referrals where they are the referrer/referee, and restrict all data modifications to backend functions only
- Enhanced referral system to prevent reward manipulation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the existing code style and design patterns
4. Add proper TypeScript types and error handling
5. Test across different wallets and screen sizes
6. Submit a pull request with clear description

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Links

- **TON Blockchain**: https://ton.org
- **TonConnect**: https://docs.ton.org/develop/dapps/ton-connect/overview
- **Jetton Standard**: https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md

---

Built with ❤️ for the TON ecosystem