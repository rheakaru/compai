export type Suite = 'google_workspace' | 'microsoft_365' | 'zoho' | 'other' | 'none';

export interface CompanyStack {
  erp: string;            // free text, may be "none"
  accounting: string;     // free text, may be "none"
  suite: Suite;
  suiteOther: string;     // if suite==='other'
  notes: string;          // anything else core
  extraDetail: string;    // a few sentences asked at Gate 2
  submittedAt: number;
  // Added per the connector_map patch — captured on the diagnosis surface,
  // alongside the free-text "your context" input. Feeds the one-liner, hot
  // list, 5-projects, and connector map.
  meetings?: string;        // Zoom / Google Meet / Teams / etc.
  transcriber?: string;     // Fireflies / Otter / Granola / Read / none
  messaging?: string;       // Slack / Teams / WhatsApp / email
  operatingFiles?: string;  // the 2-3 files the company actually runs on
}
