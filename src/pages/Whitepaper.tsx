import { ArrowLeft, Download, ExternalLink, Zap, Shield, Users, TrendingUp, Coins, Network, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

const Whitepaper = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img 
              src="/bim-icon.png" 
              alt="Bimcoin Logo" 
              className="w-8 h-8 rounded-lg"
            />
            <span className="text-xl font-bold gradient-text">Bimcoin</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to App
              </Button>
            </Link>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-4" variant="secondary">
            Whitepaper v1.0
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Bimcoin <span className="gradient-text bg-gradient-primary">Whitepaper</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            A comprehensive guide to the Bimcoin ecosystem on The Open Network (TON). 
            Discover how our DeFi protocol revolutionizes token mining, staking, and rewards distribution.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>Last updated: December 2024</span>
            <span>•</span>
            <span>Version 1.0</span>
          </div>
        </div>
      </section>

      {/* Table of Contents */}
      <section className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="enhanced-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="w-5 h-5" />
                Table of Contents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <a href="#executive-summary" className="block text-primary hover:underline">1. Executive Summary</a>
                  <a href="#vision-mission" className="block text-primary hover:underline">2. Vision & Mission</a>
                  <a href="#ton-blockchain" className="block text-primary hover:underline">3. TON Blockchain Integration</a>
                  <a href="#tokenomics" className="block text-primary hover:underline">4. Tokenomics</a>
                </div>
                <div className="space-y-2">
                  <a href="#mining-mechanism" className="block text-primary hover:underline">5. Mining Mechanism</a>
                  <a href="#earning-opportunities" className="block text-primary hover:underline">6. Earning Opportunities</a>
                  <a href="#getting-started" className="block text-primary hover:underline">7. Getting Started Guide</a>
                  <a href="#roadmap" className="block text-primary hover:underline">8. Roadmap</a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Content Sections */}
      <div className="px-4 pb-16">
        <div className="max-w-4xl mx-auto space-y-12">
          
          {/* Executive Summary */}
          <section id="executive-summary">
            <Card className="enhanced-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-6 h-6 text-primary" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-neutral dark:prose-invert max-w-none">
                <p className="text-lg leading-relaxed mb-4">
                  Bimcoin represents a revolutionary DeFi protocol built on The Open Network (TON), 
                  designed to democratize token mining and reward distribution through innovative 
                  mechanisms that benefit all participants in the ecosystem.
                </p>
                <p className="mb-4">
                  Our platform introduces a dual-token system featuring BIM (Bimcoin) and OBA 
                  (Operational Blockchain Asset) tokens, each serving distinct purposes within 
                  our comprehensive economic model.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="p-4 bg-muted/20 rounded-lg">
                    <Coins className="w-8 h-8 text-primary mb-2" />
                    <h4 className="font-semibold mb-1">Dual Token System</h4>
                    <p className="text-sm text-muted-foreground">BIM & OBA tokens with unique utilities</p>
                  </div>
                  <div className="p-4 bg-muted/20 rounded-lg">
                    <TrendingUp className="w-8 h-8 text-success mb-2" />
                    <h4 className="font-semibold mb-1">50% Daily Mining</h4>
                    <p className="text-sm text-muted-foreground">Sustainable reward mechanism</p>
                  </div>
                  <div className="p-4 bg-muted/20 rounded-lg">
                    <Shield className="w-8 h-8 text-warning mb-2" />
                    <h4 className="font-semibold mb-1">TON Security</h4>
                    <p className="text-sm text-muted-foreground">Built on secure blockchain infrastructure</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Vision & Mission */}
          <section id="vision-mission">
            <Card className="enhanced-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-6 h-6 text-primary" />
                  Vision & Mission
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-neutral dark:prose-invert max-w-none">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-xl font-semibold mb-4 text-primary">Our Vision</h3>
                    <p>
                      To create the most accessible and rewarding DeFi ecosystem on TON, 
                      where every participant can earn sustainable returns through innovative 
                      mining and staking mechanisms.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-4 text-primary">Our Mission</h3>
                    <p>
                      Democratize cryptocurrency mining by providing user-friendly tools 
                      that eliminate technical barriers while maximizing earning potential 
                      for all community members.
                    </p>
                  </div>
                </div>
                
                <div className="mt-8 p-6 bg-gradient-primary/10 rounded-lg border border-primary/20">
                  <h4 className="font-semibold mb-3">Core Values</h4>
                  <ul className="space-y-2">
                    <li><strong>Transparency:</strong> All operations are verifiable on-chain</li>
                    <li><strong>Accessibility:</strong> No technical expertise required</li>
                    <li><strong>Sustainability:</strong> Long-term economic model design</li>
                    <li><strong>Community:</strong> Referral system that rewards growth</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* TON Blockchain Integration */}
          <section id="ton-blockchain">
            <Card className="enhanced-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="w-6 h-6 text-primary" />
                  TON Blockchain Integration
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-neutral dark:prose-invert max-w-none">
                <p className="text-lg mb-4">
                  Bimcoin leverages The Open Network's advanced capabilities to deliver 
                  fast, secure, and cost-effective DeFi operations.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-primary">Technical Advantages</h4>
                    <ul className="space-y-2">
                      <li>• Ultra-fast transaction processing</li>
                      <li>• Minimal gas fees</li>
                      <li>• Advanced smart contract capabilities</li>
                      <li>• Seamless wallet integration</li>
                    </ul>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-semibold text-primary">Security Features</h4>
                    <ul className="space-y-2">
                      <li>• Proof-of-Stake consensus</li>
                      <li>• Multi-signature wallets</li>
                      <li>• Automated security audits</li>
                      <li>• Decentralized governance</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Tokenomics */}
          <section id="tokenomics">
            <Card className="enhanced-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="w-6 h-6 text-primary" />
                  Tokenomics
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-neutral dark:prose-invert max-w-none">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="p-6 bg-primary/5 rounded-lg border border-primary/20">
                    <h3 className="text-xl font-semibold mb-4 text-primary">BIM Token</h3>
                    <ul className="space-y-2">
                      <li><strong>Purpose:</strong> Primary ecosystem token</li>
                      <li><strong>Utility:</strong> Staking, governance, payments</li>
                      <li><strong>Minting:</strong> Through TON deposits</li>
                      <li><strong>Burning:</strong> Deflationary mechanism</li>
                    </ul>
                  </div>
                  <div className="p-6 bg-secondary/5 rounded-lg border border-secondary/20">
                    <h3 className="text-xl font-semibold mb-4 text-secondary">OBA Token</h3>
                    <ul className="space-y-2">
                      <li><strong>Purpose:</strong> Mining reward token</li>
                      <li><strong>Utility:</strong> Trading, burning for benefits</li>
                      <li><strong>Generation:</strong> Daily mining rewards</li>
                      <li><strong>Rate:</strong> 50% daily on BIM holdings</li>
                    </ul>
                  </div>
                </div>
                
                <div className="p-6 bg-muted/20 rounded-lg">
                  <h4 className="font-semibold mb-4">Economic Model</h4>
                  <p className="mb-4">
                    Our tokenomics create a sustainable ecosystem where value flows 
                    between tokens based on user participation and market dynamics.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">1:1</div>
                      <div className="text-sm text-muted-foreground">TON to BIM ratio</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-success">50%</div>
                      <div className="text-sm text-muted-foreground">Daily OBA mining</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-warning">3%</div>
                      <div className="text-sm text-muted-foreground">Task bonus OBA</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Mining Mechanism */}
          <section id="mining-mechanism">
            <Card className="enhanced-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-primary" />
                  Mining Mechanism
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-neutral dark:prose-invert max-w-none">
                <p className="text-lg mb-6">
                  Our innovative mining system allows users to earn OBA tokens 
                  simply by holding BIM tokens in their connected wallet.
                </p>
                
                <div className="space-y-6">
                  <div className="p-6 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border">
                    <h4 className="font-semibold mb-3">How Mining Works</h4>
                    <ol className="space-y-3">
                      <li><strong>1. Deposit TON:</strong> Convert TON to BIM tokens at 1:1 ratio</li>
                      <li><strong>2. Hold BIM:</strong> Keep BIM tokens in your connected wallet</li>
                      <li><strong>3. Earn OBA:</strong> Receive 50% of your BIM balance as OBA daily</li>
                      <li><strong>4. Claim Rewards:</strong> Collect your OBA tokens anytime</li>
                    </ol>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-muted/20 rounded-lg">
                      <h5 className="font-semibold mb-2">Mining Benefits</h5>
                      <ul className="space-y-1 text-sm">
                        <li>• No energy consumption</li>
                        <li>• No hardware requirements</li>
                        <li>• Automatic reward calculation</li>
                        <li>• Instant claiming</li>
                      </ul>
                    </div>
                    <div className="p-4 bg-muted/20 rounded-lg">
                      <h5 className="font-semibold mb-2">Optimization Tips</h5>
                      <ul className="space-y-1 text-sm">
                        <li>• Complete daily tasks for bonus</li>
                        <li>• Refer friends for additional rewards</li>
                        <li>• Strategic burning for multipliers</li>
                        <li>• Long-term holding benefits</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Earning Opportunities */}
          <section id="earning-opportunities">
            <Card className="enhanced-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-6 h-6 text-primary" />
                  Earning Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-neutral dark:prose-invert max-w-none">
                <p className="text-lg mb-6">
                  Bimcoin offers multiple revenue streams to maximize your earning potential 
                  within our ecosystem.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="p-6 bg-primary/5 rounded-lg border border-primary/20">
                    <TrendingUp className="w-8 h-8 text-primary mb-3" />
                    <h4 className="font-semibold mb-2">Daily Mining</h4>
                    <p className="text-sm mb-3">Earn 50% of your BIM balance in OBA tokens daily</p>
                    <Badge variant="secondary">Primary Income</Badge>
                  </div>
                  
                  <div className="p-6 bg-secondary/5 rounded-lg border border-secondary/20">
                    <Star className="w-8 h-8 text-secondary mb-3" />
                    <h4 className="font-semibold mb-2">Task Rewards</h4>
                    <p className="text-sm mb-3">Complete daily tasks to earn 3% bonus OBA</p>
                    <Badge variant="outline">Daily Bonus</Badge>
                  </div>
                  
                  <div className="p-6 bg-success/5 rounded-lg border border-success/20">
                    <Users className="w-8 h-8 text-success mb-3" />
                    <h4 className="font-semibold mb-2">Referral Program</h4>
                    <p className="text-sm mb-3">Earn from friends' activities and grow the network</p>
                    <Badge variant="outline">Network Effect</Badge>
                  </div>
                </div>
                
                <div className="mt-8 p-6 bg-gradient-to-r from-warning/10 to-success/10 rounded-lg border">
                  <h4 className="font-semibold mb-3">Advanced Strategies</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium mb-2">Token Burning</h5>
                      <p className="text-sm text-muted-foreground">
                        Burn OBA or BIM tokens to potentially increase mining rates 
                        and contribute to deflationary pressure.
                      </p>
                    </div>
                    <div>
                      <h5 className="font-medium mb-2">Compound Growth</h5>
                      <p className="text-sm text-muted-foreground">
                        Reinvest earned OBA into more BIM tokens to increase 
                        your daily mining capacity exponentially.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Getting Started Guide */}
          <section id="getting-started">
            <Card className="enhanced-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-6 h-6 text-primary" />
                  Getting Started Guide
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-neutral dark:prose-invert max-w-none">
                <p className="text-lg mb-6">
                  Follow this step-by-step guide to begin your Bimcoin journey 
                  and start earning rewards immediately.
                </p>
                
                <div className="space-y-6">
                  <div className="p-6 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border">
                    <h4 className="font-semibold mb-4">Step-by-Step Setup</h4>
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-sm font-semibold text-primary-foreground">1</div>
                        <div>
                          <h5 className="font-medium">Install TON Wallet</h5>
                          <p className="text-sm text-muted-foreground">Download and set up a TON-compatible wallet (Tonkeeper, TonHub, etc.)</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-sm font-semibold text-primary-foreground">2</div>
                        <div>
                          <h5 className="font-medium">Fund Your Wallet</h5>
                          <p className="text-sm text-muted-foreground">Add TON tokens to your wallet for deposits and transaction fees</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-sm font-semibold text-primary-foreground">3</div>
                        <div>
                          <h5 className="font-medium">Connect to Bimcoin</h5>
                          <p className="text-sm text-muted-foreground">Visit our platform and connect your wallet using TonConnect</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-sm font-semibold text-primary-foreground">4</div>
                        <div>
                          <h5 className="font-medium">Make Your First Deposit</h5>
                          <p className="text-sm text-muted-foreground">Deposit TON tokens to mint BIM and start earning OBA</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-success rounded-full flex items-center justify-center text-sm font-semibold text-primary-foreground">5</div>
                        <div>
                          <h5 className="font-medium">Start Mining</h5>
                          <p className="text-sm text-muted-foreground">Your mining begins automatically - check back daily to claim rewards</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-muted/20 rounded-lg">
                      <h5 className="font-semibold mb-2">Supported Wallets</h5>
                      <ul className="space-y-1 text-sm">
                        <li>• Tonkeeper (Recommended)</li>
                        <li>• TonHub</li>
                        <li>• OpenMask</li>
                        <li>• MyTonWallet</li>
                      </ul>
                    </div>
                    <div className="p-4 bg-muted/20 rounded-lg">
                      <h5 className="font-semibold mb-2">Best Practices</h5>
                      <ul className="space-y-1 text-sm">
                        <li>• Keep private keys secure</li>
                        <li>• Start with small deposits</li>
                        <li>• Check daily for optimal returns</li>
                        <li>• Join our community channels</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Roadmap */}
          <section id="roadmap">
            <Card className="enhanced-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="w-6 h-6 text-primary" />
                  Roadmap
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-neutral dark:prose-invert max-w-none">
                <p className="text-lg mb-6">
                  Our development roadmap outlines the exciting features and 
                  improvements coming to the Bimcoin ecosystem.
                </p>
                
                <div className="space-y-8">
                  <div className="relative pl-8 border-l-2 border-success">
                    <div className="absolute -left-2 top-0 w-4 h-4 bg-success rounded-full"></div>
                    <div className="mb-4">
                      <Badge className="mb-2" variant="default">Q4 2024 - Completed</Badge>
                      <h4 className="font-semibold text-lg">Platform Launch</h4>
                    </div>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>✓ Core mining mechanism</li>
                      <li>✓ TON wallet integration</li>
                      <li>✓ Basic task system</li>
                      <li>✓ Referral program</li>
                    </ul>
                  </div>
                  
                  <div className="relative pl-8 border-l-2 border-primary">
                    <div className="absolute -left-2 top-0 w-4 h-4 bg-primary rounded-full"></div>
                    <div className="mb-4">
                      <Badge className="mb-2" variant="secondary">Q1 2025 - In Progress</Badge>
                      <h4 className="font-semibold text-lg">Enhanced Features</h4>
                    </div>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Advanced analytics dashboard</li>
                      <li>• Mobile app development</li>
                      <li>• Governance system</li>
                      <li>• NFT integration</li>
                    </ul>
                  </div>
                  
                  <div className="relative pl-8 border-l-2 border-muted">
                    <div className="absolute -left-2 top-0 w-4 h-4 bg-muted rounded-full"></div>
                    <div className="mb-4">
                      <Badge className="mb-2" variant="outline">Q2 2025 - Planned</Badge>
                      <h4 className="font-semibold text-lg">Ecosystem Expansion</h4>
                    </div>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Cross-chain bridge</li>
                      <li>• DeFi yield farming</li>
                      <li>• Marketplace integration</li>
                      <li>• Partnership launches</li>
                    </ul>
                  </div>
                  
                  <div className="relative pl-8 border-l-2 border-muted">
                    <div className="absolute -left-2 top-0 w-4 h-4 bg-muted rounded-full"></div>
                    <div className="mb-4">
                      <Badge className="mb-2" variant="outline">Q3 2025 - Future</Badge>
                      <h4 className="font-semibold text-lg">Advanced DeFi</h4>
                    </div>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Algorithmic stablecoins</li>
                      <li>• Lending protocols</li>
                      <li>• Insurance products</li>
                      <li>• DAO governance</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to App
              </Button>
            </Link>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2024 Bimcoin. Built on The Open Network (TON)
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Whitepaper;