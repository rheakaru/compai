import { WorkshopModules } from '@/components/WorkshopModules';

export const metadata = {
  title: 'The AI Sessions — the module library — Rhai',
  description:
    'The full library of 22 tested workshop modules — foundations, frames, building, applied, and session mechanics — that every Rhai AI session is assembled from.'
};

export default function Page() {
  return <WorkshopModules />;
}
