import type { Metadata } from "next";
import { getLegalConfig } from "@/lib/legal-config";
import { LegalLayout, LegalSection } from "@/components/legal-layout";

export const metadata: Metadata = {
  title: "Terms of Service | Arfa CRM",
  description: "Terms of Service for Arfa CRM social media management platform",
};

export default function TermsPage() {
  const c = getLegalConfig();

  return (
    <LegalLayout title="Terms of Service">
      <p className="text-white">
        Effective date: <strong>{c.effectiveDate}</strong>
      </p>
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of {c.appName} (the
        &quot;Service&quot;) operated by {c.companyName}. By creating an account or using the
        Service, you agree to these Terms. If you do not agree, do not use the Service.
      </p>

      <LegalSection title="1. Description of Service">
        <p>
          {c.appName} is a web-based CRM that allows authorized users to connect Facebook Pages,
          Instagram professional accounts, and LinkedIn profiles to publish content, view
          engagement, manage comments and messages, and run advertising workflows from a unified
          dashboard. Features may change over time as we improve the Service.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility and Accounts">
        <ul className="list-disc pl-6 space-y-2">
          <li>You must be at least 18 years old and able to form a binding contract</li>
          <li>You must provide accurate registration information and keep it up to date</li>
          <li>You are responsible for safeguarding your login credentials</li>
          <li>
            You must have authority to connect any Facebook Page, Instagram account, or LinkedIn
            profile you link to the Service
          </li>
          <li>Organization administrators may invite team members and assign permissions</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Third-Party Platform Terms">
        <p>
          Your use of Meta (Facebook/Instagram) and LinkedIn through the Service is also subject to
          each platform&apos;s terms and policies. You must comply with:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <a
              href="https://www.facebook.com/terms.php"
              className="text-[var(--primary)] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Meta Terms of Service
            </a>
          </li>
          <li>
            <a
              href="https://www.facebook.com/policies_center/"
              className="text-[var(--primary)] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Meta Community Standards and Policies
            </a>
          </li>
          <li>
            <a
              href="https://www.linkedin.com/legal/user-agreement"
              className="text-[var(--primary)] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn User Agreement
            </a>
          </li>
        </ul>
        <p>
          We are not responsible for actions taken by Meta, LinkedIn, or other third-party platforms,
          including API outages, policy changes, or account restrictions imposed by those platforms.
        </p>
      </LegalSection>

      <LegalSection title="4. Acceptable Use">
        <p>You agree not to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Use the Service for unlawful, harmful, fraudulent, or deceptive purposes</li>
          <li>Post spam, malware, hate speech, or content that violates platform policies</li>
          <li>Attempt to access accounts or data you are not authorized to access</li>
          <li>Reverse engineer, scrape, or overload the Service or connected APIs</li>
          <li>Share login credentials with unauthorized persons</li>
          <li>Misrepresent your identity or affiliation when posting on behalf of a business</li>
        </ul>
        <p>
          We may suspend or terminate access if we reasonably believe you have violated these Terms
          or applicable platform policies.
        </p>
      </LegalSection>

      <LegalSection title="5. Content and Intellectual Property">
        <p>
          You retain ownership of content you create and publish through the Service. You grant us a
          limited license to store, process, and transmit your content solely to provide the
          Service. The Service, including its software, design, and branding, is owned by{" "}
          {c.companyName} and protected by intellectual property laws.
        </p>
      </LegalSection>

      <LegalSection title="6. Privacy">
        <p>
          Our collection and use of personal information is described in our{" "}
          <a href="/privacy" className="text-[var(--primary)] hover:underline">
            Privacy Policy
          </a>
          , which is incorporated into these Terms by reference.
        </p>
      </LegalSection>

      <LegalSection title="7. Disclaimers">
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF
          ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, AND NON-INFRINGEMENT. WE DO NOT GUARANTEE UNINTERRUPTED, ERROR-FREE, OR SECURE
          OPERATION, OR THAT POSTS WILL BE DELIVERED OR REMAIN VISIBLE ON THIRD-PARTY PLATFORMS.
        </p>
      </LegalSection>

      <LegalSection title="8. Limitation of Liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, {c.companyName.toUpperCase()} AND ITS OFFICERS,
          EMPLOYEES, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM
          YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM SHALL NOT EXCEED THE AMOUNT YOU
          PAID US IN THE TWELVE (12) MONTHS BEFORE THE CLAIM, OR ONE HUNDRED U.S. DOLLARS ($100),
          WHICHEVER IS GREATER.
        </p>
      </LegalSection>

      <LegalSection title="9. Indemnification">
        <p>
          You agree to indemnify and hold harmless {c.companyName} from claims, damages, and expenses
          (including reasonable legal fees) arising from your use of the Service, your content, your
          violation of these Terms, or your violation of any third-party rights or platform policies.
        </p>
      </LegalSection>

      <LegalSection title="10. Termination">
        <p>
          You may stop using the Service at any time. We may suspend or terminate your account for
          violation of these Terms, extended inactivity, or legal requirements. Upon termination, your
          right to access the Service ends. Provisions that by nature should survive (including
          disclaimers, limitation of liability, and indemnification) will survive termination.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes to Terms">
        <p>
          We may modify these Terms at any time by posting an updated version on this page. Material
          changes will be indicated by updating the effective date. Continued use after changes
          constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection title="12. Governing Law">
        <p>
          These Terms are governed by the laws of the State of New York, United States, without
          regard to conflict-of-law principles. Disputes shall be resolved in courts located in New
          York, unless otherwise required by applicable law.
        </p>
      </LegalSection>

      <LegalSection title="13. Contact">
        <p>Questions about these Terms:</p>
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
        </ul>
      </LegalSection>
    </LegalLayout>
  );
}
