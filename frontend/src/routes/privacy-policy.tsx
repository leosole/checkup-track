import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "../components/logo";

function PrivacyPolicyRoute() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900 dark:bg-gray-950 dark:text-gray-100 sm:px-6 sm:py-12">
      <article className="mx-auto max-w-3xl">
        <header className="mb-10 border-b border-gray-200 pb-6 dark:border-gray-800">
          <Link to="/" aria-label="CheckUpTrack home">
            <Logo className="mb-8 h-8 w-auto" />
          </Link>
          <p className="mb-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
            CheckUpTrack
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            Last updated: November 5, 2026
          </p>
        </header>

        <div className="space-y-8 text-base leading-7 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              Information we handle
            </h2>
            <p>
              CheckUpTrack stores information needed to provide your health-record
              dashboard. This may include your name and email address returned by
              Google when you sign in; lab-report PDFs you upload; report text and
              extracted exam dates and biomarkers; medications you enter; and
              third-party AI provider credentials and preferences you choose to
              save.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              How information is used
            </h2>
            <p>
              We use this information to authenticate you, convert and extract
              information from reports, maintain your exams and medication list,
              and provide search, calendar, and trend features. Google sign-in is
              used to verify your identity. CheckUpTrack does not request access
              to your Google Drive, contacts, or other Google account content.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              AI providers and other services
            </h2>
            <p>
              If you use report extraction, report text may be sent to the AI
              provider or providers configured in your account, in your selected
              order, until extraction succeeds. Supported providers include
              Gemini, Groq, OpenAI, Claude, DeepSeek, Mistral, and OpenRouter.
              These providers process information under their own terms and
              privacy policies. Do not upload a report unless you are comfortable
              with this processing.
            </p>
            <p className="mt-3">
              The service also relies on its hosting, database, and file-storage
              providers to operate. Provider API keys saved in CheckUpTrack are
              encrypted in the database, but the service operator can decrypt
              them to make provider requests. Google receives authentication
              requests as part of Google sign-in.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              Storage, security, and retention
            </h2>
            <p>
              Information is stored by the service for as long as needed to
              provide your account and its features. The service uses
              authentication controls and encrypts saved AI provider credentials.
              No online service can guarantee absolute security, so use a
              trusted device and protect your Google account.
            </p>
            <p className="mt-3">
              You can delete individual exams, medications, and saved provider
              credentials where those controls are available. There is no
              self-service account deletion feature at this time. To request
              deletion of your account and associated information, contact the
              operator of the CheckUpTrack deployment you use.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              Your choices and this policy
            </h2>
            <p>
              You choose whether to sign in, upload reports, save provider
              credentials, or use AI extraction. You can remove saved credentials
              and delete records using the available account controls. The
              operator may update this policy when the service or its data
              practices change; the current version will be published at this
              address.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              Contact
            </h2>
            <p>
              For privacy questions or data-deletion requests, contact the
              operator through GitHub at{" "}
              <a
                href="https://github.com/leosole"
                className="font-medium text-brand-700 underline dark:text-brand-300"
              >
                @leosole
              </a>
              . Please do not share health information in public posts or issues.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPolicyRoute,
});