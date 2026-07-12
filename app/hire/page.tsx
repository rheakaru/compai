import { HireHome } from '@/components/HireHome';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Rhai Interviews — AI-run first-round interviews',
  description:
    'Upload a job description, co-design a structured interview with Rhai, share one link, and get every applicant interviewed and ranked for fit. First job free.'
};

export default function HirePage() {
  return <HireHome />;
}
