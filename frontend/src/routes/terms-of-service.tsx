import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "../components/logo";

function TermsOfServiceRoute() {
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
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            Last updated: November 5, 2026
          </p>
        </header>

        <div className="space-y-8 text-base leading-7 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              Using CheckUpTrack
            </h2>
            <p>
              CheckUpTrack provides tools to organize lab exams, biomarkers, and
              medication information. By using the service, you agree to these
              terms. You must be able to legally agree to them where you live and
              use the service only in compliance with applicable laws.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              Your account and information
            </h2>
            <p>
              Sign-in is provided through Google. You are responsible for keeping
              your Google account secure and for activity performed through your
              CheckUpTrack account. You are responsible for having the right to
              upload any report or other information you submit.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              Health information is not medical advice
            </h2>
            <p>
              CheckUpTrack is an organizational tool, not a medical service. Its
              extracted results, charts, and reminders may be incomplete or
              inaccurate and are not a diagnosis, treatment recommendation, or
              substitute for advice from a qualified healthcare professional.
              Always consult your clinician about your health and before making
              medical decisions. Do not use the service for emergencies.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              AI processing and third-party services
            </h2>
            <p>
              Report extraction uses AI providers that you configure. Your report
              text may be shared with those providers, including more than one
              provider if the service retries extraction. Their services are
              governed by their own terms and privacy policies. You are
              responsible for reviewing those terms and deciding whether to
              enable a provider.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              Acceptable use
            </h2>
            <p>
              Do not misuse the service, interfere with its operation, attempt
              unauthorized access, or submit content that you are not permitted
              to use. The service may be changed, suspended, or discontinued as
              needed to maintain or operate it.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              Availability and changes
            </h2>
            <p>
              The service is provided on an as-available basis. Features may
              change, and temporary interruptions or loss of availability may
              occur. These terms may also be updated; continued use after an
              update means you accept the revised terms.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              Contact
            </h2>
            <p>
              For questions about these terms, contact the operator responsible
              for your CheckUpTrack deployment using the contact information
              provided with that service.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}

export const Route = createFileRoute("/terms-of-service")({
  component: TermsOfServiceRoute,
});