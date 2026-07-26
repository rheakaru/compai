'use client';

// One-click NDA generator — type the client's legal name (optionally link a
// lead so Rhai drafts the Purpose + itemisation from discovery), hit
// Generate, get the finished PDF: Rhea's standard mutual NDA with her details
// and today's date filled in, and her scanned signature stamped as initials
// on every page and full-size in the signature block. Settings (her address +
// the signature PNG) live behind a small disclosure.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useAuthedFetch } from './useAuthedFetch';
import type { WorkshopLead } from '@/lib/leads/types';

interface NdaStatus {
  hasAddress: boolean;
  hasSignature: boolean;
  recent: {
    id: string;
    clientLegalName: string;
    filename: string;
    blanks: string[];
    signed: boolean;
    createdAt: number;
    url?: string | null;
  }[];
}

interface GenerateResult {
  url: string;
  filename: string;
  blanks: string[];
  signed: boolean;
  lookedUp?: string[];
  sourceNote?: string | null;
}

const field =
  'w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-ink-400 focus:outline-none';

export function NdaGenerator() {
  const { user, getToken } = useAuth();
  const api = useAuthedFetch();

  const [status, setStatus] = useState<NdaStatus | null>(null);
  const [leads, setLeads] = useState<WorkshopLead[] | null>(null);
  const [clientName, setClientName] = useState('');
  const [leadId, setLeadId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await api('/api/rhai/nda');
    if (res.ok) setStatus((await res.json()) as NdaStatus);
  }, [api]);

  useEffect(() => {
    if (!user) return;
    load().catch(() => undefined);
    (async () => {
      const res = await api('/api/leads');
      if (res.ok) setLeads(((await res.json()) as { leads: WorkshopLead[] }).leads);
    })().catch(() => undefined);
  }, [user, api, load]);

  const pickLead = (id: string) => {
    setLeadId(id);
    const lead = leads?.find(l => l.id === id);
    if (lead && !clientName.trim()) setClientName(lead.company || '');
  };

  const generate = async () => {
    if (!clientName.trim()) return;
    setGenerating(true);
    setErr(null);
    setResult(null);
    try {
      const res = await api('/api/rhai/nda', {
        method: 'POST',
        body: JSON.stringify({ clientLegalName: clientName.trim(), leadId: leadId || undefined })
      });
      if (!res.ok) throw new Error(await res.text());
      setResult((await res.json()) as GenerateResult);
      load().catch(() => undefined);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          One-click NDA
        </p>
        {status && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              status.hasSignature ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
            }`}
          >
            {status.hasSignature ? 'signature on file ✓' : 'no signature yet'}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink-500">
        Rhea’s standard mutual NDA (DPDP clause, background-IP protection, Bengaluru jurisdiction)
        with her details, today’s date, and her scanned signature stamped on every page. Link a
        lead and Rhai writes the Purpose and the itemisation from discovery.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-ink-600">
          Client legal name *
          <input
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            placeholder="e.g. JDN Nutrition Private Limited"
            className={`${field} mt-1`}
          />
        </label>
        <label className="text-xs text-ink-600">
          From a lead (optional — pulls discovery context)
          <select value={leadId} onChange={e => pickLead(e.target.value)} className={`${field} mt-1`}>
            <option value="">— not linked —</option>
            {(leads ?? []).map(l => (
              <option key={l.id} value={l.id}>
                {[l.person, l.company].filter(Boolean).join(' · ') || '(unnamed lead)'}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={generating || !clientName.trim()}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {generating ? 'Drafting & signing…' : 'Generate NDA'}
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen(o => !o)}
          className="rounded-md border border-ink-200 px-3 py-2 text-xs text-ink-600 hover:bg-ink-50"
        >
          {settingsOpen ? 'Close settings' : 'Settings'}
        </button>
        {err && <p className="text-xs text-rose-600">{err}</p>}
      </div>

      {result && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-emerald-800 underline underline-offset-2 hover:text-emerald-900"
          >
            ↓ {result.filename}
          </a>
          <p className="mt-1 text-[11px] text-ink-500">
            {result.signed
              ? 'Signed — initials on every page, full signature in the block. Client side left blank.'
              : 'Generated WITHOUT a signature — upload one in settings, then regenerate.'}
          </p>
          {result.lookedUp && result.lookedUp.length > 0 && (
            <p className="mt-1.5 rounded bg-sky-50 px-2 py-1 text-[11px] text-sky-800">
              Looked up online — <span className="font-semibold">verify before sending:</span>{' '}
              {result.lookedUp.join(', ')}
              {result.sourceNote ? ` (${result.sourceNote})` : ''}.
            </p>
          )}
          {result.blanks.length > 0 ? (
            <div className="mt-1.5">
              <p className="text-[11px] font-semibold text-amber-800">Fill before sending:</p>
              <ul className="mt-0.5 list-disc pl-4 text-[11px] text-amber-800">
                {result.blanks.map(b => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-emerald-700">No blanks — ready to send.</p>
          )}
        </div>
      )}

      {settingsOpen && <NdaSettings getToken={getToken} api={api} onSaved={load} />}

      {status && status.recent.length > 0 && (
        <div className="mt-4 border-t border-ink-100 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Recent</p>
          <ul className="mt-1.5 space-y-1">
            {status.recent.slice(0, 6).map(n => (
              <li key={n.id} className="flex items-center justify-between gap-2 text-xs text-ink-600">
                {n.url ? (
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 truncate text-accent hover:underline"
                    title={`Download ${n.filename}`}
                  >
                    ↓ {n.filename}
                  </a>
                ) : (
                  <span className="min-w-0 truncate">{n.filename}</span>
                )}
                <span className="shrink-0 text-[10px] text-ink-400">
                  {n.signed ? 'signed' : 'unsigned'}
                  {n.blanks.length > 0 ? ` · ${n.blanks.length} blank${n.blanks.length === 1 ? '' : 's'}` : ''}
                  {' · '}
                  {new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings disclosure — address + signature PNG upload with preview.
// ---------------------------------------------------------------------------

function NdaSettings({
  getToken,
  api,
  onSaved
}: {
  getToken: () => Promise<string | null>;
  api: (p: string, i?: RequestInit) => Promise<Response>;
  onSaved: () => Promise<void>;
}) {
  const [address, setAddress] = useState('');
  const [hasSignature, setHasSignature] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      const res = await api('/api/rhai/nda/settings');
      if (res.ok) {
        const data = (await res.json()) as { address: string; hasSignature: boolean };
        setAddress(data.address);
        setHasSignature(data.hasSignature);
      }
    })().catch(() => undefined);
  }, [api]);

  const pickFile = (f: File) => {
    if (!/^image\/(png|jpe?g)$/i.test(f.type)) {
      setMsg({ tone: 'err', text: `“${f.name}” isn’t a PNG or JPG — that file is ${f.type || 'an unknown type'}.` });
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      setMsg({ tone: 'err', text: `That image is ${(f.size / 1024 / 1024).toFixed(1)}MB — the limit is 2MB.` });
      return;
    }
    setMsg({ tone: 'info', text: `“${f.name}” ready — click Save settings to upload it.` });
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setMsg({ tone: 'info', text: file ? 'Uploading signature and saving…' : 'Saving…' });
    try {
      // Multipart — DON'T set content-type; the browser adds the boundary.
      const token = await getToken();
      const fd = new FormData();
      fd.append('address', address);
      if (file) fd.append('signature', file);
      let res: Response;
      try {
        res = await fetch('/api/rhai/nda/settings', {
          method: 'POST',
          headers: token ? { authorization: `Bearer ${token}` } : {},
          body: fd
        });
      } catch {
        setMsg({ tone: 'err', text: 'Network error — couldn’t reach the server. Check your connection and try again.' });
        return;
      }

      // Read the server's message whether it's JSON or plain text.
      let payload: { ok?: boolean; error?: string; saved?: string[]; hasSignature?: boolean } = {};
      const raw = await res.text();
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = { error: raw };
      }

      if (!res.ok || payload.ok === false) {
        if (res.status === 401 || res.status === 403) {
          setMsg({ tone: 'err', text: 'Your session expired — reload the page and sign in again, then retry.' });
        } else {
          setMsg({ tone: 'err', text: `Couldn’t save (${res.status}): ${payload.error || raw || 'unknown error'}` });
        }
        return;
      }

      if (typeof payload.hasSignature === 'boolean') setHasSignature(payload.hasSignature);
      setFile(null);
      const what = payload.saved?.length ? payload.saved.join(' and ') : 'settings';
      setMsg({ tone: 'ok', text: `Saved ${what}.` });
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-md border border-ink-100 bg-cream-50/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">NDA settings</p>
      <label className="mt-2 block text-xs text-ink-600">
        Your address (goes in the parties block — the one blank in your standard paper)
        <input
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="Street, area, Bengaluru, Karnataka – PIN, India"
          className={`${field} mt-1`}
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="rounded-md border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50"
        >
          {hasSignature ? 'Replace signature image' : '↑ Upload signature (PNG or JPG)'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) pickFile(f);
          }}
        />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Signature preview" className="h-10 rounded border border-ink-200 bg-white px-2 py-1" />
        ) : hasSignature ? (
          <span className="text-[11px] font-medium text-emerald-700">signature on file ✓</span>
        ) : (
          <span className="text-[11px] text-ink-400">no signature uploaded yet</span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-600 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
      {msg && (
        <p
          role="status"
          aria-live="polite"
          className={`mt-2 rounded-md px-2.5 py-1.5 text-[11px] font-medium ${
            msg.tone === 'ok'
              ? 'bg-emerald-100 text-emerald-800'
              : msg.tone === 'err'
                ? 'bg-red-100 text-red-800'
                : 'bg-ink-100 text-ink-600'
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
