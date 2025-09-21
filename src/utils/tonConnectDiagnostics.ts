// Utility to diagnose TON Connect issues
export const diagnoseTonConnect = async () => {
  const manifestUrl = 'https://db23b08d-08a2-4e7e-b648-6f394e9e12c2.lovableproject.com/tonconnect-manifest.json';
  const iconUrl = 'https://db23b08d-08a2-4e7e-b648-6f394e9e12c2.lovableproject.com/bimcoin-logo.png';
  
  console.log('=== TON Connect Diagnostics ===');
  
  // Test manifest URL
  try {
    console.log('Testing manifest URL...');
    const manifestResponse = await fetch(manifestUrl, { method: 'HEAD' });
    console.log('Manifest Status:', manifestResponse.status);
    console.log('Manifest CORS Headers:', {
      'Access-Control-Allow-Origin': manifestResponse.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': manifestResponse.headers.get('Access-Control-Allow-Methods'),
      'Content-Type': manifestResponse.headers.get('Content-Type')
    });
    
    // Also fetch content to verify JSON structure
    const manifestContentResponse = await fetch(manifestUrl);
    const manifestContent = await manifestContentResponse.json();
    console.log('Manifest Content:', manifestContent);
  } catch (error) {
    console.error('Manifest fetch failed:', error);
  }
  
  // Test icon URL
  try {
    console.log('Testing icon URL...');
    const iconResponse = await fetch(iconUrl, { method: 'HEAD' });
    console.log('Icon Status:', iconResponse.status);
    console.log('Icon Headers:', {
      'Content-Type': iconResponse.headers.get('Content-Type'),
      'Content-Length': iconResponse.headers.get('Content-Length'),
      'Access-Control-Allow-Origin': iconResponse.headers.get('Access-Control-Allow-Origin')
    });
  } catch (error) {
    console.error('Icon fetch failed:', error);
  }
  
  // Check TonConnect UI availability
  console.log('TonConnect UI availability check...');
  console.log('Window.TonConnectSDK:', typeof window !== 'undefined' ? (window as any).TonConnectSDK : 'undefined');
  
  console.log('=== End Diagnostics ===');
};