const SUPABASE_URL = 'https://xyskyvwxbpnlveamxwlb.supabase.co'

export class BimCoinAPI {
  private baseUrl: string

  constructor() {
    this.baseUrl = `${SUPABASE_URL}/functions/v1`
  }

  /**
   * Generate authentication headers with timestamp
   * This proves the request is fresh and from the wallet owner
   */
  private getAuthHeaders(walletAddress: string): HeadersInit {
    const timestamp = Date.now();
    const message = `${walletAddress}-${timestamp}`;
    const signature = btoa(message); // Base64 encode

    return {
      'Content-Type': 'application/json',
      'X-Wallet-Address': walletAddress,
      'X-Timestamp': timestamp.toString(),
      'X-Signature': signature,
    };
  }

  // User API
  async registerUser(walletAddress: string, referralCode?: string) {
    try {
      const response = await fetch(`${this.baseUrl}/user-api/register`, {
        method: 'POST',
        headers: this.getAuthHeaders(walletAddress),
        body: JSON.stringify({ wallet_address: walletAddress, referral_code: referralCode })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        return { error: data.error || `HTTP ${response.status}: Failed to register user` }
      }
      
      return data
    } catch (error) {
      console.error('Register user error:', error)
      return { error: 'Network error: Unable to register user' }
    }
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
      headers: this.getAuthHeaders(walletAddress),
      body: JSON.stringify({ wallet_address: walletAddress })
    })
    return await response.json()
  }

  async getLeaderboard(limit = 10) {
    const response = await fetch(`${this.baseUrl}/user-api/leaderboard?limit=${limit}`)
    return await response.json()
  }

  // Deposit API
  async createDepositIntent(walletAddress: string, depositAmount: number, depositType: 'TON' | 'Bimcoin' = 'TON') {
    try {
      const response = await fetch(`${this.baseUrl}/deposit-api/create-intent`, {
        method: 'POST',
        headers: this.getAuthHeaders(walletAddress),
        body: JSON.stringify({ 
          wallet_address: walletAddress, 
          deposit_amount: depositAmount,
          deposit_type: depositType
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        return { error: data.error || `HTTP ${response.status}: ${response.statusText}` }
      }
      
      return data
    } catch (error) {
      console.error('Create deposit intent error:', error)
      return { error: 'Network error: Unable to connect to deposit service' }
    }
  }

  async getDepositHistory(walletAddress: string, limit = 10) {
    try {
      const response = await fetch(`${this.baseUrl}/deposit-api/history?wallet_address=${walletAddress}&limit=${limit}`)
      const data = await response.json()
      
      if (!response.ok) {
        return { error: data.error || `HTTP ${response.status}: Failed to fetch deposit history` }
      }
      
      return data
    } catch (error) {
      console.error('Get deposit history error:', error)
      return { error: 'Network error: Unable to fetch deposit history' }
    }
  }

  async getDepositStatus(depositId: string) {
    try {
      const response = await fetch(`${this.baseUrl}/deposit-api/status?deposit_id=${depositId}`)
      const data = await response.json()
      
      if (!response.ok) {
        return { error: data.error || `HTTP ${response.status}: Failed to fetch deposit status` }
      }
      
      return data
    } catch (error) {
      console.error('Get deposit status error:', error)
      return { error: 'Network error: Unable to fetch deposit status' }
    }
  }

  // Mining API
  async startMining(walletAddress: string) {
    const response = await fetch(`${this.baseUrl}/mining-api/start`, {
      method: 'POST',
      headers: this.getAuthHeaders(walletAddress),
      body: JSON.stringify({ wallet_address: walletAddress })
    })
    return await response.json()
  }

  async claimMining(walletAddress: string) {
    console.log('🔐 Claiming mining for wallet:', walletAddress)
    const headers = this.getAuthHeaders(walletAddress)
    console.log('📤 Sending headers:', headers)
    
    const response = await fetch(`${this.baseUrl}/mining-api/claim`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ wallet_address: walletAddress })
    })
    const result = await response.json()
    console.log('📥 Claim response:', result)
    return result
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

  async completeTask(walletAddress: string, taskId: string, verificationData?: any) {
    const response = await fetch(`${this.baseUrl}/task-api/complete`, {
      method: 'POST',
      headers: this.getAuthHeaders(walletAddress),
      body: JSON.stringify({ 
        wallet_address: walletAddress, 
        task_id: taskId,
        verification_data: verificationData
      })
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
        oba_balance: data.oba_balance,
        real_bimcoin_balance: data.real_bimcoin_balance
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

  // Jetton Wallet API
  async deriveJettonWallet(ownerAddress: string, jettonMasterAddress: string) {
    const response = await fetch(`${this.baseUrl}/jetton-wallet-api/derive-wallet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner_address: ownerAddress,
        jetton_master_address: jettonMasterAddress
      })
    });
    return response.json();
  }

  // Burn API
  async burnOBA(walletAddress: string, obaAmount: number) {
    const response = await fetch(`${this.baseUrl}/burn-api/burn-oba`, {
      method: 'POST',
      headers: this.getAuthHeaders(walletAddress),
      body: JSON.stringify({ wallet_address: walletAddress, oba_amount: obaAmount })
    })
    return await response.json()
  }

  async getBurnHistory(walletAddress: string, limit = 10) {
    const response = await fetch(`${this.baseUrl}/burn-api/history?wallet_address=${walletAddress}&limit=${limit}`)
    return await response.json()
  }

  async burnBIM(walletAddress: string, bimAmount: number, payoutType: 'ton' | 'jetton' = 'ton') {
    const endpoint = payoutType === 'jetton' ? 'burn-bim-for-jetton' : 'burn-bim'
    const response = await fetch(`${this.baseUrl}/burn-api/${endpoint}`, {
      method: 'POST',
      headers: this.getAuthHeaders(walletAddress),
      body: JSON.stringify({ wallet_address: walletAddress, bim_amount: bimAmount })
    })
    return await response.json()
  }

  // Get burn preview with penalty calculation
  async getBurnPreview(walletAddress: string, bimAmount: number) {
    const response = await fetch(`${this.baseUrl}/burn-api/preview`, {
      method: 'POST',
      headers: this.getAuthHeaders(walletAddress),
      body: JSON.stringify({ wallet_address: walletAddress, bim_amount: bimAmount })
    })
    return await response.json()
  }

  // Admin Task Management API
  async getAdminTasks() {
    const response = await fetch(`${this.baseUrl}/task-api/admin/tasks`)
    return await response.json()
  }

  async createTask(taskData: any) {
    const response = await fetch(`${this.baseUrl}/task-api/admin/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData)
    })
    return await response.json()
  }

  async updateTask(taskId: string, taskData: any) {
    const response = await fetch(`${this.baseUrl}/task-api/admin/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData)
    })
    return await response.json()
  }

  async deleteTask(taskId: string) {
    const response = await fetch(`${this.baseUrl}/task-api/admin/tasks/${taskId}`, {
      method: 'DELETE'
    })
    return await response.json()
  }

  async verifyTaskCompletion(walletAddress: string, taskId: string, verificationData?: any) {
    const response = await fetch(`${this.baseUrl}/task-api/verify`, {
      method: 'POST',
      headers: this.getAuthHeaders(walletAddress),
      body: JSON.stringify({ 
        wallet_address: walletAddress, 
        task_id: taskId,
        verification_data: verificationData
      })
    })
    return await response.json()
  }
}

export const bimCoinAPI = new BimCoinAPI()