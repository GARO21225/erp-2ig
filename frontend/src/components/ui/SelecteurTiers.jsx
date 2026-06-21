import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { partenairesLiyaAPI, clientsLiyaAPI } from '../../lib/api';
import { X, Plus } from 'lucide-react';

/**
 * Sélecteur d'expéditeur OU destinataire pour une livraison LiYA.
 * Edgar a explicitement demandé que chacun des deux puisse être :
 *  - un Partenaire existant (boutique/pharmacie avec stock 3PL)
 *  - un ClientLiYA existant (client récurrent SANS stock, ex: administration)
 *  - un particulier ponctuel (nom/téléphone tapés librement)
 * Les deux premières catégories sont volontairement gardées séparées
 * (jamais de confusion stock ↔ client récurrent).
 *
 * value : { partenaireId, clientId, nom, tel }
 * onChange reçoit la même forme mise à jour.
 */
export default function SelecteurTiers({ label, value, onChange }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState(value?.partenaireId ? 'partenaire' : value?.clientId ? 'client' : 'particulier');
  const [creationRapide, setCreationRapide] = useState(false);
  const [nomRapide, setNomRapide] = useState('');
  const [telRapide, setTelRapide] = useState('');

  const { data: partenaires = [] } = useQuery({
    queryKey: ['partenaires-liya-select'], queryFn: () => partenairesLiyaAPI.list({ actif: true }), staleTime: 60000,
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-liya-select'], queryFn: () => clientsLiyaAPI.list({ actif: true }), staleTime: 60000,
  });
  const listePartenaires = Array.isArray(partenaires) ? partenaires : [];
  const listeClients = Array.isArray(clients) ? clients : [];

  const creerClientMut = useMutation({
    mutationFn: clientsLiyaAPI.create,
    onSuccess: (nouveauClient) => {
      qc.invalidateQueries(['clients-liya-select']);
      onChange({ partenaireId: null, clientId: nouveauClient.id, nom: nouveauClient.nom, tel: nouveauClient.telephone });
      setCreationRapide(false); setNomRapide(''); setTelRapide('');
    },
  });

  const choisirMode = (m) => {
    setMode(m);
    onChange({ partenaireId: null, clientId: null, nom: '', tel: '' });
  };

  const choisirPartenaire = (id) => {
    const p = listePartenaires.find(x => x.id === id);
    onChange({ partenaireId: id, clientId: null, nom: p?.nom || '', tel: p?.telephone || '' });
  };
  const choisirClient = (id) => {
    const c = listeClients.find(x => x.id === id);
    onChange({ partenaireId: null, clientId: id, nom: c?.nom || '', tel: c?.telephone || '' });
  };

  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {[['partenaire', '🏢 Partenaire'], ['client', '🏛 Client'], ['particulier', '🧑 Particulier']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => choisirMode(k)}
            style={{ flex: 1, padding: '5px 8px', borderRadius: 8, border: `1.5px solid ${mode === k ? '#E85D04' : '#e8e7e1'}`, background: mode === k ? '#FFF0EB' : 'white', color: mode === k ? '#E85D04' : '#666', fontSize: 11, cursor: 'pointer', fontWeight: mode === k ? 600 : 400 }}>
            {l}
          </button>
        ))}
      </div>

      {mode === 'partenaire' && (
        <select className="input" value={value?.partenaireId || ''} onChange={e => choisirPartenaire(e.target.value)}>
          <option value="">Sélectionner un partenaire...</option>
          {listePartenaires.map(p => <option key={p.id} value={p.id}>{p.nom} — {p.telephone}</option>)}
        </select>
      )}

      {mode === 'client' && !creationRapide && (
        <div>
          <select className="input" value={value?.clientId || ''} onChange={e => choisirClient(e.target.value)}>
            <option value="">Sélectionner un client...</option>
            {listeClients.map(c => <option key={c.id} value={c.id}>{c.nom} ({c.typeClient}) — {c.telephone}</option>)}
          </select>
          <button type="button" onClick={() => setCreationRapide(true)}
            style={{ marginTop: 6, fontSize: 11, color: '#1a3f6f', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Plus size={11} /> Nouveau client
          </button>
        </div>
      )}

      {mode === 'client' && creationRapide && (
        <div style={{ background: '#F7F7F5', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>Nouveau client</span>
            <button type="button" onClick={() => setCreationRapide(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={12} /></button>
          </div>
          <input className="input" placeholder="Nom (ex: Préfecture de Yamoussoukro)" value={nomRapide} onChange={e => setNomRapide(e.target.value)} style={{ fontSize: 12 }} />
          <input className="input" placeholder="Téléphone" value={telRapide} onChange={e => setTelRapide(e.target.value)} style={{ fontSize: 12 }} />
          <button type="button" disabled={!nomRapide || !telRapide || creerClientMut.isPending}
            onClick={() => creerClientMut.mutate({ nom: nomRapide, telephone: telRapide, typeClient: 'ADMINISTRATION' })}
            style={{ padding: '6px', borderRadius: 6, background: '#1a3f6f', color: 'white', border: 'none', fontSize: 11, cursor: 'pointer', opacity: (!nomRapide || !telRapide) ? 0.5 : 1 }}>
            Créer et sélectionner
          </button>
        </div>
      )}

      {mode === 'particulier' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" placeholder="Nom" value={value?.nom || ''} onChange={e => onChange({ ...value, partenaireId: null, clientId: null, nom: e.target.value })} />
          <input className="input" placeholder="Téléphone" value={value?.tel || ''} onChange={e => onChange({ ...value, partenaireId: null, clientId: null, tel: e.target.value })} />
        </div>
      )}
    </div>
  );
}
