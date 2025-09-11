import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export const useReferral = () => {
  const [searchParams] = useSearchParams();
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    // Check for referral code in URL
    const refParam = searchParams.get('ref');
    if (refParam) {
      setReferralCode(refParam);
      // Store in localStorage for later use
      localStorage.setItem('referralCode', refParam);
    } else {
      // Check if we have a stored referral code
      const storedRef = localStorage.getItem('referralCode');
      if (storedRef) {
        setReferralCode(storedRef);
      }
    }
  }, [searchParams]);

  const clearReferralCode = () => {
    setReferralCode(null);
    localStorage.removeItem('referralCode');
  };

  return {
    referralCode,
    clearReferralCode
  };
};