import { HttpErrorResponse } from '@angular/common/http';

export type ExportFormat = 'xls' | 'pdf';

/** "Work Orders" → "work-orders-2026-11-02" (the extension is added from the response). */
export function exportFileName(base: string, date = new Date()): string {
  const slug =
    base
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'export';
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `${slug}-${day}`;
}

/**
 * Saves an export response as "<fileName>.<ext>". The extension follows what the server actually sent
 * (legacy endpoints return .xls, newer ones .xlsx), so Excel doesn't warn about a mismatched format.
 * The export endpoints answer errors with a JSON body even when a blob was requested; that is read and
 * thrown as an Error carrying the server's message.
 */
export async function saveExportBlob(blob: Blob, fileName: string, format: ExportFormat): Promise<void> {
  if (blob.type.includes('json')) throw new Error(await messageFromBlob(blob));
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.${extension(blob.type, format)}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** A readable message from a failed export request (blob or JSON error body). */
export async function exportErrorMessage(error: unknown): Promise<string> {
  if (error instanceof HttpErrorResponse) {
    if (error.error instanceof Blob) return messageFromBlob(error.error);
    return error.error?.message || error.statusText || FALLBACK;
  }
  return error instanceof Error && error.message ? error.message : FALLBACK;
}

const FALLBACK = 'The file could not be exported. Please try again.';

function extension(type: string, format: ExportFormat): string {
  if (format === 'pdf' || type.includes('pdf')) return 'pdf';
  if (type.includes('openxmlformats') || type.includes('sheet')) return 'xlsx';
  if (type.includes('csv')) return 'csv';
  return 'xls';
}

async function messageFromBlob(blob: Blob): Promise<string> {
  try {
    return JSON.parse(await blob.text()).message || FALLBACK;
  } catch {
    return FALLBACK;
  }
}
