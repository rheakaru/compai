export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Privacy Policy — Rhai',
  description: 'How Rhai collects, uses, and protects your information.'
};

const CONTACT_EMAIL = 'rhea@rosebazaar.in';
const UPDATED = '9 July 2026';

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-2 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">Privacy Policy</h1>
      <p className="mt-2 text-xs text-ink-400">Last updated {UPDATED}</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-ink-700">
        <p>
          Rhai is the AI consulting practice of Rhea Karuturi (&ldquo;Rhai,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;).
          This policy explains what information we collect when you talk to Rhai — on our website, over WhatsApp, or
          through our free tools — and how we use and protect it. We keep this deliberately plain.
        </p>

        <Section title="Information we collect">
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              <strong>Contact details you give us</strong> — your name, email, phone number, and company, when you
              start a conversation with Rhai, submit an interview, or reach out.
            </li>
            <li>
              <strong>Conversation content</strong> — the messages you send us, including any voice notes (which may be
              transcribed to text) and chats with our Rhai assistant on the website or WhatsApp.
            </li>
            <li>
              <strong>Free-tool inputs</strong> — if you use our free brand-ontology tool, the brand information you
              enter and the email of the Google account you sign in with.
            </li>
            <li>
              <strong>Basic technical data</strong> — standard information your browser or device sends (such as
              approximate device/browser type), used to run and secure the service.
            </li>
          </ul>
        </Section>

        <Section title="How we use it">
          <ul className="ml-5 list-disc space-y-1.5">
            <li>To respond to you, understand what you need, and follow up about working together.</li>
            <li>To provide, maintain, and improve our services and tools.</li>
            <li>To keep the service secure and prevent abuse.</li>
          </ul>
          <p className="mt-2">
            We do <strong>not</strong> sell your personal information, and we do not use it for third-party advertising.
          </p>
        </Section>

        <Section title="AI processing">
          <p>
            To generate responses, your messages are processed by third-party AI models (Anthropic&apos;s Claude). Voice
            notes may be transcribed by a third-party speech-to-text provider (ElevenLabs). These providers process the
            content to deliver the feature and under their own terms.
          </p>
        </Section>

        <Section title="WhatsApp">
          <p>
            If you message our Rhai WhatsApp number, your messages are delivered and processed through the WhatsApp
            Business Platform (Meta). Meta&apos;s own terms and privacy policy also apply to messages sent over WhatsApp.
            We use your number only to respond to you.
          </p>
        </Section>

        <Section title="Where your data is stored & who processes it">
          <p>
            Your data is stored on Google Firebase / Google Cloud infrastructure. We rely on a small set of
            sub-processors to run the service:
          </p>
          <ul className="ml-5 mt-2 list-disc space-y-1.5">
            <li>Google (Firebase / Cloud) — hosting, database, authentication, storage</li>
            <li>Anthropic — AI model processing</li>
            <li>ElevenLabs — voice-note transcription</li>
            <li>Meta / WhatsApp — messaging, if you contact us there</li>
          </ul>
          <p className="mt-2">
            These providers may store or process data outside your country, including in the United States.
          </p>
        </Section>

        <Section title="Retention">
          <p>
            We keep your information for as long as needed to respond to you and for legitimate business purposes, and
            then delete or anonymise it. You can ask us to delete your data at any time (see below).
          </p>
        </Section>

        <Section title="Your choices & rights">
          <p>
            You can request access to, correction of, or deletion of your personal information — just email us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
              {CONTACT_EMAIL}
            </a>
            . You can also stop messaging Rhai at any time.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            We use only the minimal cookies/local storage needed to keep you signed in and run the app. We do not use
            third-party advertising or cross-site tracking cookies.
          </p>
        </Section>

        <Section title="Children">
          <p>Our services are intended for businesses and adults, and are not directed at children under 18.</p>
        </Section>

        <Section title="Changes">
          <p>
            We may update this policy from time to time. When we do, we&apos;ll change the &ldquo;last updated&rdquo;
            date above.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy or your data? Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>
      </div>

      <div className="mt-12 border-t border-ink-200/60 pt-6 text-[11px] text-ink-400">
        <a href="/" className="hover:text-ink-700">
          ← Back to Rhai
        </a>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg tracking-tight text-ink-900">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}
