import { useState } from 'react'
import { Search, Upload, Eye, Edit, Trash2, FileText, AlertTriangle, CheckCircle, Clock, X, Car, User, Building2, ChevronDown, ChevronUp, Shield, Award, Download } from 'lucide-react'
import FleetpointLayout from '../../../layouts/FleetpointLayout'
import { fleetDocuments, vehicles, drivers } from '../../../data/fleetData'
import { useTheme } from '../../../hooks/useTheme'
import type { FleetDocument, DocumentCategory, DocumentStatus, DocumentType } from '../../../data/fleetData'

const CATEGORY_CONFIG: Record<DocumentCategory, { label: string; icon: any; color: string; bg: string }> = {
  vehicle: { label: 'Vehicle',  icon: Car,       color: 'text-purple-600', bg: 'bg-purple-50' },
  driver:  { label: 'Driver',   icon: User,      color: 'text-blue-600',   bg: 'bg-blue-50' },
  company: { label: 'Company',  icon: Building2, color: 'text-teal-600',   bg: 'bg-teal-50' },
}

const STATUS_CONFIG: Record<DocumentStatus, { label: string; color: string; bg: string; border: string; icon: any }> = {
  valid:    { label: 'Valid',         color: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-200',  icon: CheckCircle },
  expiring: { label: 'Expiring Soon', color: 'text-amber-700', bg: 'bg-amber-50',  border: 'border-amber-200',  icon: Clock },
  expired:  { label: 'Expired',       color: 'text-red-700',   bg: 'bg-red-50',    border: 'border-red-200',    icon: AlertTriangle },
  missing:  { label: 'Missing',       color: 'text-gray-600',  bg: 'bg-gray-100',  border: 'border-gray-200',   icon: FileText },
}

const TYPE_LABELS: Record<DocumentType, string> = {
  'mot-certificate': 'MOT Certificate', 'vehicle-insurance': 'Vehicle Insurance',
  'road-tax': 'Road Tax', 'v5c-registration': 'V5C Registration',
  'vehicle-service-record': 'Service Record', 'tachograph-calibration': 'Tachograph Calibration',
  'goods-vehicle-test': 'Goods Vehicle Test', 'driving-licence': 'Driving Licence',
  'cpc-card': 'CPC Card', 'medical-certificate': 'Medical Certificate',
  'dbs-check': 'DBS Check', 'driver-training-certificate': 'Training Certificate',
  'tacho-card': 'Tachograph Card', 'operator-licence': 'Operator Licence',
  'fleet-insurance-policy': 'Fleet Insurance Policy', 'fors-certificate': 'FORS Certificate',
  'earned-recognition': 'Earned Recognition', 'public-liability-insurance': 'Public Liability Insurance',
}

const fmtSize = (b: number) => b < 1048576 ? `${(b/1024).toFixed(0)} KB` : `${(b/1048576).toFixed(1)} MB`

export default function DocumentsPage() {
  const { isDark } = useTheme()
  const [activeCategory, setActiveCategory] = useState<'all' | DocumentCategory>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | DocumentStatus>('all')
  const [search, setSearch] = useState('')
  const [selectedDoc, setSelectedDoc] = useState<FleetDocument | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [sortField, setSortField] = useState<'name' | 'expiry' | 'status'>('expiry')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const total = fleetDocuments.length
  const expired = fleetDocuments.filter(d => d.status === 'expired').length
  const expiring = fleetDocuments.filter(d => d.status === 'expiring').length
  const valid = fleetDocuments.filter(d => d.status === 'valid').length

  const filtered = fleetDocuments
    .filter(d => {
      const s = search.toLowerCase()
      const matchSearch = !search || d.name.toLowerCase().includes(s) || d.linkedName.toLowerCase().includes(s) || d.issuedBy.toLowerCase().includes(s)
      const matchCat = activeCategory === 'all' || d.category === activeCategory
      const matchStatus = filterStatus === 'all' || d.status === filterStatus
      return matchSearch && matchCat && matchStatus
    })
    .sort((a, b) => {
      if (sortField === 'expiry') {
        const aD = a.expiryDate || '9999'; const bD = b.expiryDate || '9999'
        return sortDir === 'asc' ? aD.localeCompare(bD) : bD.localeCompare(aD)
      }
      if (sortField === 'status') {
        const order: Record<DocumentStatus, number> = { expired: 0, expiring: 1, missing: 2, valid: 3 }
        return sortDir === 'asc' ? order[a.status] - order[b.status] : order[b.status] - order[a.status]
      }
      return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    })

  const toggleSort = (f: typeof sortField) => { if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(f); setSortDir('asc') } }
  const SI = ({ field }: { field: typeof sortField }) => (
    <span className="ml-1 inline-flex flex-col">
      <ChevronUp size={10} className={sortField === field && sortDir === 'asc' ? 'text-purple-600' : 'text-gray-300'} />
      <ChevronDown size={10} className={sortField === field && sortDir === 'desc' ? 'text-purple-600' : 'text-gray-300'} />
    </span>
  )

  return (
    <FleetpointLayout>
      <div className={`p-6 min-h-full ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Documents</h1>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{total} documents · {expired} expired · {expiring} expiring soon</p>
          </div>
          <div className="flex items-center gap-2">
            <button className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl border transition-colors ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <Download size={15} /> Export Report
            </button>
            <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <Upload size={15} /> Upload Document
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total Documents', value: total, icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50', onClick: () => setFilterStatus('all') },
            { label: 'Valid', value: valid, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', onClick: () => setFilterStatus('valid') },
            { label: 'Expiring Soon', value: expiring, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', onClick: () => setFilterStatus('expiring') },
            { label: 'Expired', value: expired, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', onClick: () => setFilterStatus('expired') },
          ].map((kpi, i) => (
            <button key={i} onClick={kpi.onClick} className={`border rounded-2xl p-4 text-left hover:shadow-md transition-all ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className={`w-8 h-8 rounded-xl ${kpi.bg} flex items-center justify-center mb-3`}><kpi.icon size={16} className={kpi.color} /></div>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{kpi.value}</p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{kpi.label}</p>
            </button>
          ))}
        </div>

        {(expired > 0 || expiring > 0) && (
          <div className={`rounded-2xl border p-4 mb-5 ${isDark ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className={`font-semibold text-sm mb-2 ${isDark ? 'text-red-300' : 'text-red-800'}`}>Documents Requiring Immediate Attention</p>
                <div className="flex flex-wrap gap-2">
                  {fleetDocuments.filter(d => d.status === 'expired' || d.status === 'expiring')
                    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
                    .map(d => (
                      <button key={d.id} onClick={() => setSelectedDoc(d)}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border ${d.status === 'expired' ? 'bg-red-100 border-red-300 text-red-700 hover:bg-red-200' : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'}`}>
                        <span className="font-bold">{d.linkedName}</span>
                        <span>·</span>
                        <span>{TYPE_LABELS[d.type]}</span>
                        <span className="font-bold">{d.status === 'expired' ? `(${Math.abs(d.daysUntilExpiry)}d overdue)` : `(${d.daysUntilExpiry}d left)`}</span>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={`flex items-center gap-1 mb-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {[
            { id: 'all', label: 'All Documents', count: total, icon: FileText },
            { id: 'vehicle', label: 'Vehicle', count: fleetDocuments.filter(d => d.category === 'vehicle').length, icon: Car },
            { id: 'driver', label: 'Driver', count: fleetDocuments.filter(d => d.category === 'driver').length, icon: User },
            { id: 'company', label: 'Company', count: fleetDocuments.filter(d => d.category === 'company').length, icon: Building2 },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveCategory(tab.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-all
                ${activeCategory === tab.id ? 'border-purple-600 text-purple-600' : `border-transparent ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}`}>
              <tab.icon size={13} />{tab.label}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${activeCategory === tab.id ? 'bg-purple-100 text-purple-700' : `${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'}`}`}>{tab.count}</span>
            </button>
          ))}
        </div>

        <div className={`rounded-2xl border p-4 mb-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`flex-1 flex items-center gap-2 border rounded-xl px-3 py-2 ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
              <Search size={14} className="text-gray-400 shrink-0" />
              <input type="text" placeholder="Search document name, vehicle, driver, issuer..." value={search} onChange={e => setSearch(e.target.value)}
                className={`flex-1 text-sm outline-none bg-transparent ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`} />
              {search && <button onClick={() => setSearch('')}><X size={12} className="text-gray-400" /></button>}
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
              className={`text-sm border rounded-xl px-3 py-2 outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
              <option value="all">All Status</option>
              {Object.entries(STATUS_CONFIG).map(([val, cfg]) => <option key={val} value={val}>{cfg.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-4">
          <div className={`flex-1 rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b text-xs font-semibold uppercase tracking-wide ${isDark ? 'border-gray-700 bg-gray-900 text-gray-400' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
                  <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('name')}>Document <SI field="name" /></th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Linked To</th>
                  <th className="px-4 py-3 text-left">Issued By</th>
                  <th className="px-4 py-3 text-left">Issue Date</th>
                  <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('expiry')}>Expiry <SI field="expiry" /></th>
                  <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('status')}>Status <SI field="status" /></th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(doc => {
                  const cat = CATEGORY_CONFIG[doc.category]
                  const status = STATUS_CONFIG[doc.status]
                  const isSelected = selectedDoc?.id === doc.id
                  return (
                    <tr key={doc.id} onClick={() => setSelectedDoc(isSelected ? null : doc)}
                      className={`border-b cursor-pointer transition-colors
                        ${isDark ? 'border-gray-700 hover:bg-gray-750' : 'border-gray-50 hover:bg-gray-50'}
                        ${isSelected ? (isDark ? 'bg-purple-900/20' : 'bg-purple-50') : ''}
                        ${doc.status === 'expired' ? 'border-l-2 border-l-red-500' : ''}
                        ${doc.status === 'expiring' ? 'border-l-2 border-l-amber-400' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg ${cat.bg} flex items-center justify-center shrink-0`}><cat.icon size={14} className={cat.color} /></div>
                          <div>
                            <p className={`font-semibold text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>{TYPE_LABELS[doc.type]}</p>
                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{doc.fileName} · {fmtSize(doc.fileSize)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className={`text-xs font-medium ${cat.color}`}>{cat.label}</span></td>
                      <td className="px-4 py-3"><span className={`text-xs font-medium ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>{doc.linkedName}</span></td>
                      <td className="px-4 py-3"><span className={`text-xs truncate block max-w-32 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{doc.issuedBy}</span></td>
                      <td className="px-4 py-3"><span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{doc.issueDate}</span></td>
                      <td className="px-4 py-3">
                        {doc.expiryDate ? (
                          <div>
                            <span className={`text-xs font-medium ${doc.status === 'expired' ? 'text-red-600' : doc.status === 'expiring' ? 'text-amber-600' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>{doc.expiryDate}</span>
                            <p className={`text-xs ${doc.status === 'expired' ? 'text-red-600 font-bold' : doc.status === 'expiring' ? 'text-amber-600 font-medium' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                              {doc.status === 'expired' ? `${Math.abs(doc.daysUntilExpiry)}d overdue` : `${doc.daysUntilExpiry}d left`}
                            </p>
                          </div>
                        ) : <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No expiry</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium w-fit ${status.color} ${status.bg} ${status.border}`}>
                          <status.icon size={10} />{status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}><Eye size={13} /></button>
                          <button onClick={() => setShowUploadModal(true)} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}><Upload size={13} /></button>
                          <button className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}><Edit size={13} /></button>
                          <button className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className={`px-4 py-3 border-t text-xs ${isDark ? 'border-gray-700 text-gray-400' : 'border-gray-100 text-gray-500'}`}>
              Showing {filtered.length} of {fleetDocuments.length} documents
            </div>
          </div>

          {selectedDoc && (
            <div className={`w-72 shrink-0 rounded-2xl border overflow-hidden flex flex-col ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Document Details</h3>
                <button onClick={() => setSelectedDoc(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                <div className={`rounded-xl border-2 border-dashed p-6 text-center ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <FileText size={28} className="text-gray-400 mx-auto mb-2" />
                  <p className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{selectedDoc.fileName}</p>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{fmtSize(selectedDoc.fileSize)}</p>
                  <button className="inline-flex items-center gap-1.5 mt-3 text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg font-medium">
                    <Eye size={11} /> View Document
                  </button>
                </div>
                <div className={`flex items-center justify-between p-3 rounded-xl border ${STATUS_CONFIG[selectedDoc.status].bg} ${STATUS_CONFIG[selectedDoc.status].border}`}>
                  <div className="flex items-center gap-2">
                    {(() => { const S = STATUS_CONFIG[selectedDoc.status]; return <S.icon size={16} className={S.color} /> })()}
                    <span className={`text-sm font-bold ${STATUS_CONFIG[selectedDoc.status].color}`}>{STATUS_CONFIG[selectedDoc.status].label}</span>
                  </div>
                  {selectedDoc.daysUntilExpiry < 9999 && (
                    <span className={`text-xs font-bold ${STATUS_CONFIG[selectedDoc.status].color}`}>
                      {selectedDoc.status === 'expired' ? `${Math.abs(selectedDoc.daysUntilExpiry)}d overdue` : `${selectedDoc.daysUntilExpiry}d left`}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {[
                    { label: 'Type', value: TYPE_LABELS[selectedDoc.type] },
                    { label: 'Linked To', value: selectedDoc.linkedName },
                    { label: 'Doc Number', value: selectedDoc.documentNumber || '—' },
                    { label: 'Issued By', value: selectedDoc.issuedBy },
                    { label: 'Issue Date', value: selectedDoc.issueDate || '—' },
                    { label: 'Expiry Date', value: selectedDoc.expiryDate || 'No expiry' },
                    { label: 'Uploaded By', value: selectedDoc.uploadedBy },
                  ].map(item => (
                    <div key={item.label} className="flex items-start justify-between gap-2">
                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.label}</span>
                      <span className={`text-xs font-medium text-right ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
                {selectedDoc.notes && (
                  <div className={`rounded-xl p-3 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Notes</p>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{selectedDoc.notes}</p>
                  </div>
                )}
                {(selectedDoc.status === 'expired' || selectedDoc.status === 'expiring') && (
                  <button onClick={() => setShowUploadModal(true)}
                    className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                    <Upload size={14} />{selectedDoc.status === 'expired' ? 'Upload Renewed Document' : 'Upload Before Expiry'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={`mt-5 rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-purple-500" />
            <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Compliance Gaps</h3>
            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>— missing required documents</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Car, color: 'text-purple-500', title: 'Vehicles — MOT Required',
                items: vehicles.filter(v => !fleetDocuments.find(d => d.linkedId === v.id && d.type === 'mot-certificate')),
                getLabel: (v: any) => v.plate },
              { icon: User, color: 'text-blue-500', title: 'Drivers — Licence Missing',
                items: drivers.filter(d => !fleetDocuments.find(doc => doc.linkedId === d.id && doc.type === 'driving-licence')),
                getLabel: (d: any) => d.name.split(' ')[0] },
              { icon: Award, color: 'text-teal-500', title: 'Drivers — CPC Missing',
                items: drivers.filter(d => d.licenceCategories.includes('CPC') && !fleetDocuments.find(doc => doc.linkedId === d.id && doc.type === 'cpc-card')),
                getLabel: (d: any) => d.name.split(' ')[0] },
            ].map((section, i) => (
              <div key={i} className={`rounded-xl p-4 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <section.icon size={14} className={section.color} />
                  <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{section.title}</p>
                </div>
                {section.items.length === 0
                  ? <p className="text-xs text-green-600 font-medium">✓ All up to date</p>
                  : section.items.slice(0, 5).map((item: any) => (
                    <div key={item.id} className={`flex items-center justify-between py-1.5 border-b last:border-0 ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
                      <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{section.getLabel(item)}</span>
                      <button onClick={() => setShowUploadModal(true)} className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-lg hover:bg-purple-700">Upload</button>
                    </div>
                  ))
                }
              </div>
            ))}
          </div>
        </div>
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className={`rounded-3xl shadow-2xl w-full max-w-lg mx-4 p-6 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>Upload Document</h2>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Document Type *</label>
                  <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                    <optgroup label="Vehicle"><option>MOT Certificate</option><option>Vehicle Insurance</option><option>Road Tax</option><option>V5C Registration</option></optgroup>
                    <optgroup label="Driver"><option>Driving Licence</option><option>CPC Card</option><option>Medical Certificate</option><option>DBS Check</option></optgroup>
                    <optgroup label="Company"><option>Operator Licence</option><option>Fleet Insurance</option><option>FORS Certificate</option></optgroup>
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Linked To *</label>
                  <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                    <option>Company — LogisticsPro</option>
                    <optgroup label="Vehicles">{vehicles.slice(0, 8).map(v => <option key={v.id}>{v.plate}</option>)}</optgroup>
                    <optgroup label="Drivers">{drivers.map(d => <option key={d.id}>{d.name}</option>)}</optgroup>
                  </select>
                </div>
              </div>
              <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer ${isDark ? 'border-gray-700 hover:border-purple-600' : 'border-gray-200 hover:border-purple-400'}`}>
                <Upload size={24} className="text-gray-400 mx-auto mb-2" />
                <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Click to upload or drag and drop</p>
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>PDF, JPG, PNG — max 10MB</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Issue Date</label><input type="date" className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`} /></div>
                <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Expiry Date</label><input type="date" className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`} /></div>
              </div>
              <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Issued By</label><input placeholder="e.g. DVLA, Aviva..." className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500 ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} /></div>
              <div><label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Document Number</label><input placeholder="Licence no., policy no..." className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500 ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} /></div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowUploadModal(false)} className={`flex-1 py-2.5 rounded-xl text-sm font-medium border ${isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}>Cancel</button>
              <button onClick={() => setShowUploadModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center justify-center gap-2">
                <Upload size={14} /> Upload Document
              </button>
            </div>
          </div>
        </div>
      )}
    </FleetpointLayout>
  )
}
