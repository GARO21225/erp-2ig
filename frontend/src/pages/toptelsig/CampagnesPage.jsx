import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toptelsigAPI } from '../../lib/api';
import { Plus, X, Send, Phone, Copy, CheckCircle, XCircle, Megaphone } from 'lucide-react';

const TYPES = [
  { key: 'PROMOTION', label: '🎉 Promotion' },
  { key: 'ANNONCE', label: '📢 Annonce' },
  { key: 'RELANCE_GROUPEE', label: '📞 Relance groupée' },
  { key: 'AUTRE', label: '📋 Autre' },
];

const STATUT_BADGE = {
  BROUILLON: { label: 'Brouillon', badge: 'badge-gray' },
  EN_COURS: { label: 'En cours', badge: 'badge-amber' },
  TERMINEE: { label: 'Terminée', badge: 'badge-green' },
  ANNULEE: { label: 'Annulée', badge: 'badge-red' },
};

const CANAL_ICON = { whatsapp: '💬', sms: '✉️', email: '📧', telegram: '✈️', autre: '📋' };

// ── Modal Création de campagne ──────────────────────────────────────────────
function ModalCreateCampagne({ onClose, onSave, loading, canaux }) {
  const [etape, setEtape] = useState(1); // 1: infos, 2: destinataires, 3: message
  const [form, setForm] = useState({ nom: '', filiale: 'TOPTELSIG', type: 'PROMOTION', canal: 'whatsapp', message: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [search, setSearch] = useState('');
  const [selectionnes, setSelectionnes] = useState({}); // { id: {id,nom,telephone,email} }

  const { data: prospectsData } = useQuery({
    queryKey: ['crm-prospects-campagne'],
    queryFn: () => toptelsigAPI.crmProspects({}),
    staleTime: 60000,
  });
  const listeProspects = Array.isArray(prospectsData) ? prospectsData : [];
  const filtres = listeProspects.filter(p =>
    !search || `${p.prenom} ${p.nom}`.toLowerCase().includes(search.toLowerCase()) || (p.telephone || '').includes(search)
  );

  const toggleSelection = (p) => {
    setSelectionnes(prev => {
      const next = { ...prev };
      if (next[p.id]) delete next[p.id];
      else next[p.id] = { id: p.id, nom: `${p.prenom} ${p.nom}`, telephone: p.telephone, email: p.email };
      return next;
    });
  };

  const selectionnerTous = () => {
    const next = {};
    filtres.forEach(p => { next[p.id] = { id: p.id, nom: `${p.prenom} ${p.nom}`, telephone: p.telephone, email: p.email }; });
    setSelectionnes(next);
  };

  const nbSelectionnes = Object.keys(selectionnes).length;
  const canalInfo = canaux?.[form.canal];

  const peutContinuer1 = form.nom.trim() && form.canal;
  const peutContinuer2 = nbSelectionnes > 0;
  const peutEnvoyer = form.message.trim() && nbSelectionnes > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>📣 Nouvelle campagne</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, marginTop: 8 }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{ flex: 1, height: 4, borderRadius: 2, background: etape >= n ? '#1a3f6f' : '#f0efe9' }} />
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Étape 1 : infos de base */}
          {etape === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="label">Nom de la campagne *</label>
                <input className="input" value={form.nom} onChange={e => set('nom', e.target.value)} placeholder="Ex: Promo lancement projet Riviera" />
              </div>
              <div>
                <label className="label">Type</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {TYPES.map(t => (
                    <button key={t.key} type="button" onClick={() => set('type', t.key)}
                      style={{ padding: '5px 12px', borderRadius: 16, border: `1.5px solid ${form.type === t.key ? '#1a3f6f' : '#e8e7e1'}`, background: form.type === t.key ? '#EEF3FB' : 'white', color: form.type === t.key ? '#1a3f6f' : '#666', fontSize: 11, cursor: 'pointer' }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Canal d'envoi *</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(canaux || {}).map(([key, c]) => (
                    <button key={key} type="button" onClick={() => set('canal', key)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${form.canal === key ? '#1a3f6f' : '#e8e7e1'}`, background: form.canal === key ? '#EEF3FB' : 'white', color: form.canal === key ? '#1a3f6f' : '#666', fontSize: 12, cursor: 'pointer' }}>
                      {CANAL_ICON[key] || '📋'} {c.label}
                    </button>
                  ))}
                </div>
                {canalInfo?.mode === 'manuel' && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#BA7517', background: '#FAEEDA', borderRadius: 6, padding: '6px 10px' }}>
                    ⚠ Aucun compte API configuré pour ce canal — vous enverrez vous-même chaque message (lien pré-rempli ou texte à copier), puis vous marquez chaque envoi comme fait.
                  </div>
                )}
                {canalInfo?.mode === 'api' && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#27500A', background: '#EAF3DE', borderRadius: 6, padding: '6px 10px' }}>
                    ✓ Compte configuré — les messages seront envoyés automatiquement.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Étape 2 : destinataires */}
          {etape === 2 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="label" style={{ margin: 0 }}>Destinataires ({nbSelectionnes} sélectionné{nbSelectionnes > 1 ? 's' : ''})</label>
                <button type="button" onClick={selectionnerTous} style={{ fontSize: 11, color: '#1a3f6f', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Tout sélectionner ({filtres.length})
                </button>
              </div>
              <input className="input" placeholder="Rechercher un nom ou un numéro..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 10 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
                {filtres.map(p => (
                  <div key={p.id} onClick={() => toggleSelection(p)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: selectionnes[p.id] ? '#EEF3FB' : 'white', border: '0.5px solid #e8e7e1' }}>
                    <input type="checkbox" checked={!!selectionnes[p.id]} onChange={() => {}} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{p.prenom} {p.nom}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{p.telephone} {p.email ? `· ${p.email}` : ''}</div>
                    </div>
                  </div>
                ))}
                {filtres.length === 0 && <div style={{ textAlign: 'center', color: '#888', padding: 20, fontSize: 12 }}>Aucun contact trouvé</div>}
              </div>
            </div>
          )}

          {/* Étape 3 : message */}
          {etape === 3 && (
            <div>
              <label className="label">Message *</label>
              <textarea value={form.message} onChange={e => set('message', e.target.value)}
                placeholder="Bonjour {prenom}, ..."
                style={{ width: '100%', minHeight: 140, padding: '10px 12px', border: '0.5px solid #e8e7e1', borderRadius: 8, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
                Utilisez <code>{'{prenom}'}</code> dans le texte — il sera remplacé automatiquement par le prénom de chaque destinataire.
              </div>
              {form.message && (
                <div style={{ marginTop: 12, background: '#F7F7F5', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#444' }}>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 4, fontWeight: 600 }}>APERÇU (premier destinataire)</div>
                  {form.message.replace(/\{prenom\}/gi, Object.values(selectionnes)[0]?.nom?.split(' ')[0] || 'Prénom')}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 18 }}>
          <button className="btn btn-ghost btn-sm" onClick={etape === 1 ? onClose : () => setEtape(etape - 1)}>
            {etape === 1 ? 'Annuler' : '← Retour'}
          </button>
          {etape < 3 ? (
            <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none' }}
              disabled={etape === 1 ? !peutContinuer1 : !peutContinuer2}
              onClick={() => setEtape(etape + 1)}>
              Continuer →
            </button>
          ) : (
            <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none' }}
              disabled={!peutEnvoyer || loading}
              onClick={() => onSave({ ...form, destinataires: Object.values(selectionnes) })}>
              {loading ? '...' : `Créer la campagne (${nbSelectionnes})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal Détail campagne — suivi des envois ────────────────────────────────
function ModalDetailCampagne({ campagneId, onClose, showToast }) {
  const qc = useQueryClient();
  const { data: campagne } = useQuery({
    queryKey: ['campagne', campagneId],
    queryFn: () => toptelsigAPI.campagne(campagneId),
    refetchInterval: 5000,
  });

  const marquerMut = useMutation({
    mutationFn: ({ envoiId, statut }) => toptelsigAPI.updateEnvoiCampagne(campagneId, envoiId, { statut }),
    onSuccess: () => qc.invalidateQueries(['campagne', campagneId]),
    onError: e => showToast(e?.response?.data?.error || 'Erreur', 'error'),
  });

  if (!campagne) return null;

  const lienWhatsApp = (telephone, message) => {
    const tel = (telephone || '').replace(/[\s\-+]/g, '').replace(/^0/, '225');
    return `https://wa.me/${tel}?text=${encodeURIComponent(message)}`;
  };
  const copier = (texte) => navigator.clipboard?.writeText(texte);

  const envois = campagne.envois || [];
  const enAttente = envois.filter(e => e.statut === 'EN_ATTENTE').length;
  const envoyes = envois.filter(e => e.statut === 'ENVOYE').length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>{CANAL_ICON[campagne.canal]} {campagne.nom}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>
          {envoyes}/{envois.length} envoyé(s) · {enAttente} en attente
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {envois.map(e => (
            <div key={e.id} style={{ border: '0.5px solid #e8e7e1', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontWeight: 600, fontSize: 12 }}>{e.nom}</div>
                {e.statut === 'ENVOYE' && <span className="badge badge-green" style={{ fontSize: 10 }}>✓ Envoyé</span>}
                {e.statut === 'EN_ATTENTE' && <span className="badge badge-gray" style={{ fontSize: 10 }}>En attente</span>}
                {e.statut === 'ECHEC' && <span className="badge badge-red" style={{ fontSize: 10 }}>Échec</span>}
              </div>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>{e.messagePersonnalise}</div>
              {e.statut === 'EN_ATTENTE' && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {campagne.canal === 'whatsapp' && e.telephone && (
                    <a href={lienWhatsApp(e.telephone, e.messagePersonnalise)} target="_blank" rel="noreferrer"
                      onClick={() => marquerMut.mutate({ envoiId: e.id, statut: 'ENVOYE' })}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 14, background: '#25D366', color: 'white', fontSize: 10, fontWeight: 600, textDecoration: 'none' }}>
                      💬 Envoyer
                    </a>
                  )}
                  {e.telephone && (
                    <a href={`tel:${e.telephone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 14, border: '1px solid #e8e7e1', color: '#1a3f6f', fontSize: 10, textDecoration: 'none' }}>
                      <Phone size={10} /> Appeler
                    </a>
                  )}
                  <button type="button" onClick={() => copier(e.messagePersonnalise)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 14, border: '1px solid #e8e7e1', background: 'white', color: '#666', fontSize: 10, cursor: 'pointer' }}>
                    <Copy size={10} /> Copier
                  </button>
                  <button type="button" onClick={() => marquerMut.mutate({ envoiId: e.id, statut: 'ENVOYE' })}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 14, border: 'none', background: '#EAF3DE', color: '#27500A', fontSize: 10, cursor: 'pointer' }}>
                    <CheckCircle size={10} /> Marquer fait
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ──────────────────────────────────────────────────────────
export default function CampagnesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [toast, setToast] = useState(null);
  const showToast = (msg, t = 'success') => { setToast({ msg, t }); setTimeout(() => setToast(null), 3500); };

  const { data: canaux } = useQuery({ queryKey: ['campagnes-canaux'], queryFn: toptelsigAPI.campagnesCanaux, staleTime: 5 * 60000 });
  const { data: campagnes = [], isLoading } = useQuery({ queryKey: ['campagnes'], queryFn: () => toptelsigAPI.campagnes({}) });

  const createMut = useMutation({
    mutationFn: toptelsigAPI.createCampagne,
    onSuccess: (res) => {
      qc.invalidateQueries(['campagnes']);
      setShowCreate(false);
      showToast('Campagne créée ✓');
      setDetailId(res.id); // ouvre directement le détail pour commencer les envois
    },
    onError: e => showToast(e?.response?.data?.error || 'Erreur création campagne', 'error'),
  });

  const annulerMut = useMutation({
    mutationFn: toptelsigAPI.annulerCampagne,
    onSuccess: () => { qc.invalidateQueries(['campagnes']); showToast('Campagne annulée'); },
    onError: e => showToast(e?.response?.data?.error || 'Erreur', 'error'),
  });

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}><Megaphone size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />Campagnes</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>Promotions, annonces et relances groupées</p>
        </div>
        <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none' }} onClick={() => setShowCreate(true)}>
          <Plus size={13} /> Nouvelle campagne
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isLoading && <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Chargement...</div>}
        {!isLoading && campagnes.length === 0 && (
          <div className="empty-state"><p>Aucune campagne pour le moment</p></div>
        )}
        {campagnes.map(c => {
          const s = STATUT_BADGE[c.statut] || STATUT_BADGE.BROUILLON;
          const pct = c.totalDestinataires > 0 ? Math.round(c.totalEnvoyes / c.totalDestinataires * 100) : 0;
          return (
            <div key={c.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setDetailId(c.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14 }}>{CANAL_ICON[c.canal]} {c.nom}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{c.creeParNom} · {new Date(c.createdAt).toLocaleDateString('fr')}</div>
                </div>
                <span className={`badge ${s.badge}`}>{s.label}</span>
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 4 }}>
                  <span>{c.totalEnvoyes}/{c.totalDestinataires} envoyé(s)</span>
                  <span>{pct}%</span>
                </div>
                <div style={{ height: 5, background: '#f0efe9', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#1a3f6f', borderRadius: 3 }} />
                </div>
              </div>
              {c.statut === 'EN_COURS' && (
                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Annuler cette campagne ?')) annulerMut.mutate(c.id); }}
                    style={{ fontSize: 11, color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <XCircle size={11} style={{ verticalAlign: 'middle' }} /> Annuler
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showCreate && (
        <ModalCreateCampagne
          canaux={canaux}
          onClose={() => setShowCreate(false)}
          onSave={(data) => createMut.mutate(data)}
          loading={createMut.isPending}
        />
      )}
      {detailId && (
        <ModalDetailCampagne campagneId={detailId} onClose={() => setDetailId(null)} showToast={showToast} />
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 20, right: 16, background: toast.t === 'error' ? '#A32D2D' : '#27500A', color: 'white', padding: '10px 18px', borderRadius: 10, fontSize: 13, zIndex: 9999 }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
