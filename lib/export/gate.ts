import type { ExportGateLevel, Ontology } from '@/lib/ontology/types';

export interface CompanyExportState {
  hasAxes: boolean;
  hasProjects: boolean;
  hasSessionPlan: boolean;
}

export function resolveExportGateLevel(ontology: Ontology): ExportGateLevel {
  const lvl = ontology.context_graph_export?.gate.export_gate_level;
  if (lvl === 'profile_edit' || lvl === 'five_projects' || lvl === 'session_plan') {
    return lvl;
  }
  return 'session_plan';
}

export function exportGateOpen(
  state: CompanyExportState,
  level: ExportGateLevel
): boolean {
  switch (level) {
    case 'profile_edit':
      return state.hasAxes;
    case 'five_projects':
      return state.hasProjects;
    case 'session_plan':
      return state.hasSessionPlan;
  }
}

export function describeExportGate(level: ExportGateLevel): string {
  switch (level) {
    case 'profile_edit':
      return 'available once the diagnosis is in';
    case 'five_projects':
      return 'available after you have generated the 5 AI projects';
    case 'session_plan':
      return 'available after the session plan';
  }
}
