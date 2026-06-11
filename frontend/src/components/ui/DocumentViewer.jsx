/**
 * DocumentViewer — Affiche un document HTML avec actions
 * Imprimer / Télécharger / WhatsApp / Email / Archiver GED
 */
import { useState, useRef } from 'react';
import { X, Printer, Download, MessageSquare, Mail, Archive } from 'lucide-react';

export default function DocumentViewer({ document, onClose, client, onArchiver }) {
  const iframeRef = useRef(null);
  const [loading, setLoading] = useState(false);

  if (!document) return null;

  const { numero, titre, html } = document;

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (!iframe) {
      // Fallback : ouvrir dans une nouvelle fenêtre
      const w = window.open('', '_blank');
      w.document.write(`
        <!DOCTYPE html><html><head>
        <meta charset="utf-8">
        <title>${titre}</title>
        <style>@media print { body { margin: 0; } }</style>
        </head><body>${html}</body></html>
      `);
      w.document.close();
      w.focus();
      setTimeout(() => { w.print(); w.close(); }, 500);
      return;
    }
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  };

  const handleWhatsApp = () => {
    const tel = client?.telephone?.replace(/[\s\-+]/g, '') || '';
    const msg = encodeURIComponent(
      `📄 ${titre}\nN° ${numero}\n\nVeuillez consulter votre document.\n\n${window.location.origin}`
    );
    window.open(`https://wa.me/${tel}?text=${msg}`, '_blank');
  };

  const handleEmail = () => {
    const sujet = encodeURIComponent(`${titre} — N° ${numero}`);
    const corps = encodeURIComponent(
      `Bonjour ${client ? `${client.prenom} ${client.nom}` : ''},\n\nVeuillez trouver ci-joint votre ${titre?.toLowerCase()}.\n\nNuméro: ${numero}\n\nCordialement,\nTOPTELSIG — Groupe 2IG`
    );
    window.open(`mailto:${client?.email || ''}?subject=${sujet}&body=${corps}`);
  };

  const handleDownload = () => {
    // Générer un fichier HTML téléchargeable
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titre}</title>
    <style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;}</style>
    </head><body>${html}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${numero}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16
    }}>
      <div style={{
        background: 'white', borderRadius: 12, width: '100%', maxWidth: 860,
        maxHeight: '95vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Barre d'actions */}
        <div style={{
          padding: '12px 16px', borderBottom: '0.5px solid #e8e7e1',
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
          background: '#F7F7F5', borderRadius: '12px 12px 0 0'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: '#1a3f6f' }}>{titre}</div>
            <div style={{ fontSize: 11, color: '#888' }}>N° {numero}</div>
          </div>
          <button onClick={handlePrint}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', background:'#1a3f6f', color:'white', border:'none', borderRadius:7, cursor:'pointer', fontSize:12 }}>
            <Printer size={13}/> Imprimer
          </button>
          <button onClick={handleDownload}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', background:'#27500A', color:'white', border:'none', borderRadius:7, cursor:'pointer', fontSize:12 }}>
            <Download size={13}/> Télécharger
          </button>
          <button onClick={handleWhatsApp}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', background:'#25D366', color:'white', border:'none', borderRadius:7, cursor:'pointer', fontSize:12 }}>
            <MessageSquare size={13}/> WhatsApp
          </button>
          <button onClick={handleEmail}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', background:'#BA7517', color:'white', border:'none', borderRadius:7, cursor:'pointer', fontSize:12 }}>
            <Mail size={13}/> Email
          </button>
          {onArchiver && (
            <button onClick={() => { setLoading(true); onArchiver().finally(() => setLoading(false)); }}
              disabled={loading}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', background:'#888', color:'white', border:'none', borderRadius:7, cursor:'pointer', fontSize:12 }}>
              <Archive size={13}/> {loading ? '...' : 'GED'}
            </button>
          )}
          <button onClick={onClose}
            style={{ padding:'7px 10px', background:'none', border:'1px solid #e8e7e1', borderRadius:7, cursor:'pointer' }}>
            <X size={14}/>
          </button>
        </div>

        {/* Aperçu du document */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: '#f0efe9' }}>
          <div style={{ background: 'white', borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <iframe
              ref={iframeRef}
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:Arial,sans-serif;}*{box-sizing:border-box;}</style></head><body>${html}</body></html>`}
              style={{ width: '100%', minHeight: 600, border: 'none', display: 'block' }}
              title={titre}
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
