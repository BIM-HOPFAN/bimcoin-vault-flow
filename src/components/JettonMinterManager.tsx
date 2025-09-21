import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Zap, AlertTriangle, Save } from 'lucide-react';
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
  const [configuring, setConfiguring] = useState(false);
  const [newMinterAddress, setNewMinterAddress] = useState('');
  const [showAddressInput, setShowAddressInput] = useState(false);
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

  const configureMinterAddress = async () => {
    if (!newMinterAddress.trim()) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid jetton minter address",
        variant: "destructive",
      });
      return;
    }

    setConfiguring(true);
    try {
      // Update the minter address in the config table
      const { error } = await supabase
        .from('config')
        .upsert({
          key: 'jetton_minter_address',
          value: newMinterAddress.trim(),
          description: 'Real jetton minter address deployed via minter.ton.org'
        });

      if (error) throw error;

      toast({
        title: "Minter Configured",
        description: "Successfully configured your real jetton minter address",
        variant: "default",
      });

      setNewMinterAddress('');
      setShowAddressInput(false);
      await fetchMinterInfo();
    } catch (error) {
      console.error('Failed to configure minter:', error);
      toast({
        title: "Configuration Failed",
        description: error instanceof Error ? error.message : "Failed to configure jetton minter",
        variant: "destructive",
      });
    } finally {
      setConfiguring(false);
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
                <p className="font-medium text-orange-800 dark:text-orange-200">Jetton Minter Configuration Needed</p>
                <p className="text-orange-700 dark:text-orange-300 mt-1">
                  Configure your real jetton minter address or deploy a new one.
                </p>
              </div>
            </div>
            
            {!showAddressInput ? (
              <div className="space-y-2">
                <Button 
                  onClick={() => setShowAddressInput(true)}
                  className="w-full bg-gradient-primary hover:opacity-90 glow-primary"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Configure Existing Minter
                </Button>
                
                <Button 
                  onClick={deployNewMinter}
                  disabled={deploying}
                  variant="outline"
                  className="w-full"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {deploying ? "Deploying..." : "Deploy New Minter"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="minter-address">Jetton Minter Address</Label>
                  <Input
                    id="minter-address"
                    placeholder="EQ..."
                    value={newMinterAddress}
                    onChange={(e) => setNewMinterAddress(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the address of your jetton minter deployed via minter.ton.org
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={configureMinterAddress}
                    disabled={configuring || !newMinterAddress.trim()}
                    className="flex-1"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {configuring ? "Saving..." : "Save Address"}
                  </Button>
                  
                  <Button 
                    onClick={() => {
                      setShowAddressInput(false);
                      setNewMinterAddress('');
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
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