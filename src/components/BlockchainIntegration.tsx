import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Coins, ArrowUpDown } from 'lucide-react';

const BLOCKCHAIN_SERVICE_URL = 'http://localhost:3000'; // PRODUCTION: Use environment variable

interface BlockchainIntegrationProps {
  userAddress: string;
  bimBalance: number;
  onBalanceUpdate: () => void;
}

export function BlockchainIntegration({ 
  userAddress, 
  bimBalance, 
  onBalanceUpdate 
}: BlockchainIntegrationProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [tonAmount, setTonAmount] = useState('');
  const [jettonAmount, setJettonAmount] = useState('');

  /**
   * Request TON withdrawal (BIM → TON)
   */
  const handleTonWithdrawal = async () => {
    if (!tonAmount || parseFloat(tonAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid TON amount",
        variant: "destructive"
      });
      return;
    }

    const bimRequired = parseFloat(tonAmount) * 200; // 1 TON = 200 BIM
    if (bimRequired > bimBalance) {
      toast({
        title: "Insufficient Balance",
        description: `You need ${bimRequired} BIM but only have ${bimBalance} BIM`,
        variant: "destructive"
      });
      return;
    }

    setLoading('ton');
    try {
      const response = await fetch(`${BLOCKCHAIN_SERVICE_URL}/api/withdraw/ton`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress,
          amount: tonAmount
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Withdrawal failed');
      }

      toast({
        title: "TON Withdrawal Initiated",
        description: `${tonAmount} TON withdrawal is being processed. Transaction ID: ${data.transactionId}`,
      });

      setTonAmount('');
      onBalanceUpdate();
    } catch (error: any) {
      toast({
        title: "Withdrawal Failed",
        description: error.message || 'Failed to process TON withdrawal',
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  /**
   * Request Jetton withdrawal (BIM → Bimcoin)
   */
  const handleJettonWithdrawal = async () => {
    if (!jettonAmount || parseFloat(jettonAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid Bimcoin amount",
        variant: "destructive"
      });
      return;
    }

    const bimRequired = parseFloat(jettonAmount); // 1 BIM = 1 Bimcoin
    if (bimRequired > bimBalance) {
      toast({
        title: "Insufficient Balance",
        description: `You need ${bimRequired} BIM but only have ${bimBalance} BIM`,
        variant: "destructive"
      });
      return;
    }

    setLoading('jetton');
    try {
      const response = await fetch(`${BLOCKCHAIN_SERVICE_URL}/api/withdraw/jetton`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userAddress,
          amount: jettonAmount
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Withdrawal failed');
      }

      toast({
        title: "Bimcoin Withdrawal Initiated",
        description: `${jettonAmount} Bimcoin withdrawal is being processed. Transaction ID: ${data.transactionId}`,
      });

      setJettonAmount('');
      onBalanceUpdate();
    } catch (error: any) {
      toast({
        title: "Withdrawal Failed",
        description: error.message || 'Failed to process Bimcoin withdrawal',
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  /**
   * Check user balance from blockchain service
   */
  const handleRefreshBalance = async () => {
    setLoading('balance');
    try {
      const response = await fetch(`${BLOCKCHAIN_SERVICE_URL}/api/balance/${userAddress}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch balance');
      }

      toast({
        title: "Balance Updated",
        description: `Current BIM balance: ${data.bimBalance}`,
      });

      onBalanceUpdate();
    } catch (error: any) {
      toast({
        title: "Balance Check Failed",
        description: error.message || 'Failed to check balance',
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* TON Withdrawal Card */}
      <Card className="border-gradient">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            TON Withdrawal
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Convert BIM to TON (1 TON = 200 BIM)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">TON Amount</label>
            <Input
              type="number"
              placeholder="0.0"
              value={tonAmount}
              onChange={(e) => setTonAmount(e.target.value)}
              min="0.1"
              step="0.1"
            />
            {tonAmount && (
              <p className="text-xs text-muted-foreground">
                Required BIM: {parseFloat(tonAmount || '0') * 200}
              </p>
            )}
          </div>
          <Button
            onClick={handleTonWithdrawal}
            disabled={loading === 'ton' || !tonAmount || parseFloat(tonAmount || '0') * 200 > bimBalance}
            className="w-full"
          >
            {loading === 'ton' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Withdraw TON'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Jetton Withdrawal Card */}
      <Card className="border-gradient">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5 text-primary" />
            Bimcoin Withdrawal
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Convert BIM to Bimcoin Jettons (1 BIM = 1 Bimcoin)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Bimcoin Amount</label>
            <Input
              type="number"
              placeholder="0"
              value={jettonAmount}
              onChange={(e) => setJettonAmount(e.target.value)}
              min="1"
              step="1"
            />
            {jettonAmount && (
              <p className="text-xs text-muted-foreground">
                Required BIM: {parseFloat(jettonAmount || '0')}
              </p>
            )}
          </div>
          <Button
            onClick={handleJettonWithdrawal}
            disabled={loading === 'jetton' || !jettonAmount || parseFloat(jettonAmount || '0') > bimBalance}
            className="w-full"
          >
            {loading === 'jetton' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Withdraw Bimcoin'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Balance Refresh */}
      <Card>
        <CardContent className="pt-6">
          <Button
            onClick={handleRefreshBalance}
            disabled={loading === 'balance'}
            variant="outline"
            className="w-full"
          >
            {loading === 'balance' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              'Refresh Balance'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Integration Status */}
      <Card className="bg-muted/20">
        <CardContent className="pt-6">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Wallet Address:</span>
              <span className="font-mono text-xs">
                {userAddress.slice(0, 8)}...{userAddress.slice(-8)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Current BIM Balance:</span>
              <span className="font-medium">{bimBalance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Service Status:</span>
              <span className="text-green-500">Connected</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}