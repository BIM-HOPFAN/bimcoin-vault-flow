const SUPABASE_URL = 'https://xyskyvwxbpnlveamxwlb.supabase.co'

export class BimCoinAPI {
  private baseUrl: string

  constructor() {
    this.baseUrl = `${SUPABASE_URL}/functions/v1`
  }

  // User API
  async registerUser(walletAddress: string, referralCode?: string) {
    const response = await fetch(`${this.baseUrl}/user-api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_address: walletAddress, referral_code: referralCode })
    })
    return await response.json()
  }

  async getUserProfile(walletAddress: string) {
    const response = await fetch(`${this.baseUrl}/user-api/profile?wallet_address=${walletAddress}`)
    return await response.json()
  }

  async getUserStats(walletAddress: string) {
    const response = await fetch(`${this.baseUrl}/user-api/stats?wallet_address=${walletAddress}`)
    return await response.json()
  }

  async updateUserActivity(walletAddress: string) {
    const response = await fetch(`${this.baseUrl}/user-api/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_address: walletAddress })
    })
    return await response.json()
  }

  async getLeaderboard(limit = 10) {
    const response = await fetch(`${this.baseUrl}/user-api/leaderboard?limit=${limit}`)
    return await response.json()
  }

  // Deposit API
  async createDepositIntent(walletAddress: string, tonAmount: number) {
    const response = await fetch(`${this.baseUrl}/deposit-api/create-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_address: walletAddress, ton_amount: tonAmount })
    })
    return await response.json()
  }

  async getDepositHistory(walletAddress: string, limit = 10) {
    const response = await fetch(`${this.baseUrl}/deposit-api/history?wallet_address=${walletAddress}&limit=${limit}`)
    return await response.json()
  }

  async getDepositStatus(depositId: string) {
    const response = await fetch(`${this.baseUrl}/deposit-api/status?deposit_id=${depositId}`)
    return await response.json()
  }

  // Mining API
  async startMining(walletAddress: string) {
    const response = await fetch(`${this.baseUrl}/mining-api/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_address: walletAddress })
    })
    return await response.json()
  }

  async claimMining(walletAddress: string) {
    const response = await fetch(`${this.baseUrl}/mining-api/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_address: walletAddress })
    })
    return await response.json()
  }

  async getMiningStatus(walletAddress: string) {
    const response = await fetch(`${this.baseUrl}/mining-api/status?wallet_address=${walletAddress}`)
    return await response.json()
  }

  async getMiningHistory(walletAddress: string, limit = 10) {
    const response = await fetch(`${this.baseUrl}/mining-api/history?wallet_address=${walletAddress}&limit=${limit}`)
    return await response.json()
  }

  // Task API
  async getAvailableTasks(walletAddress?: string) {
    const url = walletAddress 
      ? `${this.baseUrl}/task-api/available?wallet_address=${walletAddress}`
      : `${this.baseUrl}/task-api/available`
    const response = await fetch(url)
    return await response.json()
  }

  async completeTask(walletAddress: string, taskId: string) {
    const response = await fetch(`${this.baseUrl}/task-api/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_address: walletAddress, task_id: taskId })
    })
    return await response.json()
  }

  async getUserTasks(walletAddress: string, limit = 10) {
    const response = await fetch(`${this.baseUrl}/task-api/user-tasks?wallet_address=${walletAddress}&limit=${limit}`)
    return await response.json()
  }

  // TON Watcher API
  async getBalance(walletAddress: string) {
    try {
      const response = await fetch(`${this.baseUrl}/ton-watcher/balance?wallet_address=${walletAddress}`)
      const data = await response.json()
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to fetch balance' }
      }
      
      return { 
        success: true, 
        ton_balance: data.ton_balance,
        bim_balance: data.bim_balance,
        oba_balance: data.oba_balance
      }
    } catch (error) {
      console.error('Balance API error:', error)
      return { success: false, error: 'Network error' }
    }
  }

  async checkDeposits() {
    const response = await fetch(`${this.baseUrl}/ton-watcher/check-deposits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    return await response.json()
  }
}

export const bimCoinAPI = new BimCoinAPI()