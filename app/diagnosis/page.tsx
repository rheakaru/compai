import { loadOntology } from '@/lib/ontology/loader';
import { LandingClient } from '@/components/LandingClient';

// Throughline's 9-axis diagnosis tool. Was at `/`; moved here to free the
// root for the Rhai company homepage.
export const dynamic = 'force-dynamic';

export default function DiagnosisPage() {
  const { ontology } = loadOntology();
  return <LandingClient ontology={ontology} />;
}
