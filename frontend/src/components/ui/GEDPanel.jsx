/**
 * GEDPanel — Composant GED réutilisable
 * Usage: <GEDPanel entiteType="souscripteur" entiteId={id} />
 */
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsAPI } from '../../lib/api';
import { Upload, FileText, Image, Trash2, Eye, X } from 'lucide-react';

const TYPES_GED = [
  { key: 'CNI', label: "Carte Nationale d'Identité", accept: '.jpg,.jpeg,.png,.pdf' },
  { key: 'EXTRAIT_NAISSANCE', label: 'Extrait de naissance', accept: '.jpg,.jpeg,.png,.pdf' },
  { key: 'DIPLOME', label: 'Diplôme / Attestation', accept: '.jpg,.jpeg,.png,.pdf' },
  { key: 'FACTURE', label: 'Facture', accept: '.jpg,.jpeg,.png,.pdf,.doc,.docx' },
  { key: 'CONTRAT', label: 'Contrat', accept: '.pdf,.doc,.docx' },
  { key: 'PLAN', label: 'Plan / Carte', accept: '.jpg,.jpeg,.png,.pdf' },
  { key: 'PHOTO', label: 'Photo', accept: '.jpg,.jpeg,.png' },
  { key: 'PERMIS', label: 'Permis / Autorisation', accept: '.jpg,.jpeg,.png,.pdf' },
  { key: 'ASSURANCE', label: 'Assurance', accept: '.jpg,.jpeg,.png,.pdf' },
  { key: 'AUTRE', label: 'Autre document', accept: '.jpg,.jpeg,.png,.pdf,.doc,.docx' },
];

const MIME_ICONS = {
  'application/pdf': '📄',
  'image/jpeg': '🖼',
  'image/jpg': '🖼',
  'image/png': '🖼',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
};

function getToken() {
  try { return JSON.parse(localStorage.getItem('2ig-auth') || '{}')?.state?.token || ''; }
  catch { return ''; }
}

export default function GEDPanel({ entiteType, entiteId, compact = false }) {
  const qc = useQueryClient();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState('CNI');
  const [selectedNom, setSelectedNom] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  const { data: docs = [] } = useQuery({
    queryKey: ['documents', entiteType, entiteId],
    queryFn: () => documentsAPI.list({ entiteType, entiteId }),
    enabled: !!entiteId,
  });

  const deleteMut = useMutation({
    mutationFn: documentsAPI.delete,
    onSuccess: () => qc.invalidateQueries(['documents', entiteType, entiteId]),
  });

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('fichier', file);
      fd.append('entiteType', entiteType);
      fd.append('entiteId', entiteId);
      fd.append('type', selectedType);
      fd.append('nom', selectedNom || file.name);
      await documentsAPI.upload(fd);
      qc.invalidateQueries(['documents', entiteType, entiteId]);
      setSelectedNom('');
      e.target.value = '';
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally { setUploading(false); }
  };

  const openPreview = async (doc) => {
    try {
      const url = documentsAPI.viewUrl(doc.id);
      setPreview({ url, nom: doc.nom, mimeType: doc.mimeType });
    } catch {}
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div style={{ border: '0.5px solid #e8e7e1', borderRadius: 10, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: '#F7F7F5', padding: '10px 16px', borderBottom: '0.5px solid #e8e7e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>📁 Documents ({docs.length})</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '0.5px solid #ddd', background: 'white' }}>
            {TYPES_GED.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          {!compact && (
            <input placeholder="Nom (optionnel)" value={selectedNom} onChange={e => setSelectedNom(e.target.value)}
              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '0.5px solid #ddd', width: 120 }} />
          )}
          <input ref={inputRef} type="file"
            accept={TYPES_GED.find(t => t.key === selectedType)?.accept || '*'}
            onChange={handleFileSelect} style={{ display: 'none' }} />
          <button onClick={() => inputRef.current?.click()} disabled={uploading || !entiteId}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#1a3f6f', color: 'white', fontSize: 11, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
            <Upload size={11} /> {uploading ? 'Envoi...' : 'Ajouter'}
          </button>
        </div>
      </div>

      {error && <div style={{ padding: '6px 16px', background: '#FCEBEB', color: '#A32D2D', fontSize: 12 }}>{error}</div>}

      {/* Liste documents */}
      {docs.length === 0 ? (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: '#aaa', fontSize: 12 }}>
          Aucun document — cliquez sur "Ajouter" pour uploader
        </div>
      ) : (
        <div style={{ padding: 8 }}>
          {docs.map(doc => (
            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '0.5px solid #e8e7e1', marginBottom: 4, background: 'white' }}>
              <span style={{ fontSize: 18 }}>{MIME_ICONS[doc.mimeType] || '📄'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nom}</div>
                <div style={{ fontSize: 10, color: '#888' }}>
                  {TYPES_GED.find(t => t.key === doc.type)?.label || doc.type}
                  {doc.taille ? ` · ${formatSize(doc.taille)}` : ''}
                  {' · '}{new Date(doc.createdAt).toLocaleDateString('fr')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => window.open(`${documentsAPI.viewUrl(doc.id)}?token=${getToken()}`, '_blank')}
                  style={{ background: '#EEF3FB', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer' }}>
                  <Eye size={12} color="#1a3f6f" />
                </button>
                <button onClick={() => deleteMut.mutate(doc.id)}
                  style={{ background: '#FCEBEB', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer' }}>
                  <Trash2 size={12} color="#A32D2D" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
