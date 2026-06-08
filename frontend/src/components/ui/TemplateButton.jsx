/**
 * TemplateButton — Bouton de téléchargement de template authentifié
 */
export default function TemplateButton({ url, label = 'Template', color = '#1a3f6f' }) {
  const handleDownload = () => {
    // Récupérer le token depuis le store Zustand persisté
    let token = null;
    try {
      const stored = localStorage.getItem('2ig-auth');
      if (stored) token = JSON.parse(stored)?.state?.token;
    } catch {}

    const base = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    const fullUrl = `${base}${url.startsWith('/') ? url : '/' + url}`;

    fetch(fullUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => {
        if (!r.ok) throw new Error(`Erreur ${r.status}`);
        const disposition = r.headers.get('content-disposition') || '';
        const match = disposition.match(/filename="?([^"]+)"?/);
        const filename = match ? match[1] : label.replace(/\s/g, '_') + '.csv';
        return r.blob().then(blob => ({ blob, filename }));
      })
      .then(({ blob, filename }) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      })
      .catch(e => alert(`Erreur téléchargement: ${e.message}`));
  };

  return (
    <button onClick={handleDownload} title={`Télécharger ${label}`}
      style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:7, border:`0.5px solid ${color}30`, background:color+'12', color, fontSize:12, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap' }}>
      📋 {label}
    </button>
  );
}
