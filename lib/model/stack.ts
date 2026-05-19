export type Suite = 'google_workspace' | 'microsoft_365' | 'zoho' | 'other' | 'none';

export interface CompanyStack {
  erp: string;            // free text, may be "none"
  accounting: string;     // free text, may be "none"
  suite: Suite;
  suiteOther: string;     // if suite==='other'
  notes: string;          // anything else core
  extraDetail: string;    // a few sentences asked at Gate 2
  submittedAt: number;
}
