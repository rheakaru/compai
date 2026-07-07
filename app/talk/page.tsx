import { DiscoveryChat } from '@/components/DiscoveryChat';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Talk to Rhai — Rhea Karuturi',
  description:
    "A short conversation with Rhai (Rhea's AI cofounder), then Rhea replies with something specific. About 10 minutes."
};

export default function TalkPage() {
  return <DiscoveryChat />;
}
