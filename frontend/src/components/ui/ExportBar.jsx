import { Download, FileText, Printer, FileSpreadsheet } from 'lucide-react';

export default function ExportBar({ onExcelClick, onCSVClick, onPDFClick, onPrint, label = '', loading = false, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {count !== undefined && (
        <span style={{ fontSize: 12, color: '#888', marginRight: 2 }}>{count} ligne{count !== 1 ? 's' : ''}</span>
      )}
      {onExcelClick && (
        <button onClick={onExcelClick} disabled={loading} title="Exporter Excel"
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: 'none', background: '#EAF3DE', color: '#27500A', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}>
          <Download size={12} /> Excel
        </button>
      )}
      {onCSVClick && (
        <button onClick={onCSVClick} disabled={loading} title="Exporter CSV"
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: 'none', background: '#F4FAE8', color: '#3B6D11', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}>
          <FileSpreadsheet size={12} /> CSV
        </button>
      )}
      {onPDFClick && (
        <button onClick={onPDFClick} disabled={loading} title="Exporter PDF"
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: 'none', background: '#EEF3FB', color: '#1a3f6f', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}>
          <FileText size={12} /> PDF
        </button>
      )}
      {onPrint && (
        <button onClick={() => window.print()} disabled={loading} title="Imprimer"
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: 'none', background: '#F1EFE8', color: '#5F5E5A', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
          <Printer size={12} /> Imprimer
        </button>
      )}
    </div>
  );
}
