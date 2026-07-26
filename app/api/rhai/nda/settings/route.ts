import { NextRequest } from 'next/server';
import { adminBucket } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import { loadNdaSettings, saveNdaSettings } from '@/lib/rhai/nda';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024; // 2MB

// Signatures are stored under this prefix; the extension follows the actual
// image type so a JPEG isn't misnamed .png. The exact path is saved into
// settings.signaturePath and is what the PDF builder loads.
const SIGNATURE_PREFIX = 'rhaiPrivate/signature';

function jsonError(message: string, status: number) {
  return Response.json({ ok: false, error: message }, { status });
}

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const settings = await loadNdaSettings();
  return Response.json({
    ok: true,
    address: settings.address ?? '',
    hasSignature: !!settings.signaturePath
  });
}

function detectImage(buf: Buffer, mime: string): 'image/png' | 'image/jpeg' | null {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  // Fall back to the declared mime if the magic bytes are inconclusive.
  if (mime === 'image/png') return 'image/png';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'image/jpeg';
  return null;
}

/**
 * Save NDA settings: {address?} and/or a signature image (PNG or JPEG) as a
 * multipart `signature` file or a JSON `signatureBase64` data-URL. Returns
 * a clear JSON error at whichever step fails — never a silent 500.
 */
export async function POST(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  let address: string | undefined;
  let imageBuf: Buffer | null = null;
  let declaredMime = 'image/png';

  const contentType = req.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const addr = form.get('address');
      if (typeof addr === 'string') address = addr;
      const file = form.get('signature');
      if (file instanceof File && file.size > 0) {
        if (file.size > MAX_SIGNATURE_BYTES) return jsonError('Signature image is over 2MB — please use a smaller file.', 413);
        imageBuf = Buffer.from(await file.arrayBuffer());
        declaredMime = file.type || 'image/png';
      }
    } else {
      const payload = (await req.json()) as { address?: string; signatureBase64?: string } | null;
      if (typeof payload?.address === 'string') address = payload.address;
      if (payload?.signatureBase64) {
        const m = /^data:(image\/(?:png|jpe?g));base64,(.+)$/i.exec(payload.signatureBase64);
        const b64 = m ? m[2] : payload.signatureBase64;
        if (m) declaredMime = m[1].toLowerCase();
        imageBuf = Buffer.from(b64, 'base64');
        if (imageBuf.length > MAX_SIGNATURE_BYTES) return jsonError('Signature image is over 2MB — please use a smaller file.', 413);
      }
    }
  } catch {
    return jsonError('Could not read the upload — please try selecting the file again.', 400);
  }

  if (address === undefined && !imageBuf) {
    return jsonError('Nothing to save — add an address or choose a signature image.', 400);
  }

  let savedSignaturePath: string | undefined;
  if (imageBuf) {
    const kind = detectImage(imageBuf, declaredMime);
    if (!kind) {
      return jsonError('That file isn’t a PNG or JPEG. Export your signature as a PNG or JPG and try again.', 400);
    }
    const path = `${SIGNATURE_PREFIX}.${kind === 'image/jpeg' ? 'jpg' : 'png'}`;
    try {
      await adminBucket().file(path).save(imageBuf, { contentType: kind, resumable: false });
      savedSignaturePath = path;
    } catch (e) {
      return jsonError(
        `Couldn’t save the signature image to storage: ${e instanceof Error ? e.message : 'unknown error'}`,
        502
      );
    }
  }

  try {
    await saveNdaSettings({
      ...(address !== undefined ? { address: address.trim() } : {}),
      ...(savedSignaturePath ? { signaturePath: savedSignaturePath } : {})
    });
  } catch (e) {
    return jsonError(
      `Couldn’t save your settings: ${e instanceof Error ? e.message : 'unknown error'}`,
      502
    );
  }

  const settings = await loadNdaSettings();
  const savedWhat = [
    address !== undefined ? 'address' : null,
    savedSignaturePath ? 'signature' : null
  ].filter(Boolean);
  return Response.json({
    ok: true,
    saved: savedWhat,
    address: settings.address ?? '',
    hasSignature: !!settings.signaturePath
  });
}
