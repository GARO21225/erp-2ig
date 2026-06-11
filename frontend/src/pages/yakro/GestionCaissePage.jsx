import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { yakroAPI } from '../../lib/api';
import { CheckCircle, AlertTriangle, X, Check } from 'lucide-react';

const fmtF = n => Math.round(n||0).toLocaleString('fr') + ' F';
const fmtD = d => d ? new Date(d).toLocaleString('fr', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';

export default function GestionCaissePage() {
  const qc = useQueryClient();
  const [onglet, setOnglet] = useState('caisse');
  const [montantOuv, setMontantOuv] = useState('');
  const [montantReel, setMontantReel] = useState('');
  const [notesCloture, setNotesCloture] = useState('');

  const { data: session, isLoading } = useQuery({ queryKey:['session-caisse'], queryFn:yakroAPI.sessionCaisseActive, staleTime:10000, refetchInterval:30000 });
  const { data: historique = [] } = useQuery({ queryKey:['histo-caisse'], queryFn:yakroAPI.historiqueCaisse, staleTime:60000 });
  const { data: annulations = [] } = useQuery({ queryKey:['annulations-yakro'], queryFn:()=>yakroAPI.annulationsYakro(), staleTime:30000 });
  const { data: remises = [] } = useQuery({ queryKey:['remises-yakro'], queryFn:()=>yakroAPI.remisesYakro(), staleTime:30000 });

  const ouvrirMut = useMutation({ mutationFn:()=>yakroAPI.ouvrirCaisse(Number(montantOuv)||0), onSuccess:()=>{ qc.invalidateQueries(['session-caisse']); setMontantOuv(''); } });
  const cloturerMut = useMutation({ mutationFn:()=>yakroAPI.cloturerCaisse({ montantReel:Number(montantReel), notes:notesCloture }), onSuccess:()=>{ qc.invalidateQueries(['session-caisse','histo-caisse']); setMontantReel(''); setNotesCloture(''); } });

  const listeAnnulations = Array.isArray(annulations) ? annulations : [];
  const listeRemises = Array.isArray(remises) ? remises : [];

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20, color:'#8B1A1A' }}>🏦 Gestion Caisse</h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>Session · Annulations · Remises</p>
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display:'flex', gap:4, borderBottom:'1px solid #e8e7e1', marginBottom:20 }}>
        {[['caisse','💰 Caisse'],['annulations','❌ Annulations'],['remises','🏷️ Remises'],['historique','📋 Historique']].map(([k,v])=>(
          <button key={k} onClick={()=>setOnglet(k)}
            style={{ padding:'8px 14px', border:'none', background:'none', borderBottom:onglet===k?'2px solid #8B1A1A':'2px solid transparent', color:onglet===k?'#8B1A1A':'#888', fontSize:12, fontWeight:onglet===k?600:400, cursor:'pointer' }}>
            {v}
          </button>
        ))}
      </div>

      {/* Onglet Caisse */}
      {onglet === 'caisse' && (
        <div style={{ maxWidth:500 }}>
          {isLoading ? <div style={{ color:'#888', textAlign:'center', padding:40 }}>Chargement...</div> : session ? (
            <div>
              <div style={{ background:'#EAF3DE', border:'1px solid #C0DD97', borderRadius:10, padding:'16px 20px', marginBottom:20 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <CheckCircle size={20} color="#27500A"/>
                  <span style={{ fontFamily:'Syne', fontWeight:700, fontSize:16, color:'#27500A' }}>Caisse OUVERTE</span>
                </div>
                {[['Ouvert par', session.ouvertParNom], ['Heure ouverture', fmtD(session.ouvertLe)], ['Fond de caisse', fmtF(session.montantOuverture)]].map(([k,v],i)=>(
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0', borderBottom:'0.5px solid #C0DD97' }}>
                    <span style={{ color:'#555' }}>{k}</span><span style={{ fontWeight:600 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ background:'#F7F7F5', borderRadius:10, padding:'16px 20px' }}>
                <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:15, marginBottom:12 }}>🔒 Clôturer la caisse</div>
                <label className="label">Montant réel en caisse (FCFA) *</label>
                <input className="input" type="number" value={montantReel} onChange={e=>setMontantReel(e.target.value)} placeholder="Compter le fond physique" style={{ marginBottom:8 }}/>
                <label className="label">Notes (optionnel)</label>
                <textarea className="input" rows={2} value={notesCloture} onChange={e=>setNotesCloture(e.target.value)} style={{ resize:'vertical', marginBottom:12 }}/>
                <button className="btn btn-primary" style={{ width:'100%', background:'#A32D2D', border:'none' }}
                  disabled={!montantReel||cloturerMut.isPending}
                  onClick={()=>{ if(window.confirm('Confirmer la clôture de caisse ?')) cloturerMut.mutate(); }}>
                  {cloturerMut.isPending?'Clôture en cours...':'🔒 Clôturer la caisse'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ background:'#FCEBEB', border:'1px solid #F7C1C1', borderRadius:10, padding:'14px 18px', marginBottom:20, display:'flex', gap:8, alignItems:'center' }}>
                <AlertTriangle size={18} color="#A32D2D"/>
                <span style={{ color:'#A32D2D', fontWeight:600 }}>Aucune session ouverte</span>
              </div>
              <div style={{ background:'#F7F7F5', borderRadius:10, padding:'16px 20px' }}>
                <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:15, marginBottom:12 }}>🔓 Ouvrir la caisse</div>
                <label className="label">Fond de caisse initial (FCFA)</label>
                <input className="input" type="number" value={montantOuv} onChange={e=>setMontantOuv(e.target.value)} placeholder="0" style={{ marginBottom:12 }}/>
                <button className="btn btn-primary" style={{ width:'100%', background:'#27500A', border:'none' }}
                  disabled={ouvrirMut.isPending} onClick={()=>ouvrirMut.mutate()}>
                  {ouvrirMut.isPending?'...':'🔓 Ouvrir la caisse'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Annulations */}
      {onglet === 'annulations' && (
        <div>
          <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>{listeAnnulations.length} annulation(s) — 7 derniers jours</div>
          <div className="table-container">
            <table className="table-erp">
              <thead><tr><th>Date</th><th>Article</th><th>Qté</th><th>Montant</th><th>Motif</th><th>Employé</th></tr></thead>
              <tbody>
                {listeAnnulations.map(a=>(
                  <tr key={a.id}>
                    <td style={{ fontSize:11 }}>{new Date(a.createdAt).toLocaleDateString('fr')}</td>
                    <td style={{ fontWeight:500 }}>{a.menuNom}</td>
                    <td style={{ textAlign:'center' }}>{a.quantite}</td>
                    <td style={{ color:'#A32D2D', fontWeight:600 }}>{fmtF(a.montant)}</td>
                    <td style={{ fontSize:11, color:'#888' }}>{a.motif}</td>
                    <td style={{ fontSize:11 }}>{a.employeNom}</td>
                  </tr>
                ))}
                {listeAnnulations.length===0 && <tr><td colSpan={6}><div className="empty-state"><p>Aucune annulation</p></div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Remises */}
      {onglet === 'remises' && (
        <div>
          <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>{listeRemises.length} remise(s) — 7 derniers jours</div>
          <div className="table-container">
            <table className="table-erp">
              <thead><tr><th>Date</th><th>Avant</th><th>Remise</th><th>Final</th><th>Motif</th><th>Employé</th></tr></thead>
              <tbody>
                {listeRemises.map(r=>(
                  <tr key={r.id}>
                    <td style={{ fontSize:11 }}>{new Date(r.createdAt).toLocaleDateString('fr')}</td>
                    <td style={{ fontSize:11 }}>{fmtF(r.montantAvant)}</td>
                    <td style={{ color:'#A32D2D', fontWeight:600 }}>-{fmtF(r.montantRemise)}</td>
                    <td style={{ color:'#27500A', fontWeight:600 }}>{fmtF(r.montantFinal)}</td>
                    <td style={{ fontSize:11, color:'#888' }}>{r.motif}</td>
                    <td style={{ fontSize:11 }}>{r.employeNom}</td>
                  </tr>
                ))}
                {listeRemises.length===0 && <tr><td colSpan={6}><div className="empty-state"><p>Aucune remise</p></div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historique clôtures */}
      {onglet === 'historique' && (
        <div className="table-container">
          <table className="table-erp">
            <thead><tr><th>Ouverture</th><th>Clôture</th><th>Ouvert par</th><th>Fond init.</th><th>Théorique</th><th>Réel</th><th>Écart</th></tr></thead>
            <tbody>
              {historique.map(s=>{
                const ecart = s.ecart || 0;
                return (
                  <tr key={s.id}>
                    <td style={{ fontSize:11 }}>{fmtD(s.ouvertLe)}</td>
                    <td style={{ fontSize:11 }}>{fmtD(s.closLe)||'—'}</td>
                    <td style={{ fontSize:11 }}>{s.ouvertParNom}</td>
                    <td>{fmtF(s.montantOuverture)}</td>
                    <td>{fmtF(s.montantTheorique)}</td>
                    <td>{fmtF(s.montantReel)}</td>
                    <td style={{ fontWeight:700, color:Math.abs(ecart)<500?'#27500A':Math.abs(ecart)<2000?'#BA7517':'#A32D2D' }}>
                      {ecart>=0?'+':''}{fmtF(ecart)}
                    </td>
                  </tr>
                );
              })}
              {historique.length===0 && <tr><td colSpan={7}><div className="empty-state"><p>Aucune clôture</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
