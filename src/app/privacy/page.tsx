import type { Metadata } from "next";
import { getLegalConfig } from "@/lib/legal-config";
import { LegalLayout, LegalSection } from "@/components/legal-layout";

export const metadata: Metadata = {
  title: "Privacy Policy | Arfa CRM",
  description: "Privacy Policy for Arfa CRM social media management platform",
};

export default function PrivacyPage() {
  const c = getLegalConfig();

  return (
    <LegalLayout title="Privacy Policy">
      <p className="text-white">
        Effective date: <strong>{c.effectiveDate}</strong>
      </p>
      <p>
        {c.companyName} (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates {c.appName} (the
        &quot;Service&quot;), a social media customer relationship management (CRM) application that
        helps businesses manage Facebook Pages, Instagram professional accounts, and LinkedIn
        profiles from a single dashboard. This Privacy Policy explains how we collect, use, store,
        and protect information when you use the Service.
      </p>

      <LegalSection title="1. Information We Collect">
        <p>
          <strong className="text-white">Account information.</strong> When you register, we collect
          your name, email address, password (stored as a secure hash), and role within your
          organization.
        </p>
        <p>
          <strong className="text-white">Connected platform data.</strong> When you connect third-party
          accounts, we receive and store data necessary to provide the Service, including:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong className="text-white">Meta (Facebook &amp; Instagram):</strong> Page names, Page
            IDs, profile pictures, access tokens (encrypted), posts, comments, messages, ad account
            information, and engagement metrics authorized by you during OAuth login.
          </li>
          <li>
            <strong className="text-white">LinkedIn:</strong> Profile name, email (if provided),
            person URN, access tokens (encrypted), posts you create through the Service, and
            analytics data when permitted by LinkedIn API access.
          </li>
        </ul>
        <p>
          <strong className="text-white">Content you create.</strong> Posts, comments, replies,
          scheduled content, SEO keywords, and related metadata you submit through the Service.
        </p>
        <p>
          <strong className="text-white">Technical data.</strong> Session cookies for
          authentication, server logs (IP address, browser type, timestamps), and error diagnostics
          used to maintain security and reliability.
        </p>
        <p>
          <strong className="text-white">Optional integrations.</strong> If enabled, we may process
          data through OpenAI (AI content suggestions), Google Sheets, or Notion solely to provide
          features you configure. We do not sell your data to third parties.
        </p>
      </LegalSection>

      <LegalSection title="2. How We Use Your Information">
        <ul className="list-disc pl-6 space-y-2">
          <li>Authenticate you and provide access to the Service</li>
          <li>Publish, schedule, and manage posts on your connected social accounts</li>
          <li>Sync and display comments, messages, ads, and activity from connected platforms</li>
          <li>Enable team members to collaborate with permission-based access</li>
          <li>Improve security, prevent fraud, and troubleshoot technical issues</li>
          <li>Comply with legal obligations and enforce our Terms of Service</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Legal Basis and Platform Permissions">
        <p>
          We access Meta and LinkedIn data only after you explicitly authorize our application
          through each platform&apos;s OAuth consent screen. You can revoke access at any time
          through Meta Account Settings, LinkedIn Settings, or by disconnecting accounts within{" "}
          {c.appName}. We request only permissions required for features you use, such as posting
          content, reading comments, managing messages, and viewing insights.
        </p>
        <p>
          Our use of Meta Platform data complies with the{" "}
          <a
            href="https://developers.facebook.com/terms/"
            className="text-[var(--primary)] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Meta Platform Terms
          </a>{" "}
          and{" "}
          <a
            href="https://developers.facebook.com/devpolicy/"
            className="text-[var(--primary)] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Meta Developer Policies
          </a>
          . Our use of LinkedIn data complies with the{" "}
          <a
            href="https://www.linkedin.com/legal/api-terms-of-use"
            className="text-[var(--primary)] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn API Terms of Use
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="4. Data Storage and Security">
        <p>
          OAuth access tokens are encrypted at rest using industry-standard encryption. Passwords
          are hashed and never stored in plain text. We use secure HTTPS in production and restrict
          database access to authorized systems only. While we implement reasonable safeguards, no
          method of transmission or storage is 100% secure.
        </p>
      </LegalSection>

      <LegalSection title="5. Data Retention">
        <p>
          We retain your account and connected platform data while your account is active. When you
          disconnect a social account, we remove associated tokens and stop syncing new data.
          Cached posts, comments, and messages may remain until you request deletion or delete your
          account. See our{" "}
          <a href="/data-deletion" className="text-[var(--primary)] hover:underline">
            Data Deletion Instructions
          </a>{" "}
          for details.
        </p>
      </LegalSection>

      <LegalSection title="6. Sharing and Disclosure">
        <p>We do not sell, rent, or trade your personal information. We may share data only:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            With service providers that host our infrastructure, subject to confidentiality
            obligations
          </li>
          <li>
            With Meta, LinkedIn, and other platforms you connect, as required to perform actions you
            request
          </li>
          <li>When required by law, court order, or to protect rights, safety, and security</li>
          <li>With your explicit consent</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Your Rights and Choices">
        <ul className="list-disc pl-6 space-y-2">
          <li>Access and update your account information within the Service</li>
          <li>Disconnect Meta or LinkedIn accounts at any time from the Accounts page</li>
          <li>Request deletion of your data by contacting us (see Section 10)</li>
          <li>Revoke platform permissions through Meta or LinkedIn account settings</li>
        </ul>
        <p>
          If you are in the European Economic Area, United Kingdom, or California, you may have
          additional rights under GDPR or CCPA, including the right to access, correct, delete, or
          port your data. Contact us to exercise these rights.
        </p>
      </LegalSection>

      <LegalSection title="8. Children&apos;s Privacy">
        <p>
          The Service is not intended for users under 18 years of age. We do not knowingly collect
          information from children. If you believe a child has provided us data, contact us and we
          will delete it promptly.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. We will post the revised policy on
          this page and update the effective date. Continued use of the Service after changes
          constitutes acceptance of the updated policy.
        </p>
      </LegalSection>

      <LegalSection title="10. Contact Us">
        <p>
          For privacy questions, data access requests, or deletion requests, contact:
        </p>
        <ul className="list-none space-y-1">
          <li>
            <strong className="text-white">{c.companyName}</strong>
          </li>
          <li>Contact: {c.contactName}</li>
          <li>
            Email:{" "}
            <a href={`mailto:${c.contactEmail}`} className="text-[var(--primary)] hover:underline">
              {c.contactEmail}
            </a>
          </li>
          {c.contactPhone && <li>Phone: {c.contactPhone}</li>}
          <li>
            Website:{" "}
            <a href={c.appUrl} className="text-[var(--primary)] hover:underline">
              {c.appUrl}
            </a>
          </li>
        </ul>
      </LegalSection>
    </LegalLayout>
  );
}
