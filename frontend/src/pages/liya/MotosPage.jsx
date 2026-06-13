import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { liyaAPI } from '../../lib/api';
import ExportBar from '../../components/ui/ExportBar';
import TemplateButton from '../../components/ui/TemplateButton';
import ImportButton from '../../components/ui/ImportButton';
import { Plus, X, Wrench, Fuel, ChevronRight } from 'lucide-react';

const STATUT_MOTO = {
  DISPONIBLE: { badge: 'badge-green', label: 'Disponible' },
  EN_LIVRAISON: { badge: 'badge-amber', label: 'En livraison' },
  MAINTENANCE: { badge: 'badge-red', label: 'Maintenance' },
  HORS_SERVICE: { badge: 'badge-gray', label: 'Hors service' },
};

export default function MotosPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [affecterFor, setAffecterFor] = useState(null); // moto à affecter
  const [toast, setToast] = useState(null);
  const showToast = (msg,t='success') => { setToast({msg,t}); setTimeout(()=>setToast(null),3000); };

  const handleImportMotos = async ({ lignes, entetes }) => {
    setImporting(true);
    try {
      const file = new Blob([/* reconstruit depuis lignes */], { type: 'text/csv' });
      // Import via CSV reconstruit
      const csv = [entetes.join(';'), ...lignes.map(l => l.join(';'))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const fd = new FormData();
      fd.append('fichier', blob, 'motos_import.csv');
      const res = await liyaAPI.importMotos(blob);
      setImportResult(res.data);
      qc.invalidateQueries(['motos']);
    } catch (e) {
      setImportResult({ error: e?.response?.data?.error || e.message });
    } finally { setImporting(false); }
  };

  // Livreurs disponibles (employés LIYA avec rôle LIVREUR ou RESP_LIVRAISON)
  const { data: livreursRaw = [] } = useQuery({
    queryKey: ['livreurs-liya'],
    queryFn: () => import('../../lib/api').then(m => m.employesAPI.list({ filiale: 'LIYA', statut: 'ACTIF', limit: 50 })),
    staleTime: 60000,
  });
  const livreurs = Array.isArray(livreursRaw) ? livreursRaw : (livreursRaw?.data || []);

  const affecterMut = useMutation ? useMutation({
    mutationFn: ({ motoId, livreurId, livreurNom }) => liyaAPI.affecterLivreur(motoId, { livreurId, livreurNom }),
    onSuccess: () => { qc.invalidateQueries(['motos']); setAffecterFor(null); showToast('Livreur affecté ✓'); },
    onError: e => showToast(e?.response?.data?.error||'Erreur','error'),
  }) : null;

  const handleDownloadTemplate = () => { window.open(liyaAPI.motosTemplate(), '_blank'); };
  const handleExportMotos = () => { window.open(liyaAPI.exportMotos(), '_blank'); };
  const [showPlein, setShowPlein] = useState(null);
  const [showMaint, setShowMaint] = useState(null);
  const [showHisto, setShowHisto] = useState(null);
  const [form, setForm] = useState({ immatriculation: '', marque: '', modele: '', annee: new Date().getFullYear(), kilometrage: 0 });
  const [pleinForm, setPleinForm] = useState({ litres: '', montant: '', kilometrage: '', station: '' });
  const [maintForm, setMaintForm] = useState({ type: 'VIDANGE', description: '', cout: '', prestataire: '' });

  const { data: motos, isLoading } = useQuery({ queryKey: ['motos'], queryFn: liyaAPI.motos });
  const { data: histo } = useQuery({ queryKey: ['histo-moto', showHisto?.id], queryFn: () => liyaAPI.historique(showHisto.id), enabled: !!showHisto?.id });

  const createMut = useMutation({ mutationFn: liyaAPI.createMoto, onSuccess: () => { qc.invalidateQueries(['motos']); setShowCreate(false); } });
  const pleinMut = useMutation({ mutationFn: ({ id, data }) => liyaAPI.addPlein(id, data), onSuccess: () => { qc.invalidateQueries(['motos']); setShowPlein(null); } });
  const maintMut = useMutation({ mutationFn: ({ id, data }) => liyaAPI.addMaintenance(id, data), onSuccess: () => { qc.invalidateQueries(['motos']); setShowMaint(null); } });

  const list = Array.isArray(motos) ? motos : [];
  const disponibles = list.filter(m => m.statut === 'DISPONIBLE').length;
  const enLivraison = list.filter(m => m.statut === 'EN_LIVRAISON').length;

  if (importResult) return (
    <div className="card" style={{ maxWidth:500, margin:'40px auto', textAlign:'center' }}>
      <h3 style={{ fontFamily:'Syne' }}>{importResult.error ? '❌ Erreur' : '✅ Import terminé'}</h3>
      {importResult.error ? <p style={{color:'#A32D2D'}}>{importResult.error}</p> : (
        <>
          <p><strong>{importResult.imported}</strong> moto(s) importée(s) sur {importResult.total}</p>
          {importResult.errors?.length > 0 && <ul style={{textAlign:'left',fontSize:12,color:'#A32D2D'}}>{importResult.errors.map((e,i)=><li key={i}>{e}</li>)}</ul>}
        </>
      )}
      <button className="btn btn-primary" style={{marginTop:16}} onClick={() => { setImportResult(null); qc.invalidateQueries(['motos']); }}>Fermer</button>
    </div>
  );

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Motos & Flotte</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{list.length} motos · {disponibles} disponibles · {enLivraison} en livraison</div>
        </div>
        <button className="btn btn-sm" style={{ background: '#E85D04', color: 'white', border: 'none' }} onClick={() => setShowCreate(true)}><Plus size={13} /> Ajouter moto</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Flotte totale', value: list.length },
          { label: 'Disponibles', value: disponibles, color: '#639922' },
          { label: 'En livraison', value: enLivraison, color: '#BA7517' },
          { label: 'Maintenance', value: list.filter(m => m.statut === 'MAINTENANCE').length, color: '#A32D2D' },
        ].map(k => (
          <div key={k.label} className="kpi">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ fontSize: 22, color: k.color || '#E85D04' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Grille motos */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#888', fontSize: 13 }}>Chargement...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {list.map(m => {
            const s = STATUT_MOTO[m.statut] || STATUT_MOTO.HORS_SERVICE;
            const livraison = m.livraisons?.[0];
            const maintenance = m.maintenances?.[0];
            const dernierPlein = m.pleins?.[0];
            return (
              <div key={m.id} className="card" style={{ borderLeft: `3px solid ${m.statut === 'DISPONIBLE' ? '#639922' : m.statut === 'EN_LIVRAISON' ? '#BA7517' : '#A32D2D'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 15, color: '#E85D04' }}>{m.immatriculation}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{m.marque} {m.modele} {m.annee}</div>
                  </div>
                  <span className={`badge ${s.badge}`}>{s.label}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div style={{ background: '#F7F7F5', borderRadius: 8, padding: '6px 10px' }}>
                    <div style={{ fontSize: 10, color: '#888' }}>Kilométrage</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{(m.kilometrage || 0).toLocaleString('fr')} km</div>
                  </div>
                  <div style={{ background: '#F7F7F5', borderRadius: 8, padding: '6px 10px' }}>
                    <div style={{ fontSize: 10, color: '#888' }}>Dernier plein</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{m.dernierePlein ? new Date(m.dernierePlein).toLocaleDateString('fr') : '—'}</div>
                  </div>
                  {/* Assurance */}
                  <div style={{ background: m.dateExpirationAssurance && new Date(m.dateExpirationAssurance) <= new Date() ? '#FCEBEB' : '#F7F7F5', borderRadius: 8, padding: '6px 10px' }}>
                    <div style={{ fontSize: 10, color: '#888' }}>Assurance expire</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: m.dateExpirationAssurance && new Date(m.dateExpirationAssurance) <= new Date() ? '#A32D2D' : '#1a1a1a' }}>
                      {m.dateExpirationAssurance ? new Date(m.dateExpirationAssurance).toLocaleDateString('fr') : '⚠ Non renseignée'}
                    </div>
                  </div>
                  {/* Visite technique */}
                  <div style={{ background: m.dateVisiteTechnique && new Date(m.dateVisiteTechnique) <= new Date() ? '#FCEBEB' : '#F7F7F5', borderRadius: 8, padding: '6px 10px' }}>
                    <div style={{ fontSize: 10, color: '#888' }}>Visite technique</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: m.dateVisiteTechnique && new Date(m.dateVisiteTechnique) <= new Date() ? '#A32D2D' : '#1a1a1a' }}>
                      {m.dateVisiteTechnique ? new Date(m.dateVisiteTechnique).toLocaleDateString('fr') : '⚠ Non renseignée'}
                    </div>
                  </div>
                </div>

                {livraison && (
                  <div style={{ background: '#FFF0EB', borderRadius: 8, padding: '6px 10px', marginBottom: 10, fontSize: 12, color: '#E85D04' }}>
                    🚴 {livraison.chauffeur?.prenom} {livraison.chauffeur?.nom} · En route
                  </div>
                )}
                {maintenance && (
                  <div style={{ background: '#FCEBEB', borderRadius: 8, padding: '6px 10px', marginBottom: 10, fontSize: 12, color: '#A32D2D' }}>
                    🔧 {maintenance.type} — {maintenance.description}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setShowPlein(m)} className="btn btn-sm" style={{ flex: 1, background: '#F1EFE8', border: 'none', fontSize: 11 }}><Fuel size={11} /> Plein</button>
                  <button onClick={() => setShowMaint(m)} className="btn btn-sm" style={{ flex: 1, background: '#F1EFE8', border: 'none', fontSize: 11 }}><Wrench size={11} /> Maint.</button>
                  <button onClick={() => setShowHisto(m)} className="btn btn-sm" style={{ flex: 1, background: '#F1EFE8', border: 'none', fontSize: 11 }}>Historique</button>
                </div>
              </div>
            );
          })}
          {list.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: '#ccc', fontSize: 13 }}>Aucune moto enregistrée</div>}
        </div>
      )}

      {/* Modal Créer moto */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Nouvelle moto</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[['Immatriculation', 'immatriculation'], ['Marque', 'marque'], ['Modèle', 'modele']].map(([label, key]) => (
                <div key={key}><label className="label">{label}</label><input className="input" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} /></div>
              ))}
              <div><label className="label">Année</label><input className="input" type="number" value={form.annee} onChange={e => setForm(f => ({ ...f, annee: Number(e.target.value) }))} /></div>
              <div><label className="label">Kilométrage actuel</label><input className="input" type="number" value={form.kilometrage} onChange={e => setForm(f => ({ ...f, kilometrage: Number(e.target.value) }))} /></div>
              <div><label className="label">N° Assurance</label><input className="input" value={form.numeroAssurance || ''} onChange={e => setForm(f => ({ ...f, numeroAssurance: e.target.value }))} /></div>
              <div><label className="label">Expiration assurance</label><input className="input" type="date" value={form.dateExpirationAssurance || ''} onChange={e => setForm(f => ({ ...f, dateExpirationAssurance: e.target.value }))} /></div>
              <div><label className="label">Date visite technique</label><input className="input" type="date" value={form.dateVisiteTechnique || ''} onChange={e => setForm(f => ({ ...f, dateVisiteTechnique: e.target.value }))} /></div>
              <div><label className="label">Consommation (L/100km)</label><input className="input" type="number" step="0.1" value={form.consommationMoyenne || ''} onChange={e => setForm(f => ({ ...f, consommationMoyenne: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Annuler</button>
              <button className="btn btn-sm" style={{ background: '#E85D04', color: 'white', border: 'none' }} onClick={() => createMut.mutate(form)}>Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Plein carburant */}
      {showPlein && (
        <div className="modal-overlay" onClick={() => setShowPlein(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Plein carburant — {showPlein.immatriculation}</h3>
              <button onClick={() => setShowPlein(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label className="label">Litres</label><input className="input" type="number" value={pleinForm.litres} onChange={e => setPleinForm(f => ({ ...f, litres: e.target.value }))} /></div>
              <div><label className="label">Montant (FCFA)</label><input className="input" type="number" value={pleinForm.montant} onChange={e => setPleinForm(f => ({ ...f, montant: e.target.value }))} /></div>
              <div><label className="label">Kilométrage actuel</label><input className="input" type="number" value={pleinForm.kilometrage} onChange={e => setPleinForm(f => ({ ...f, kilometrage: e.target.value }))} /></div>
              <div><label className="label">Station</label><input className="input" value={pleinForm.station} onChange={e => setPleinForm(f => ({ ...f, station: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPlein(null)}>Annuler</button>
              <button className="btn btn-sm" style={{ background: '#E85D04', color: 'white', border: 'none' }} onClick={() => pleinMut.mutate({ id: showPlein.id, data: { ...pleinForm, litres: Number(pleinForm.litres), montant: Number(pleinForm.montant), kilometrage: Number(pleinForm.kilometrage) } })}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Maintenance */}
      {showMaint && (
        <div className="modal-overlay" onClick={() => setShowMaint(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Maintenance — {showMaint.immatriculation}</h3>
              <button onClick={() => setShowMaint(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label className="label">Type</label>
                <select className="input" value={maintForm.type} onChange={e => setMaintForm(f => ({ ...f, type: e.target.value }))}>
                  {['VIDANGE', 'PNEU', 'FREINS', 'AUTRE'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="label">Description</label><input className="input" value={maintForm.description} onChange={e => setMaintForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div><label className="label">Coût (FCFA)</label><input className="input" type="number" value={maintForm.cout} onChange={e => setMaintForm(f => ({ ...f, cout: e.target.value }))} /></div>
              <div><label className="label">Prestataire</label><input className="input" value={maintForm.prestataire} onChange={e => setMaintForm(f => ({ ...f, prestataire: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowMaint(null)}>Annuler</button>
              <button className="btn btn-sm" style={{ background: '#E85D04', color: 'white', border: 'none' }} onClick={() => maintMut.mutate({ id: showMaint.id, data: { ...maintForm, cout: Number(maintForm.cout), statut: 'EN_COURS' } })}>Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Historique modal */}
      {showHisto && (
        <div className="modal-overlay" onClick={() => setShowHisto(null)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Historique — {showHisto.immatriculation}</h3>
              <button onClick={() => setShowHisto(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {histo?.pleins?.slice(0, 5).map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #f0efe9', fontSize: 13 }}>
                  <span>⛽ {p.litres}L · {p.station || '—'}</span>
                  <span style={{ color: '#E85D04', fontWeight: 500 }}>{p.montant?.toLocaleString('fr')} F · {new Date(p.date).toLocaleDateString('fr')}</span>
                </div>
              ))}
              {histo?.maintenances?.slice(0, 5).map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #f0efe9', fontSize: 13 }}>
                  <span>🔧 {m.type} · {m.description}</span>
                  <span style={{ color: '#A32D2D', fontWeight: 500 }}>{m.cout?.toLocaleString('fr')} F · {new Date(m.date).toLocaleDateString('fr')}</span>
                </div>
              ))}
              {(!histo?.pleins?.length && !histo?.maintenances?.length) && <div style={{ textAlign: 'center', color: '#ccc', padding: 30, fontSize: 13 }}>Aucun historique</div>}
            </div>
          </div>
        </div>
      )}
      {/* Modal affecter livreur */}
      {affecterFor && (
        <div className="modal-overlay" onClick={()=>setAffecterFor(null)}>
          <div className="modal" style={{maxWidth:400}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{margin:0,fontFamily:'Syne',fontSize:15,color:'#E85D04'}}>
                👤 Affecter un livreur — {affecterFor.immatriculation}
              </h3>
              <button onClick={()=>setAffecterFor(null)} style={{background:'none',border:'none',cursor:'pointer'}}>✕</button>
            </div>
            {affecterFor.livreurNom && (
              <div style={{background:'#EAF3DE',borderRadius:8,padding:'8px 12px',marginBottom:12,fontSize:12,color:'#27500A'}}>
                Actuellement affecté à : <strong>{affecterFor.livreurNom}</strong>
              </div>
            )}
            <div style={{marginBottom:14}}>
              <label className="label">Livreur</label>
              <select className="input" id="livreur-select">
                <option value="">— Aucun (désaffecter)</option>
                {livreurs.map(l=>(
                  <option key={l.id} value={l.id} data-nom={`${l.prenom} ${l.nom}`}>
                    {l.prenom} {l.nom} — {l.poste||'Livreur'}
                  </option>
                ))}
              </select>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setAffecterFor(null)}>Annuler</button>
              <button className="btn btn-primary btn-sm" style={{background:'#E85D04',border:'none'}}
                onClick={()=>{
                  const sel = document.getElementById('livreur-select');
                  const opt = sel.options[sel.selectedIndex];
                  affecterMut.mutate({
                    motoId: affecterFor.id,
                    livreurId: sel.value || null,
                    livreurNom: sel.value ? opt.dataset.nom : null,
                  });
                }}>
                Affecter
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div style={{position:'fixed',bottom:20,right:16,background:toast.t==='error'?'#A32D2D':'#27500A',color:'white',padding:'10px 18px',borderRadius:10,fontSize:13,zIndex:9999}}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
