import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, Zap, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface MinterInfo {
  minter_address: string | null;
  status: 'configured' | 'not_configured';
  message: string;
}

const JettonMinterManager = () => {
  const [minterInfo, setMinterInfo] = useState<MinterInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchMinterInfo();
  }, []);

  const fetchMinterInfo = async () => {
    setLoading(true);
    try {
      console.log('Fetching minter info...');
      const { data, error } = await supabase.functions.invoke('jetton-minter/minter-info', {
        method: 'GET'
      });
      
      console.log('Minter info response:', { data, error });
      
      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }
      
      setMinterInfo(data);
    } catch (error) {
      console.error('Failed to fetch minter info:', error);
      
      // Set fallback info to show the deploy button
      setMinterInfo({
        minter_address: null,
        status: 'not_configured',
        message: 'Unable to connect to minter service. You can try deploying a new minter.'
      });
      
      toast({
        title: "Connection Error",
        description: "Failed to fetch jetton minter information. Showing fallback options.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deployNewMinter = async () => {
    setDeploying(true);
    try {
      const { data, error } = await supabase.functions.invoke('jetton-minter/deploy-minter', {
        method: 'POST'
      });
      
      if (error) throw error;
      
      toast({
        title: "Minter Deployed",
        description: `New jetton minter deployed at: ${data.minter_address}`,
        variant: "default",
      });
      
      await fetchMinterInfo();
    } catch (error) {
      console.error('Failed to deploy minter:', error);
      toast({
        title: "Deployment Failed",
        description: error instanceof Error ? error.message : "Failed to deploy jetton minter",
        variant: "destructive",
      });
    } finally {
      setDeploying(false);
    }
  };

  return (
    <Card className="enhanced-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          Jetton Minter Status
        </CardTitle>
        <CardDescription>
          Manage the BIMCoin jetton minter contract
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {minterInfo && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status:</span>
              <Badge variant={minterInfo.status === 'configured' ? 'default' : 'destructive'}>
                {minterInfo.status === 'configured' ? 'Active' : 'Not Configured'}
              </Badge>
            </div>
            
            {minterInfo.minter_address && (
              <div className="space-y-2">
                <span className="text-sm font-medium">Minter Address:</span>
                <div className="bg-muted/50 p-2 rounded-md font-mono text-xs break-all">
                  {minterInfo.minter_address}
                </div>
              </div>
            )}
            
            <div className="bg-muted/30 p-3 rounded-md">
              <p className="text-sm text-muted-foreground">{minterInfo.message}</p>
            </div>
          </>
        )}

        {minterInfo?.status === 'not_configured' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-md border border-orange-200 dark:border-orange-800">
              <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-orange-800 dark:text-orange-200">Jetton Minting Not Available</p>
                <p className="text-orange-700 dark:text-orange-300 mt-1">
                  You need to deploy a new jetton minter contract since the previous one was renounced.
                </p>
              </div>
            </div>
            
            <Button 
              onClick={deployNewMinter}
              disabled={deploying}
              className="w-full bg-gradient-primary hover:opacity-90 glow-primary"
            >
              <Zap className="w-4 h-4 mr-2" />
              {deploying ? "Deploying..." : "Deploy New Minter"}
            </Button>
          </div>
        )}

        <Button 
          onClick={fetchMinterInfo}
          disabled={loading}
          variant="outline"
          className="w-full"
        >
          Refresh Status
        </Button>
      </CardContent>
    </Card>
  );
};

export default JettonMinterManager;