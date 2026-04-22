import { Shield } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center gap-4 border-b border-slate-700 pb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Shield size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
            <p className="text-slate-400 mt-1">Effective Date: April 22, 2026</p>
          </div>
        </div>

        <div className="space-y-6 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Introduction</h2>
            <p>
              Welcome to Drive Vault. Your privacy and the security of your data are our highest priorities. 
              This Privacy Policy explains how we collect, use, and safeguard your information when you use the Drive Vault application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Google Drive API Usage</h2>
            <p>
              Drive Vault acts as a secure file manager that interacts directly with your Google Drive account.
              Our application uses Google APIs to authenticate you and manage your files. 
            </p>
            <div className="bg-slate-800 rounded-xl p-4 mt-3 border border-slate-700">
              <h3 className="font-semibold text-blue-400 mb-2">Google API Services User Data Policy Compliance</h3>
              <p className="text-sm">
                Drive Vault's use and transfer to any other app of information received from Google APIs will adhere to the{' '}
                <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                  Google API Services User Data Policy
                </a>, including the Limited Use requirements.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. What Data We Access</h2>
            <p>When you grant Drive Vault access to your Google Drive, we access:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Your basic profile information (Email address and Name) strictly for displaying your logged-in status.</li>
              <li>Your Google Drive files and folders (to list, upload, download, and manage them within the app).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Data Storage & Security</h2>
            <p>
              <strong>We do not store your files on our servers.</strong> All files managed through Drive Vault remain securely in your personal Google Drive account. 
              Your authentication tokens are stored locally on your device and are never transmitted to any third-party databases.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Sharing of Data</h2>
            <p>
              Drive Vault does not sell, rent, or share your personal data or Google Drive files with any third parties. 
              All data transfers occur directly between your device and Google's servers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Changes to This Policy</h2>
            <p>
              We may update our Privacy Policy from time to time. Any changes will be posted on this page with an updated "Effective Date".
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Contact Us</h2>
            <p>
              If you have any questions or concerns regarding this Privacy Policy, please contact the developer directly.
            </p>
          </section>
        </div>

        <div className="pt-8 text-center text-slate-500 text-sm border-t border-slate-800">
          <a href="/" className="text-blue-400 hover:text-blue-300 transition-colors">Return to App</a>
        </div>
      </div>
    </div>
  );
}
