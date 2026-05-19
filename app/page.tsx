import { loadOntology } from '@/lib/ontology/loader';
import { LandingClient } from '@/components/LandingClient';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const { ontology } = loadOntology();
  return <LandingClient ontology={ontology} />;
}
