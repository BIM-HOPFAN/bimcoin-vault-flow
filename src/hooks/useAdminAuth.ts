import { useEffect, useState } from 'react';
import { useTonAddress } from '@tonconnect/ui-react';
import { supabase } from '@/integrations/supabase/client';

export const useAdminAuth = () => {
  const walletAddress = useTonAddress();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!walletAddress) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // Check if wallet address exists in admin_users table
        const { data, error } = await supabase
          .from('admin_users')
          .select('wallet_address')
          .eq('wallet_address', walletAddress)
          .maybeSingle();

        if (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(!!data);
        }
      } catch (error) {
        console.error('Failed to check admin status:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [walletAddress]);

  return { isAdmin, loading, walletAddress };
};
