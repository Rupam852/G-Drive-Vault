import { Shield } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center gap-4 border-b border-slate-700 pb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Shield size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
            <p className="text-slate-400 mt-1">Effective Date: April 22, 2026</p>
          </div>
        </div>

        <div className="space-y-6 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing and using Drive Vault ("the Application"), you agree to be bound by these Terms of Service. 
              If you do not agree with any part of these terms, you must not use the Application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
            <p>
              Drive Vault provides a web and mobile interface for managing files stored in your personal Google Drive account.
              The Application requires authorization to access your Google Drive via the Google API.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. User Responsibilities</h2>
            <p>You agree to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Use the Application only for lawful purposes.</li>
              <li>Maintain the confidentiality of your Google account credentials.</li>
              <li>Accept full responsibility for any files you upload, modify, or delete using the Application.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Limitation of Liability</h2>
            <p>
              Drive Vault is provided "as is" and "as available" without any warranties of any kind. 
              We shall not be liable for any data loss, corruption of files, unauthorized access to your Google Drive, 
              or any direct or indirect damages resulting from your use of the Application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Google API Compliance</h2>
            <p>
              Our application strictly adheres to the Google API Services User Data Policy. We do not use your data for advertising,
              nor do we transfer it to any unauthorized third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Modifications to the Service</h2>
            <p>
              We reserve the right to modify, suspend, or discontinue the Application at any time without prior notice.
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
