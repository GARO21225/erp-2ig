/**
 * TemplateDownloader — Bouton téléchargement template avec description
 */
import { Download } from 'lucide-react';
import { getApiBaseUrl } from '../../lib/api';

const TEMPLATES = {
  lots: {
    label: 'Lots fonciers',
    url: '/toptelsig/lots/template',
    description: 'numéro, superficie, prix, ilot',
    color: '#1a3f6f',
  },
  souscripteurs: {
    label: 'Souscripteurs',
    url: '/toptelsig/souscripteurs/template',
    description: 'nom, prenom, telephone, email, profession, numeroCni, statut',
    color: '#1a3f6f',
  },
  employes: {
    label: 'Employés',
    url: '/employes/template',
    description: 'matricule, nom, prenom, telephone, poste, filiale, dateEmbauche, salaireBase',
    color: '#1a3f6f',
  },
  motos: {
    label: 'Motos LiYA',
    url: '/liya/motos/template',
    description: 'immatriculation, marque, modele, annee, kilometrage, dateExpirationAssurance, dateVisiteTechnique',
    color: '#E85D04',
  },
  stock: {
    label: 'Articles Stock',
    url: '/stocks/template-import',
    description: 'reference, nom, categorie, unite, prixAchat, prixVente, stockAlert',
    color: '#27500A',
  },
};

export default function TemplateDownloader({ type, compact = false }) {
  const tpl = TEMPLATES[type];
  if (!tpl) return null;

  const handleDownload = () => {
    const token = localStorage.getItem('erp-2ig-token') || sessionStorage.getItem('token');
    const url = `${getApiBaseUrl()}${tpl.url}`;
    // Ouvrir avec le token dans les headers n'est pas possible via window.open
    // On crée un lien temporaire avec fetch
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `template_${type}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => window.open(url, '_blank'));
  };

  if (compact) {
    return (
      <button onClick={handleDownload} className="btn btn-ghost btn-sm" title={`Template ${tpl.label}`}>
        <Download size={12} /> Template
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#F7F7F5', borderRadius: 8, border: '0.5px solid #e8e7e1' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: tpl.color }}>📋 Template {tpl.label}</div>
        <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>Colonnes: {tpl.description}</div>
      </div>
      <button onClick={handleDownload} className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}>
        <Download size={12} /> Télécharger
      </button>
    </div>
  );
}
