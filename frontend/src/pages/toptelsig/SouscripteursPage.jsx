/**
 * TOPTELSIG — Souscripteurs
 * Règle : Souscripteur = contact ayant effectué AU MOINS UN paiement
 * CRM = Prospects sans paiement
 * Statuts par projet, pas globalement
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toptelsigAPI, facturationAPI } from '../../lib/api';
import {
  Plus, X, Search, ChevronRight, Download, Eye,
  Phone, MessageSquare, FileText, RefreshCw, Filter
} from 'lucide-react';
import ExportBar from '../../components/ui/ExportBar';
import DocumentViewer from '../../components/ui/DocumentViewer';
import { exportExcel } from '../../lib/export';

const fmtF = n => n >= 1000000 ? `${(n/1000000).toFixed(2)}M F` : n >= 1000 ? `${Math.round(n/1000)}k F` : `${Math.round(n||0)} F`;
const fmtD = d => d ? new Date(d).toLocaleDateString('fr', { day:'2-digit', month:'short', year:'numeric' }) : '—';

const STATUT_CONFIG = {
  ACTIF:      { label:'Paiement en cours',    color:'#27500A', bg:'#EAF3DE' },
  EN_RETARD:  { label:'En retard',            color:'#A32D2D', bg:'#FCEBEB' },
  SUSPENDU:   { label:'Suspendu',             color:'#888',    bg:'#F7F7F5' },
  SOLDE:      { label:'Soldé',               color:'#27500A', bg:'#EAF3DE' },
  ANNULE:     { label:'Annulé',              color:'#A32D2D', bg:'#FCEBEB' },
  LITIGE:     { label:'Litige',              color:'#BA7517', bg:'#FAEEDA' },
};

// Déterminer le statut affiché depuis statutCalc
function getStatutDisplay(s) {
  const sc = s.statutCalc || s.statut;
  if (sc === 'SOLDE') return STATUT_CONFIG.SOLDE;
  if (sc === 'EN_RETARD') return STATUT_CONFIG.EN_RETARD;
  return STATUT_CONFIG[sc] || STATUT_CONFIG.ACTIF;
}

// ── Modal paiement ────────────────────────────────────────────────────────────
function ModalPaiement({ souscripteur, onClose, onSave, loading }) {
  const ventes = souscripteur?.ventes || [];
  const [form, setForm] = useState({
    montant: '', typePaiement: 'ORANGE_MONEY', reference: '',
    venteId: ventes[0]?.id || '', echeancierId: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const vente = ventes.find(v => v.id === form.venteId);
  const echeancesOuvertes = vente?.echeanciers?.filter(e => ['EN_ATTENTE','RETARD','PARTIEL'].includes(e.statut)) || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:460 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:16, color:'#1a3f6f' }}>
            💳 Enregistrer un paiement
          </h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
        </div>

        <div style={{ background:'#EEF3FB', borderRadius:8, padding:'8px 14px', marginBottom:14, fontSize:12, color:'#1a3f6f' }}>
          👤 {souscripteur.prenom} {souscripteur.nom} · {souscripteur.telephone}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div>
            <label className="label">Vente / Lot *</label>
            <select className="input" value={form.venteId} onChange={e => { set('venteId', e.target.value); set('echeancierId', ''); }}>
              {ventes.map(v => (
                <option key={v.id} value={v.id}>
                  Lot {v.lot?.numero} — {v.lot?.projet?.nom} — {fmtF(v.prixVente)}
                </option>
              ))}
            </select>
          </div>

          {echeancesOuvertes.length > 0 && (
            <div>
              <label className="label">Échéance concernée</label>
              <select className="input" value={form.echeancierId} onChange={e => {
                set('echeancierId', e.target.value);
                const ech = echeancesOuvertes.find(x => x.id === e.target.value);
                if (ech) set('montant', ech.montant - (ech.montantPaye||0));
              }}>
                <option value="">— Paiement libre</option>
                {echeancesOuvertes.map(e => (
                  <option key={e.id} value={e.id}>
                    Éch. #{e.numero} · {fmtF(e.montant - (e.montantPaye||0))} restant · {fmtD(e.dateEcheance)}
                    {e.statut === 'RETARD' ? ' ⚠ RETARD' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">Montant (FCFA) *</label>
            <input className="input" type="number" min={1} value={form.montant} onChange={e => set('montant', e.target.value)} placeholder="0"/>
          </div>

          <div>
            <label className="label">Mode de paiement *</label>
            <select className="input" value={form.typePaiement} onChange={e => set('typePaiement', e.target.value)}>
              {['ESPECES','ORANGE_MONEY','MTN_MONEY','MOOV_MONEY','WAVE','BANQUE'].map(t => (
                <option key={t} value={t}>{t.replace(/_/g,' ')}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Référence / N° transaction</label>
            <input className="input" value={form.reference} onChange={e => set('reference', e.target.value)} placeholder="Optionnel"/>
          </div>
        </div>

        <div style={{ display:'flex', gap:8, marginTop:18, justifyContent:'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" style={{ background:'#1a3f6f', border:'none' }}
            disabled={!form.venteId || !form.montant || loading}
            onClick={() => onSave({ ...form, montant: Number(form.montant) })}>
            {loading ? 'Enregistrement...' : '✓ Enregistrer le paiement'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vue 360° souscripteur (inline panel) ────────────────────────────────────
function FicheSouscripteur360({ s, onClose, onAddPaiement }) {
  const navigate = useNavigate();
  const [onglet, setOnglet] = useState('situation');
  const [docViewer, setDocViewer] = useState(null);
  const [genLoading, setGenLoading] = useState('');

  const genererDoc = async (type, venteId) => {
    const vente = s.ventes?.find(v => v.id === venteId) || s.ventes?.[0];
    if (!vente?.lot?.id) return;
    setGenLoading(type);
    try {
      const doc = await facturationAPI.generer(vente.lot.id, type);
      setDocViewer({ ...doc, client: s });
    } catch(e) { alert('Erreur: ' + (e?.error || e.message)); }
    finally { setGenLoading(''); }
  };

  const totalPaye = s.totalPaye || 0;
  const totalDu = s.totalDu || 0;
  const restant = s.restant || 0;
  const pct = s.tauxPaiement || 0;
  const sc = getStatutDisplay(s);

  const tel = (s.telephone||'').replace(/[\s\-+]/g,'').replace(/^0/,'225');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:700, maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'0.5px solid #e8e7e1', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:20, marginBottom:4 }}>
              {s.prenom} {s.nom}
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              <span style={{ fontSize:11, background:sc.bg, color:sc.color, borderRadius:10, padding:'2px 10px', fontWeight:600 }}>
                {sc.label}
              </span>
              <span style={{ fontSize:11, color:'#888' }}>{s.code}</span>
              <span style={{ fontSize:11, color:'#888' }}>{s.telephone}</span>
            </div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <a href={`tel:${s.telephone}`} style={{ padding:'5px 10px', borderRadius:7, background:'#EAF3DE', color:'#27500A', textDecoration:'none', fontSize:11 }}>📞</a>
            <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer" style={{ padding:'5px 10px', borderRadius:7, background:'#E8F9EF', color:'#25D366', textDecoration:'none', fontSize:11 }}>💬</a>
            <button onClick={() => navigate(`/toptelsig/souscripteurs/${s.id}`)}
              style={{ padding:'5px 10px', borderRadius:7, background:'#EEF3FB', color:'#1a3f6f', border:'none', cursor:'pointer', fontSize:11 }}>
              🔍 Fiche complète
            </button>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
          </div>
        </div>

        {/* Onglets */}
        <div style={{ display:'flex', gap:0, borderBottom:'0.5px solid #e8e7e1', flexShrink:0 }}>
          {[
            ['situation','💰 Situation'],
            ['lots','🏘 Projets/Lots'],
            ['echeancier','📅 Échéancier'],
            ['paiements','🧾 Paiements'],
            ['actions','⚡ Actions'],
          ].map(([k,v]) => (
            <button key={k} onClick={() => setOnglet(k)}
              style={{ padding:'8px 14px', border:'none', background:'none', cursor:'pointer', fontSize:11,
                fontWeight:onglet===k?600:400, color:onglet===k?'#1a3f6f':'#888',
                borderBottom:onglet===k?'2px solid #1a3f6f':'2px solid transparent' }}>
              {v}
            </button>
          ))}
        </div>

        {/* Contenu onglets */}
        <div style={{ flex:1, overflowY:'auto', padding:20 }}>

          {/* Situation financière */}
          {onglet === 'situation' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10, marginBottom:16 }}>
                {[
                  { label:'Prix total', value:fmtF(totalDu), color:'#1a3f6f' },
                  { label:'Montant payé', value:fmtF(totalPaye), color:'#27500A' },
                  { label:'Reste à payer', value:fmtF(restant), color:restant>0?'#A32D2D':'#27500A' },
                  { label:'Taux paiement', value:`${pct}%`, color:pct>=100?'#27500A':pct>=50?'#BA7517':'#A32D2D' },
                ].map((k,i) => (
                  <div key={i} className="kpi" style={{ borderTop:`3px solid ${k.color}` }}>
                    <div className="kpi-label">{k.label}</div>
                    <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:18, color:k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>
              {/* Barre de progression */}
              <div style={{ background:'#F7F7F5', borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#888', marginBottom:6 }}>
                  <span>Progression globale</span>
                  <span style={{ fontWeight:600 }}>{pct}%</span>
                </div>
                <div style={{ height:10, background:'#e8e7e1', borderRadius:5 }}>
                  <div style={{ height:'100%', width:`${Math.min(pct,100)}%`, background:pct>=100?'#27500A':pct>=50?'#1a3f6f':'#BA7517', borderRadius:5, transition:'width 0.5s' }}/>
                </div>
              </div>
              {/* Infos client */}
              <div style={{ background:'#F7F7F5', borderRadius:8, padding:'12px 16px' }}>
                <div style={{ fontFamily:'Syne', fontWeight:600, fontSize:12, marginBottom:8, color:'#888' }}>INFORMATIONS CLIENT</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12 }}>
                  {[
                    ['Téléphone', s.telephone],
                    ['Email', s.email||'—'],
                    ['Adresse', s.adresse||'—'],
                    ['Profession', s.profession||'—'],
                    ['CNI', s.numeroCni||'—'],
                    ['Commercial', s.commercialNom||'—'],
                    ['Source', s.sourceAcquisition||'—'],
                    ['Date inscription', fmtD(s.createdAt)],
                  ].map(([k,v],i) => (
                    <div key={i}><span style={{ color:'#888' }}>{k} : </span><strong>{v}</strong></div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Projets / Lots (vue multi-projets) */}
          {onglet === 'lots' && (
            <div>
              <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14, marginBottom:12 }}>
                Engagement par projet ({s.ventes?.length || 0} projet(s))
              </div>
              {(s.ventes||[]).map(v => {
                const pmts = v.paiements || [];
                const tPaye = pmts.reduce((s,p) => s+p.montant, 0);
                const tRestant = v.prixVente - tPaye;
                const tPct = v.prixVente > 0 ? Math.round(tPaye/v.prixVente*100) : 0;
                const enRetard = v.echeanciers?.some(e => e.statut === 'RETARD');
                return (
                  <div key={v.id} style={{ background:'white', border:`1.5px solid ${enRetard?'#F7C1C1':'#e8e7e1'}`, borderRadius:10, padding:'14px 16px', marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14 }}>📍 {v.lot?.projet?.nom}</div>
                        <div style={{ fontSize:11, color:'#888' }}>Lot {v.lot?.numero}{v.lot?.ilot?` — Îlot ${v.lot.ilot}`:''} · {(v.lot?.superficie||0).toLocaleString('fr')} m²</div>
                      </div>
                      <span style={{ fontSize:11, background:v.statut==='SOLDE'?'#EAF3DE':enRetard?'#FCEBEB':'#EEF3FB', color:v.statut==='SOLDE'?'#27500A':enRetard?'#A32D2D':'#1a3f6f', borderRadius:10, padding:'3px 10px', fontWeight:600, height:'fit-content' }}>
                        {v.statut==='SOLDE'?'✅ Soldé':enRetard?'⚠ Retard':'En cours'}
                      </span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:8, fontSize:12 }}>
                      <div><span style={{ color:'#888' }}>Prix : </span><strong>{fmtF(v.prixVente)}</strong></div>
                      <div><span style={{ color:'#888' }}>Payé : </span><strong style={{ color:'#27500A' }}>{fmtF(tPaye)}</strong></div>
                      <div><span style={{ color:'#888' }}>Restant : </span><strong style={{ color:tRestant>0?'#A32D2D':'#27500A' }}>{fmtF(tRestant)}</strong></div>
                    </div>
                    <div style={{ height:6, background:'#F7F7F5', borderRadius:3 }}>
                      <div style={{ height:'100%', width:`${tPct}%`, background:tPct>=100?'#27500A':'#1a3f6f', borderRadius:3 }}/>
                    </div>
                    <div style={{ fontSize:10, color:'#888', textAlign:'right', marginTop:2 }}>{tPct}%</div>
                  </div>
                );
              })}
              {(!s.ventes||s.ventes.length===0) && <div className="empty-state"><p>Aucune vente enregistrée</p></div>}
            </div>
          )}

          {/* Échéancier */}
          {onglet === 'echeancier' && (
            <div>
              {(s.ventes||[]).map(v => (
                <div key={v.id} style={{ marginBottom:20 }}>
                  <div style={{ fontFamily:'Syne', fontWeight:600, fontSize:13, marginBottom:8 }}>
                    Lot {v.lot?.numero} — {v.lot?.projet?.nom}
                  </div>
                  <table className="table-erp">
                    <thead>
                      <tr><th>#</th><th>Échéance</th><th>Montant prévu</th><th>Payé</th><th>Restant</th><th>Statut</th></tr>
                    </thead>
                    <tbody>
                      {(v.echeanciers||[]).map(e => {
                        const retard = e.statut === 'RETARD';
                        return (
                          <tr key={e.id} style={{ background:retard?'#FDF2F2':e.statut==='PAYE'?'#F5FAF0':undefined }}>
                            <td style={{ fontWeight:600 }}>#{e.numero}</td>
                            <td style={{ fontSize:12 }}>{fmtD(e.dateEcheance)}</td>
                            <td style={{ fontWeight:600 }}>{fmtF(e.montant)}</td>
                            <td style={{ color:'#27500A', fontWeight:500 }}>{fmtF(e.montantPaye||0)}</td>
                            <td style={{ color:e.statut==='PAYE'?'#888':'#A32D2D' }}>
                              {e.statut==='PAYE' ? '—' : fmtF(e.montant-(e.montantPaye||0))}
                            </td>
                            <td>
                              <span style={{ fontSize:10, fontWeight:600,
                                color:e.statut==='PAYE'?'#27500A':retard?'#A32D2D':e.statut==='PARTIEL'?'#BA7517':'#888' }}>
                                {retard?'⚠ RETARD':e.statut==='PAYE'?'✅ Payé':e.statut==='PARTIEL'?'Partiel':'En attente'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {(!v.echeanciers||v.echeanciers.length===0) && (
                        <tr><td colSpan={6}><div className="empty-state" style={{ padding:12 }}><p style={{ fontSize:12 }}>Aucun échéancier</p></div></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* Historique paiements */}
          {onglet === 'paiements' && (
            <div>
              <table className="table-erp">
                <thead>
                  <tr><th>Date</th><th>Lot / Projet</th><th>Mode</th><th>Référence</th><th style={{ textAlign:'right' }}>Montant</th></tr>
                </thead>
                <tbody>
                  {(s.ventes||[]).flatMap(v =>
                    (v.paiements||[]).map(p => ({ ...p, lot: v.lot }))
                  ).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).map(p => (
                    <tr key={p.id}>
                      <td style={{ fontSize:11 }}>{fmtD(p.createdAt)}</td>
                      <td style={{ fontSize:11 }}>Lot {p.lot?.numero} · {p.lot?.projet?.nom}</td>
                      <td style={{ fontSize:11 }}>{p.typePaiement?.replace(/_/g,' ')}</td>
                      <td style={{ fontSize:11, color:'#888' }}>{p.reference||'—'}</td>
                      <td style={{ textAlign:'right', fontWeight:700, color:'#27500A' }}>{fmtF(p.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(s.ventes||[]).flatMap(v => v.paiements||[]).length === 0 && (
                <div className="empty-state"><p>Aucun paiement</p></div>
              )}
            </div>
          )}

          {/* Actions */}
          {onglet === 'actions' && (
            <div>
              <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:13, marginBottom:14 }}>⚡ Actions rapides</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[
                  { label:'➕ Ajouter un paiement', color:'#1a3f6f', bg:'#EEF3FB', action:() => onAddPaiement(s) },
                  { label:'🔍 Voir la fiche complète', color:'#27500A', bg:'#EAF3DE', action:() => { onClose(); navigate(`/toptelsig/souscripteurs/${s.id}`); } },
                  { label:'🧾 Générer une facture', color:'#8B1A1A', bg:'#FDF2F2', action:() => genererDoc('FACTURE', s.ventes?.[0]?.id), disabled: !s.ventes?.length },
                  { label:'📊 Situation client', color:'#BA7517', bg:'#FAEEDA', action:() => genererDoc('SITUATION', s.ventes?.[0]?.id), disabled: !s.ventes?.length },
                  { label:'🧾 Générer un reçu', color:'#5F5E5A', bg:'#F7F7F5', action:() => genererDoc('RECU', s.ventes?.[0]?.id), disabled: !(s.ventes?.flatMap(v=>v.paiements||[]).length > 0) },
                  { label:'💬 WhatsApp', color:'#25D366', bg:'#E8F9EF', action:() => window.open(`https://wa.me/${tel}`, '_blank') },
                  { label:'📞 Appeler', color:'#27500A', bg:'#EAF3DE', action:() => window.open(`tel:${s.telephone}`) },
                  { label:'📧 Email', color:'#1a3f6f', bg:'#EEF3FB', action:() => window.open(`mailto:${s.email||''}`) },
                ].map((btn,i) => (
                  <button key={i} disabled={btn.disabled||false}
                    style={{ padding:'14px', borderRadius:10, border:`1px solid ${btn.color}20`, background:btn.bg, color:btn.color, cursor:btn.disabled?'not-allowed':'pointer', fontSize:12, fontWeight:600, opacity:btn.disabled?0.5:1, textAlign:'left' }}
                    onClick={btn.action}>
                    {genLoading&&btn.label.includes('Générer')?'⏳ Génération...':btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {docViewer && <DocumentViewer document={docViewer} client={s} onClose={() => setDocViewer(null)}/>}
    </div>
  );
}

// ── PAGE PRINCIPALE ───────────────────────────────────────────────────────────
export function SouscripteursPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [projetFilter, setProjetFilter] = useState('');
  const [statutFilter, setStatutFilter] = useState('');
  const [commercialFilter, setCommercialFilter] = useState('');
  const [view360, setView360] = useState(null);
  const [paiementFor, setPaiementFor] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = (msg,t='success') => { setToast({msg,t}); setTimeout(()=>setToast(null),3000); };

  const [form, setForm] = useState({
    nom:'', prenom:'', telephone:'', email:'',
    adresse:'', profession:'', sourceAcquisition:'', commercialNom:'',
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['souscripteurs', search, projetFilter, statutFilter, commercialFilter],
    queryFn: () => toptelsigAPI.souscripteurs({
      search: search||undefined,
      projetId: projetFilter||undefined,
      statut: statutFilter||undefined,
      limit: 100,
    }),
    staleTime: 15000,
  });

  const { data: dashboard } = useQuery({
    queryKey: ['souscripteurs-dashboard', projetFilter],
    queryFn: () => toptelsigAPI.souscripteursDashboard({ projetId: projetFilter||undefined }),
    staleTime: 60000,
  });

  const { data: projets = [] } = useQuery({
    queryKey: ['projets'],
    queryFn: toptelsigAPI.projets,
    staleTime: 300000,
  });

  const createMut = useMutation({
    mutationFn: toptelsigAPI.createSouscripteur,
    onSuccess: () => { qc.invalidateQueries(['souscripteurs']); setShowCreate(false); showToast('Contact créé ✓'); },
    onError: e => showToast(e?.error||'Erreur','error'),
  });

  const paiementMut = useMutation({
    mutationFn: ({ id, data }) => toptelsigAPI.addPaiement(id, data),
    onSuccess: () => {
      qc.invalidateQueries(['souscripteurs']);
      qc.invalidateQueries(['souscripteurs-dashboard']);
      setPaiementFor(null);
      showToast('Paiement enregistré ✓');
    },
    onError: e => showToast(e?.response?.data?.error||'Erreur paiement','error'),
  });

  const list = data?.data || [];
  const kpi = dashboard || {};
  const listeProjets = Array.isArray(projets) ? projets : [];

  const exportCSV = () => {
    const rows = list.map(s => [
      `${s.prenom} ${s.nom}`, s.telephone, s.email||'—',
      s.ventes?.[0]?.lot?.projet?.nom||'—',
      s.ventes?.[0]?.lot?.numero||'—',
      s.commercialNom||'—',
      fmtD(s.premierPaiement),
      s.totalDu||0, s.totalPaye||0, s.restant||0,
      `${s.tauxPaiement||0}%`,
      getStatutDisplay(s).label,
    ]);
    exportExcel('souscripteurs_toptelsig', 'Souscripteurs',
      ['Nom','Téléphone','Email','Projet','Lot','Commercial','1er paiement','Total dû','Payé','Restant','%','Statut'],
      rows
    );
  };

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:22 }}>🏘 Souscripteurs</h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>
            Clients ayant effectué au moins un paiement · {list.length} résultat(s)
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>refetch()}><RefreshCw size={13}/></button>
          <button className="btn btn-ghost btn-sm" onClick={exportCSV}><Download size={13}/> Export</button>
          <button className="btn btn-primary btn-sm" style={{ background:'#1a3f6f', border:'none' }}
            onClick={()=>setShowCreate(true)}>
            <Plus size={13}/> Nouveau contact
          </button>
        </div>
      </div>

      {/* KPI Dashboard */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:20 }}>
        {[
          { label:'Total souscripteurs', value:kpi.nbTotal||0, color:'#1a3f6f', icon:'👥' },
          { label:'Actifs', value:kpi.nbActifs||0, color:'#27500A', icon:'✅' },
          { label:'En retard', value:kpi.nbEnRetard||0, color:'#A32D2D', icon:'⚠' },
          { label:'Soldés', value:kpi.nbSoldes||0, color:'#27500A', icon:'🏆' },
          { label:'Taux recouvrement', value:`${kpi.tauxRecouvrement||0}%`, color:kpi.tauxRecouvrement>=80?'#27500A':kpi.tauxRecouvrement>=50?'#BA7517':'#A32D2D', icon:'📈' },
        ].map((k,i) => (
          <div key={i} className="kpi" style={{ borderTop:`3px solid ${k.color}` }}>
            <div style={{ fontSize:16 }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:20, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Montants KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:20 }}>
        {[
          { label:'Total souscrit', value:fmtF(kpi.totalSouscrit||0), color:'#1a3f6f' },
          { label:'Total encaissé', value:fmtF(kpi.totalEncaisse||0), color:'#27500A' },
          { label:'Restant à encaisser', value:fmtF(kpi.totalRestant||0), color:'#A32D2D' },
        ].map((k,i) => (
          <div key={i} className="kpi" style={{ borderTop:`3px solid ${k.color}` }}>
            <div className="kpi-label">{k.label}</div>
            <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:18, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:6, background:'white', border:'0.5px solid #e8e7e1', borderRadius:8, padding:'5px 12px', flex:1, minWidth:200 }}>
          <Search size={14} color="#888"/>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Nom, téléphone, email, n° lot..."
            style={{ border:'none', outline:'none', fontSize:13, flex:1, background:'transparent' }}/>
        </div>
        <select className="input" style={{ width:180 }} value={projetFilter} onChange={e=>setProjetFilter(e.target.value)}>
          <option value="">Tous les projets</option>
          {listeProjets.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>
        <div style={{ display:'flex', gap:4 }}>
          {[
            ['','Tous'],
            ['ACTIF','Actifs'],
            ['EN_RETARD','En retard'],
            ['SOLDE','Soldés'],
          ].map(([k,v]) => (
            <button key={k} onClick={() => setStatutFilter(k)} className={`filter-btn ${statutFilter===k?'active':''}`}>{v}</button>
          ))}
        </div>
      </div>

      {/* Tableau */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {isLoading ? (
          <div style={{ padding:40, textAlign:'center', color:'#888' }}>Chargement...</div>
        ) : (
          <table className="table-erp">
            <thead>
              <tr>
                <th>Souscripteur</th>
                <th>Téléphone</th>
                <th>Projet · Lot</th>
                <th>Commercial</th>
                <th>1er paiement</th>
                <th style={{ textAlign:'right' }}>Prix lot</th>
                <th style={{ textAlign:'right' }}>Payé</th>
                <th style={{ textAlign:'right' }}>Restant</th>
                <th style={{ textAlign:'center' }}>%</th>
                <th>Proch. échéance</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map(s => {
                const sc = getStatutDisplay(s);
                const prochE = s.prochEcheance;
                const enRetardE = prochE && new Date(prochE.dateEcheance) < new Date() && prochE.statut !== 'PAYE';
                return (
                  <tr key={s.id} style={{ cursor:'pointer' }} onClick={() => setView360(s)}>
                    <td>
                      <div style={{ fontWeight:600, fontSize:13 }}>{s.prenom} {s.nom}</div>
                      <div style={{ fontSize:10, color:'#888' }}>{s.code}</div>
                    </td>
                    <td style={{ fontSize:12 }}>{s.telephone}</td>
                    <td style={{ fontSize:11 }}>
                      {s.ventes?.slice(0,2).map(v => (
                        <div key={v.id}>{v.lot?.projet?.nom} · {v.lot?.numero}</div>
                      ))}
                      {s.ventes?.length > 2 && <div style={{ color:'#888' }}>+{s.ventes.length-2} autre(s)</div>}
                    </td>
                    <td style={{ fontSize:11, color:'#888' }}>{s.commercialNom||'—'}</td>
                    <td style={{ fontSize:11 }}>{fmtD(s.premierPaiement)}</td>
                    <td style={{ textAlign:'right', fontWeight:600 }}>{fmtF(s.totalDu||0)}</td>
                    <td style={{ textAlign:'right', color:'#27500A', fontWeight:600 }}>{fmtF(s.totalPaye||0)}</td>
                    <td style={{ textAlign:'right', color:(s.restant||0)>0?'#A32D2D':'#27500A', fontWeight:600 }}>{fmtF(s.restant||0)}</td>
                    <td style={{ textAlign:'center' }}>
                      <div>
                        <div style={{ height:4, background:'#F7F7F5', borderRadius:2, width:60 }}>
                          <div style={{ height:'100%', width:`${Math.min(s.tauxPaiement||0,100)}%`, background:(s.tauxPaiement||0)>=100?'#27500A':'#1a3f6f', borderRadius:2 }}/>
                        </div>
                        <div style={{ fontSize:10, color:'#888', marginTop:1 }}>{s.tauxPaiement||0}%</div>
                      </div>
                    </td>
                    <td style={{ fontSize:11 }}>
                      {prochE ? (
                        <span style={{ color:enRetardE?'#A32D2D':'#BA7517', fontWeight:enRetardE?600:400 }}>
                          {enRetardE?'⚠ ':'📅 '}{fmtD(prochE.dateEcheance)}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <span style={{ fontSize:10, background:sc.bg, color:sc.color, borderRadius:10, padding:'2px 8px', fontWeight:500, whiteSpace:'nowrap' }}>
                        {sc.label}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display:'flex', gap:3 }}>
                        <button className="btn btn-ghost btn-xs" title="Voir fiche 360°"
                          onClick={() => setView360(s)}><Eye size={11}/></button>
                        <button className="btn btn-xs" style={{ background:'#EEF3FB', color:'#1a3f6f', border:'none', fontSize:10 }}
                          title="Ajouter paiement"
                          onClick={() => setPaiementFor(s)}>+ Pmt</button>
                        <button className="btn btn-ghost btn-xs" title="Fiche complète"
                          onClick={() => navigate(`/toptelsig/souscripteurs/${s.id}`)}>
                          <ChevronRight size={11}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && !isLoading && (
                <tr><td colSpan={12}>
                  <div className="empty-state">
                    <p>Aucun souscripteur{search ? ` pour "${search}"` : ''}</p>
                    <p style={{ fontSize:11, color:'#aaa' }}>Les souscripteurs sont les contacts ayant effectué au moins un paiement</p>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Vue 360° */}
      {view360 && (
        <FicheSouscripteur360
          s={view360}
          onClose={() => setView360(null)}
          onAddPaiement={(s) => { setView360(null); setPaiementFor(s); }}
        />
      )}

      {/* Modal paiement */}
      {paiementFor && (
        <ModalPaiement
          souscripteur={paiementFor}
          loading={paiementMut.isPending}
          onClose={() => setPaiementFor(null)}
          onSave={d => paiementMut.mutate({ id: paiementFor.id, data: d })}
        />
      )}

      {/* Modal créer contact */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" style={{ maxWidth:480 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <h3 style={{ margin:0, fontFamily:'Syne', fontSize:16 }}>👤 Nouveau contact</h3>
              <button onClick={() => setShowCreate(false)} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
            </div>
            <div style={{ background:'#FAEEDA', borderRadius:8, padding:'8px 12px', marginBottom:14, fontSize:11, color:'#412402' }}>
              ℹ Ce contact sera visible dans le CRM jusqu'au premier paiement, puis basculera automatiquement dans Souscripteurs.
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label className="label">Prénom *</label><input className="input" value={form.prenom} onChange={e=>setForm(f=>({...f,prenom:e.target.value}))}/></div>
              <div><label className="label">Nom *</label><input className="input" value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))}/></div>
              <div><label className="label">Téléphone *</label><input className="input" value={form.telephone} onChange={e=>setForm(f=>({...f,telephone:e.target.value}))}/></div>
              <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
              <div><label className="label">Profession</label><input className="input" value={form.profession} onChange={e=>setForm(f=>({...f,profession:e.target.value}))}/></div>
              <div><label className="label">Source</label><input className="input" value={form.sourceAcquisition} onChange={e=>setForm(f=>({...f,sourceAcquisition:e.target.value}))}/></div>
              <div style={{ gridColumn:'1/-1' }}><label className="label">Commercial responsable</label><input className="input" value={form.commercialNom} onChange={e=>setForm(f=>({...f,commercialNom:e.target.value}))}/></div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:18, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowCreate(false)}>Annuler</button>
              <button className="btn btn-primary btn-sm" style={{ background:'#1a3f6f', border:'none' }}
                disabled={!form.nom||!form.prenom||!form.telephone||createMut.isPending}
                onClick={()=>createMut.mutate({...form,code:`2IG-${Date.now().toString(36).toUpperCase().slice(-5)}`})}>
                {createMut.isPending?'...':'Créer le contact'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position:'fixed', bottom:20, right:16, background:toast.t==='error'?'#A32D2D':'#27500A', color:'white', padding:'10px 18px', borderRadius:10, fontSize:13, zIndex:9999 }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

export default SouscripteursPage;
