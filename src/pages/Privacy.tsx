import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Link to="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="prose prose-lg max-w-none text-foreground">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
            <p className="mb-4">
              Bimcoin is a decentralized application. We collect minimal information necessary to provide our services:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Wallet addresses for transaction processing</li>
              <li>Transaction data on the TON blockchain</li>
              <li>Usage analytics to improve our service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. How We Use Information</h2>
            <p className="mb-4">
              The information we collect is used to:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Process your transactions and maintain your account balance</li>
              <li>Provide customer support</li>
              <li>Improve our platform and user experience</li>
              <li>Ensure compliance with applicable regulations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Data Storage and Security</h2>
            <p className="mb-4">
              We implement appropriate security measures to protect your information. However, as transactions occur on a public blockchain, transaction data is inherently public and immutable.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Third-Party Services</h2>
            <p className="mb-4">
              Our platform may integrate with third-party services such as:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>TON Network and blockchain explorers</li>
              <li>Wallet providers</li>
              <li>Analytics services</li>
            </ul>
            <p className="mb-4">
              These services have their own privacy policies that govern their use of your information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Your Rights</h2>
            <p className="mb-4">
              You have the right to:
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Access information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your data (where legally possible)</li>
              <li>Withdraw consent for data processing</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Cookies and Tracking</h2>
            <p className="mb-4">
              We may use cookies and similar technologies to enhance your user experience and analyze platform usage. You can control cookie preferences through your browser settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Changes to Privacy Policy</h2>
            <p className="mb-4">
              We may update this Privacy Policy from time to time. We will notify users of any significant changes through our platform or official channels.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Contact Us</h2>
            <p className="mb-4">
              If you have any questions about this Privacy Policy or our data practices, please contact us through our official channels.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;