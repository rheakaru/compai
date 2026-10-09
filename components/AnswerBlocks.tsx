import Link from 'next/link';
import type { Answer } from '@/lib/site/answers';

// Answer blocks — a question as a heading, then a direct, self-contained answer
// an assistant can lift verbatim, then optional detail. Server-rendered plain
// HTML on purpose: answer engines read the markup, not the hydrated page.

export function answerAnchor(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
}

/** The full visible text of an answer — what the FAQPage schema must match. */
export function answerText(a: Answer): string {
  return a.points?.length ? `${a.a} ${a.points.join(' ')}` : a.a;
}

export function AnswerBlocks({ answers }: { answers: Answer[] }) {
  return (
    <div className="divide-y divide-ink-200/70">
      {answers.map(item => (
        <article key={item.q} id={answerAnchor(item.q)} className="scroll-mt-20 py-9 first:pt-0 last:pb-0">
          <h2 className="font-display text-2xl leading-snug tracking-tight text-ink-900">{item.q}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-800">{item.a}</p>
          {item.points && (
            <ul className="mt-4 space-y-2">
              {item.points.map(p => (
                <li key={p} className="flex gap-3 text-sm leading-relaxed text-ink-700">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          )}
          {item.link &&
            (item.link.href.startsWith('http') ? (
              <a
                href={item.link.href}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-sm text-accent underline-offset-4 hover:underline"
              >
                {item.link.label} ↗
              </a>
            ) : (
              <Link href={item.link.href} className="mt-4 inline-block text-sm text-accent underline-offset-4 hover:underline">
                {item.link.label} →
              </Link>
            ))}
        </article>
      ))}
    </div>
  );
}
