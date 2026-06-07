/**
 * ImportButton — bouton d'import CSV/Excel avec parsing
 * Usage : <ImportButton onData={fn} accept=".xlsx,.csv" label="Importer lots" />
 */
import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { parseExcel } from '../../lib/export';

export default function ImportButton({ onData, accept = '.xlsx,.xls,.csv', label = 'Importer', color = '#1a3f6f' }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setErreur('');
    try {
      const { entetes, lignes } = await parseExcel(file);
      onData?.({ entetes, lignes, nomFichier: file.name });
    } catch (err) {
      setErreur(err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: color, color: 'white', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500, opacity: loading ? 0.7 : 1 }}>
        <Upload size={13} />
        {loading ? 'Lecture...' : label}
      </button>
      <input ref={inputRef} type="file" accept={accept} onChange={handleFile} style={{ display: 'none' }} />
      {erreur && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, color: '#A32D2D', background: '#FCEBEB', borderRadius: 6, padding: '4px 8px' }}>
          <X size={10} /> {erreur}
        </div>
      )}
    </div>
  );
}
