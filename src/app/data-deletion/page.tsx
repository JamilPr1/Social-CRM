import type { Metadata } from "next";
import { getLegalConfig } from "@/lib/legal-config";
import { LegalLayout, LegalSection } from "@/components/legal-layout";

export const metadata: Metadata = {
  title: "Data Deletion Instructions | Arfa CRM",
  description: "How to request deletion of your data from Arfa CRM",
};

export default function DataDeletionPage() {
  const c = getLegalConfig();

  return (
    <LegalLayout title="Data Deletion Instructions">
      <p>
        This page explains how users of {c.appName} can request deletion of data collected through
        the Service, including data obtained from Meta (Facebook/Instagram) and LinkedIn integrations.
        This page satisfies Meta&apos;s requirement for a User Data Deletion Callback URL or
        instructions URL.
      </p>

      <LegalSection title="Option 1: Delete data inside the CRM">
        <ol className="list-decimal pl-6 space-y-2">
          <li>Sign in to {c.appName}</li>
          <li>
            Go to <strong className="text-white">Accounts</strong> and click{" "}
            <strong className="text-white">Disconnect</strong> for LinkedIn and/or reconnect Meta to
            revoke and refresh tokens
          </li>
          <li>
            Contact your organization administrator to remove your user account if you no longer
            need access
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="Option 2: Revoke access from Meta or LinkedIn">
        <p>
          <strong className="text-white">Meta (Facebook/Instagram):</strong> Visit{" "}
          <a
            href="https://www.facebook.com/settings?tab=applications"
            className="text-[var(--primary)] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Facebook Settings → Apps and Websites
          </a>
          , find <strong className="text-white">Arfa CRM</strong>, and remove the app. This revokes
          our access to your Meta data.
        </p>
        <p>
          <strong className="text-white">LinkedIn:</strong> Visit{" "}
          <a
            href="https://www.linkedin.com/psettings/permitted-services"
            className="text-[var(--primary)] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn Settings → Permitted Services
          </a>
          , find <strong className="text-white">Arfa CRM</strong>, and remove access.
        </p>
      </LegalSection>

      <LegalSection title="Option 3: Request full deletion by email">
        <p>
          To request complete deletion of all personal data we store about you, email us with the
          subject line <strong className="text-white">Data Deletion Request</strong> and include:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Your full name</li>
          <li>Email address used in {c.appName}</li>
          <li>Connected Facebook Page or LinkedIn profile name (if applicable)</li>
        </ul>
        <p>
          Email:{" "}
          <a href={`mailto:${c.contactEmail}`} className="text-[var(--primary)] hover:underline">
            {c.contactEmail}
          </a>
        </p>
        <p>
          We will confirm receipt within 5 business days and complete deletion within 30 days,
          unless we are required to retain certain data for legal or security purposes.
        </p>
      </LegalSection>

      <LegalSection title="What we delete">
        <ul className="list-disc pl-6 space-y-2">
          <li>User account profile (name, email)</li>
          <li>Encrypted OAuth tokens for Meta and LinkedIn</li>
          <li>Cached posts, comments, messages, and analytics synced to our database</li>
          <li>Scheduled posts and activity logs associated with your account</li>
        </ul>
        <p>
          Content already published to Facebook, Instagram, or LinkedIn remains on those platforms
          until you delete it directly on each platform. We cannot delete content from third-party
          platforms on your behalf after you revoke access.
        </p>
      </LegalSection>

      <LegalSection title="Automated Meta deletion callback">
        <p>
          When you remove {c.appName} from your Facebook account, Meta may send an automated
          deletion request to our callback endpoint. We process these requests and delete
          associated Meta connection data linked to your Facebook user ID.
        </p>
        <p>
          Callback URL:{" "}
          <code className="text-xs bg-[var(--card)] px-2 py-1 rounded">{c.appUrl}/api/data-deletion</code>
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          {c.companyName} — {c.contactName}
          <br />
          <a href={`mailto:${c.contactEmail}`} className="text-[var(--primary)] hover:underline">
            {c.contactEmail}
          </a>
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
