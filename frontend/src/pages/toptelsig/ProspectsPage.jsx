import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toptelsigAPI } from '../../lib/api';
import { Plus, X, Phone, Mail, MessageSquare, ArrowRight, CheckCircle, Clock } from 'lucide-react';

const STATUTS_CRM = {
  PROSPECT:   { badge: 'badge-amber', label: 'Prospect', icon: '🎯' },
  CONTACTE:   { badge: 'badge-blue', label: 'Contacté', icon: '📞' },
  INTERESSE:  { badge: 'badge-toptelsig', label: 'Intéressé', icon: '✨' },
  NEGOCIE:    { badge: 'badge-liya', label: 'En négociation', icon: '🤝' },
  CLIENT:     { badge: 'badge-green', label: 'Client', icon: '✅' },
  PERDU:      { badge: 'badge-gray', label: 'Perdu', icon: '❌' },
};

const CANAL_CONTACT = ['Appel téléphonique', 'WhatsApp', 'Email', 'Visite bureau', 'Recommandation', 'Réseau social', 'Salon immobilier'];

function HistoriquePanel({ souscripteurId, onClose }) {
  const [newNote, setNewNote] = useState('');
  const [canal, setCanal] = useState(CANAL_CONTACT[0]);
  const [saving, setSaving] = useState(false);

  // Simulation historique local (en production : auditLogs filtré par entiteId)
  const { data: logs = [] } = useQuery({
    queryKey: ['historique-crm', souscripteurId],
    queryFn: () => toptelsigAPI.historiqueContact?.(souscripteurId) || Promise.resolve([]),
    staleTime: 30000,
  });

  const handleSave = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      await toptelsigAPI.addContact?.(souscripteurId, { canal, note: newNote, date: new Date().toISOString() });
      setNewNote('');
    } catch {}
    setSaving(false);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {/* Ajouter un contact */}
      <div style={{ background:'#F7F7F5', borderRadius:8, padding:12 }}>
        <div style={{ fontSize:12, fontWeight:600, marginBottom:8 }}>➕ Ajouter un échange</div>
        <div style={{ display:'flex', gap:8, marginBottom:8 }}>
          <select className="input" style={{ fontSize:11 }} value={canal} onChange={e=>setCanal(e.target.value)}>
            {CANAL_CONTACT.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" disabled={!newNote.trim() || saving}
            style={{ background:'#1a3f6f', border:'none', flexShrink:0 }} onClick={handleSave}>
            {saving ? '...' : 'Enregistrer'}
          </button>
        </div>
        <textarea value={newNote} onChange={e=>setNewNote(e.target.value)}
          placeholder="Résumé de l'échange, décisions prises, prochaines étapes..."
          style={{ width:'100%', padding:'8px 10px', border:'0.5px solid #ddd', borderRadius:8, fontSize:12, resize:'vertical', minHeight:60, fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
      </div>

      {/* Historique */}
      {logs.length === 0 ? (
        <div style={{ textAlign:'center', color:'#aaa', fontSize:12, padding:20 }}>
          Aucun échange enregistré — ajoutez le premier contact ci-dessus
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {logs.map((log, i) => (
            <div key={i} style={{ background:'white', border:'0.5px solid #e8e7e1', borderRadius:8, padding:'10px 12px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:11, fontWeight:600, color:'#1a3f6f' }}>{log.canal}</span>
                <span style={{ fontSize:10, color:'#888' }}>{new Date(log.date).toLocaleString('fr')}</span>
              </div>
              <div style={{ fontSize:12, color:'#333' }}>{log.note}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProspectsPage() {
  const qc = useQueryClient();
  const [statutFilter, setStatutFilter] = useState('PROSPECT');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showHistorique, setShowHistorique] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['souscripteurs-crm', statutFilter],
    queryFn: () => toptelsigAPI.souscripteurs({ statut: statutFilter || undefined, limit: 200 }),
  });
  const prospects = Array.isArray(data) ? data : (data?.data || []);

  const updateStatut = useMutation({
    mutationFn: ({ id, statut }) => toptelsigAPI.updateSouscripteur(id, { statut }),
    onSuccess: () => qc.invalidateQueries(['souscripteurs-crm']),
  });

  const convertirClient = useMutation({
    mutationFn: (id) => toptelsigAPI.updateSouscripteur(id, { statut: 'CLIENT' }),
    onSuccess: () => { qc.invalidateQueries(['souscripteurs-crm']); alert('✅ Prospect converti en client ! Créez maintenant une vente dans Ventes & Échéanciers.'); },
  });

  const createProspect = useMutation({
    mutationFn: toptelsigAPI.createSouscripteur,
    onSuccess: () => { qc.invalidateQueries(['souscripteurs-crm']); setShowCreate(false); },
  });

  const filtered = prospects.filter(p =>
    !search || `${p.nom} ${p.prenom} ${p.telephone} ${p.email || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const nbParStatut = Object.keys(STATUTS_CRM).reduce((acc, s) => {
    acc[s] = prospects.filter(p => p.statut === s).length;
    return acc;
  }, {});

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20, color:'#1a3f6f' }}>
            🎯 CRM — Prospects & Clients
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>Suivi des prospects et historique des échanges</p>
        </div>
        <button className="btn btn-primary btn-sm" style={{ background:'#1a3f6f', border:'none' }} onClick={() => setShowCreate(true)}>
          <Plus size={13} /> Nouveau prospect
        </button>
      </div>

      {/* Pipeline statuts */}
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {Object.entries(STATUTS_CRM).map(([key, val]) => (
          <button key={key} onClick={() => setStatutFilter(statutFilter === key ? '' : key)}
            className={`filter-btn ${statutFilter === key ? 'active' : ''}`}
            style={{ display:'flex', alignItems:'center', gap:5 }}>
            {val.icon} {val.label}
            {nbParStatut[key] > 0 && (
              <span style={{ background: statutFilter === key ? 'white' : '#1a3f6f', color: statutFilter === key ? '#1a3f6f' : 'white', borderRadius:10, padding:'0 6px', fontSize:10, fontWeight:600 }}>
                {nbParStatut[key]}
              </span>
            )}
          </button>
        ))}
        <input className="input" style={{ marginLeft:'auto', width:200 }} placeholder="🔍 Rechercher..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Grille prospects */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:10 }}>
        {isLoading && <div className="loading">Chargement...</div>}
        {filtered.map(p => {
          const st = STATUTS_CRM[p.statut] || STATUTS_CRM.PROSPECT;
          return (
            <div key={p.id} style={{ background:'white', border:'0.5px solid #e8e7e1', borderRadius:10, padding:14,
              boxShadow: selected === p.id ? '0 0 0 2px #1a3f6f' : 'none', cursor:'pointer' }}
              onClick={() => setSelected(selected === p.id ? null : p.id)}>

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13 }}>{p.prenom} {p.nom}</div>
                  <div style={{ fontSize:11, color:'#888' }}>{p.profession || 'Particulier'}</div>
                </div>
                <span className={`badge ${st.badge}`} style={{ fontSize:10 }}>{st.label}</span>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:3, marginBottom:10 }}>
                <div style={{ fontSize:11, display:'flex', alignItems:'center', gap:5 }}>
                  <Phone size={10} color="#888" /> {p.telephone}
                </div>
                {p.email && (
                  <div style={{ fontSize:11, display:'flex', alignItems:'center', gap:5, color:'#888' }}>
                    <Mail size={10} color="#888" /> {p.email}
                  </div>
                )}
              </div>

              {/* Actions */}
              {selected === p.id && (
                <div style={{ borderTop:'0.5px solid #f0efe9', paddingTop:10 }} onClick={e=>e.stopPropagation()}>
                  {/* Changer statut */}
                  <div style={{ marginBottom:8 }}>
                    <label style={{ fontSize:10, color:'#888', display:'block', marginBottom:3 }}>Avancement pipeline</label>
                    <select className="input" style={{ fontSize:11 }} value={p.statut}
                      onChange={e => updateStatut.mutate({ id:p.id, statut:e.target.value })}>
                      {Object.entries(STATUTS_CRM).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                    </select>
                  </div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => setShowHistorique(p)}>
                      <MessageSquare size={11} /> Historique
                    </button>
                    {p.statut !== 'CLIENT' && (
                      <button className="btn btn-xs" style={{ background:'#1a3f6f', color:'white', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', gap:4 }}
                        onClick={() => convertirClient.mutate(p.id)}>
                        <ArrowRight size={11} /> Convertir en client
                      </button>
                    )}
                    {p.statut === 'CLIENT' && (
                      <span style={{ fontSize:11, color:'#27500A', display:'flex', alignItems:'center', gap:4 }}>
                        <CheckCircle size={11} /> Client actif
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <div style={{ gridColumn:'1/-1' }} className="empty-state">
            <p>Aucun {STATUTS_CRM[statutFilter]?.label?.toLowerCase() || 'contact'} trouvé</p>
          </div>
        )}
      </div>

      {/* Modal historique */}
      {showHistorique && (
        <div className="modal-overlay" onClick={() => setShowHistorique(null)}>
          <div className="modal" style={{ maxWidth:500 }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <h3 style={{ margin:0, fontFamily:'Syne', fontSize:15 }}>
                📞 Historique — {showHistorique.prenom} {showHistorique.nom}
              </h3>
              <button onClick={() => setShowHistorique(null)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18} /></button>
            </div>
            <HistoriquePanel souscripteurId={showHistorique.id} onClose={() => setShowHistorique(null)} />
          </div>
        </div>
      )}

      {/* Modal créer prospect */}
      {showCreate && (
        <ModalCreateProspect onClose={() => setShowCreate(false)} onSave={createProspect.mutate} loading={createProspect.isPending} />
      )}
    </div>
  );
}

function ModalCreateProspect({ onClose, onSave, loading }) {
  const [form, setForm] = useState({ nom:'', prenom:'', telephone:'', email:'', adresse:'', profession:'', numeroCni:'', statut:'PROSPECT' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:460 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:15 }}>🎯 Nouveau prospect</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18} /></button>
        </div>
        <div className="form-grid">
          <div><label className="label">Prénom *</label><input className="input" value={form.prenom} onChange={e=>set('prenom',e.target.value)} /></div>
          <div><label className="label">Nom *</label><input className="input" value={form.nom} onChange={e=>set('nom',e.target.value)} /></div>
          <div><label className="label">Téléphone *</label><input className="input" value={form.telephone} onChange={e=>set('telephone',e.target.value)} /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e=>set('email',e.target.value)} /></div>
          <div className="full"><label className="label">Profession</label><input className="input" value={form.profession} onChange={e=>set('profession',e.target.value)} /></div>
          <div className="full"><label className="label">Adresse</label><input className="input" value={form.adresse} onChange={e=>set('adresse',e.target.value)} /></div>
          <div>
            <label className="label">Statut initial</label>
            <select className="input" value={form.statut} onChange={e=>set('statut',e.target.value)}>
              {['PROSPECT','CONTACTE','INTERESSE'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={!form.nom||!form.prenom||!form.telephone||loading}
            style={{ background:'#1a3f6f', border:'none' }}
            onClick={() => onSave({ ...form, code: `PROS-${Date.now().toString(36).toUpperCase().slice(-5)}` })}>
            {loading ? 'Création...' : 'Créer le prospect'}
          </button>
        </div>
      </div>
    </div>
  );
}
