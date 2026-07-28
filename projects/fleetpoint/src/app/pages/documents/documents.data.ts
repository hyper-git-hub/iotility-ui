export type DocumentCategory = 'vehicle' | 'driver' | 'company';
export type DocumentStatus = 'valid' | 'expiring' | 'expired' | 'missing';

export interface FleetDocument {
  id: string;
  name: string;
  fileName: string;
  fileSize: string;
  category: DocumentCategory;
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

export const FLEET_DOCUMENTS: FleetDocument[] = [
  { id:'DOC-001',name:'MOT Certificate',fileName:'LP-7734-MOT.pdf',fileSize:'482 KB',category:'vehicle',linkedTo:'LP-7734',issuedBy:'DVSA',issueDate:'12 Aug 2025',expiryDate:'11 Aug 2026',daysUntilExpiry:14,status:'expiring',documentNumber:'MOT-883104',uploadedBy:'Mona Lisa' },
  { id:'DOC-002',name:'Vehicle Insurance',fileName:'LP-4821-insurance.pdf',fileSize:'1.2 MB',category:'vehicle',linkedTo:'LP-4821',issuedBy:'Aviva Fleet',issueDate:'01 Jun 2025',expiryDate:'31 May 2026',daysUntilExpiry:-58,status:'expired',documentNumber:'AV-FLT-9013',uploadedBy:'Mona Lisa',notes:'Renewed certificate is awaiting approval.' },
  { id:'DOC-003',name:'Road Tax',fileName:'road-tax-LP9901.pdf',fileSize:'305 KB',category:'vehicle',linkedTo:'LP-9901',issuedBy:'DVLA',issueDate:'19 Jan 2026',expiryDate:'18 Jan 2027',daysUntilExpiry:174,status:'valid',documentNumber:'RT-299114',uploadedBy:'Sarah Khan' },
  { id:'DOC-004',name:'Driving Licence',fileName:'mohammed-licence.jpg',fileSize:'860 KB',category:'driver',linkedTo:'Mohammed Al-Rashid',issuedBy:'DVLA',issueDate:'04 Mar 2024',expiryDate:'03 Mar 2029',daysUntilExpiry:1679,status:'valid',documentNumber:'ALRASH90304MA9AA',uploadedBy:'Mona Lisa' },
  { id:'DOC-005',name:'CPC Card',fileName:'james-cpc.pdf',fileSize:'520 KB',category:'driver',linkedTo:'James Wilson',issuedBy:'DVSA',issueDate:'28 Jul 2021',expiryDate:'27 Jul 2026',daysUntilExpiry:-1,status:'expired',documentNumber:'CPC-77120',uploadedBy:'Sarah Khan' },
  { id:'DOC-006',name:'Medical Certificate',fileName:'aisha-medical.pdf',fileSize:'740 KB',category:'driver',linkedTo:'Aisha Khan',issuedBy:'Fleet Medical UK',issueDate:'11 Apr 2026',expiryDate:'10 Apr 2027',daysUntilExpiry:256,status:'valid',documentNumber:'FM-22018',uploadedBy:'Mona Lisa' },
  { id:'DOC-007',name:'Operator Licence',fileName:'operator-licence.pdf',fileSize:'1.8 MB',category:'company',linkedTo:'LogisticsPro',issuedBy:'Traffic Commissioner',issueDate:'01 Jan 2024',expiryDate:'31 Dec 2028',daysUntilExpiry:1252,status:'valid',documentNumber:'OB2028991',uploadedBy:'Mona Lisa' },
  { id:'DOC-008',name:'Fleet Insurance Policy',fileName:'fleet-policy-2026.pdf',fileSize:'2.4 MB',category:'company',linkedTo:'LogisticsPro',issuedBy:'Zurich',issueDate:'01 Sep 2025',expiryDate:'31 Aug 2026',daysUntilExpiry:34,status:'expiring',documentNumber:'ZUR-FP-6621',uploadedBy:'Mona Lisa' },
  { id:'DOC-009',name:'FORS Certificate',fileName:'fors-silver.pdf',fileSize:'612 KB',category:'company',linkedTo:'LogisticsPro',issuedBy:'FORS',issueDate:'16 Feb 2026',expiryDate:'15 Feb 2027',daysUntilExpiry:202,status:'valid',documentNumber:'FORS-11920',uploadedBy:'Sarah Khan' },
  { id:'DOC-010',name:'Tachograph Calibration',fileName:'LP-3312-tacho.pdf',fileSize:'390 KB',category:'vehicle',linkedTo:'LP-3312',issuedBy:'TachoTech',issueDate:'02 Nov 2024',expiryDate:'01 Nov 2026',daysUntilExpiry:95,status:'valid',documentNumber:'TC-80332',uploadedBy:'Mona Lisa' },
];

