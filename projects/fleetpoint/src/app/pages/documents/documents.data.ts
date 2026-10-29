import { DocumentRecord } from '../../shared/services/documents-api.service';
import { NOT_AVAILABLE, text } from '../maintenance/maintenance.data';

export type DocumentCategory = 'vehicle' | 'driver' | 'company';
/** fms-fleet has no expiry data, so API documents are always 'unknown'. */
export type DocumentStatus = 'valid' | 'expiring' | 'expired' | 'missing' | 'unknown';

export interface FleetDocument {
  id: number;
  name: string;
  fileName: string;
  /** Full URLs of the uploaded files. */
  fileUrls: string[];
  fileSize: string;
  category: DocumentCategory | null;
  linkedTo: string;
  issuedBy: string;
  issueDate: string;
  expiryDate: string;
  daysUntilExpiry: number | null;
  status: DocumentStatus;
  documentNumber: string;
  uploadedBy: string;
  notes?: string;
}

export { NOT_AVAILABLE };

const CATEGORY_BY_TYPE: Record<string, DocumentCategory> = { D: 'driver', F: 'vehicle' };

/** Binds what GET /api/document sends; everything else is "—". */
export function toFleetDocument(record: DocumentRecord): FleetDocument {
  const fileUrls = (record.document_files ?? []).filter(Boolean);
  const names = fileUrls.map(fileName);
  return {
    id: record.id,
    name: text(record.document_type_name),
    fileName: names.length > 1 ? `${names[0]} (+${names.length - 1} more)` : (names[0] ?? NOT_AVAILABLE),
    fileUrls,
    fileSize: NOT_AVAILABLE,
    category: CATEGORY_BY_TYPE[String(record.type ?? '').toUpperCase()] ?? null,
    linkedTo: text(record.entity_name),
    issuedBy: NOT_AVAILABLE,
    issueDate: NOT_AVAILABLE,
    expiryDate: NOT_AVAILABLE,
    daysUntilExpiry: null,
    status: 'unknown',
    documentNumber: NOT_AVAILABLE,
    uploadedBy: text(record.uploaded_by_user),
  };
}

/** Last path segment of a file URL, decoded, without any query string. */
function fileName(url: string): string {
  const segment = url.split('?')[0].split('/').filter(Boolean).pop() ?? url;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
