import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { yakroAPI } from '../../lib/api';
import { Plus, Edit2, Trash2, X, Settings, RefreshCw } from 'lucide-react';

const ZONES_DEFAUT = ['Salle', 'Terrasse', 'VIP', 'Bar', 'Extérieur', 'Privé'];

function ModalTable({ table, zonesExistantes, onClose, onSave, loading }) {
  const [form, setForm] = useState({
    numero: table?.numero || '',
    nom: table?.nom || '',
    capacite: table?.capacite || 4,
    zone: table?.zone || 'Salle',
  });
  const [zoneLibre, setZoneLibre] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toutesZones = [...new Set([...ZONES_DEFAUT, ...zonesExistantes])];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:16 }}>
            {table ? `Modifier Table ${table.numero}` : 'Nouvelle Table'}
          </h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={18}/></button>
        </div>
        <div className="form-grid">
          <div>
            <label className="label">Numéro *</label>
            <input className="input" type="number" value={form.numero} onChange={e=>set('numero',Number(e.target.value))}/>
          </div>
          <div>
            <label className="label">Capacité (pers.)</label>
            <input className="input" type="number" min={1} max={30} value={form.capacite} onChange={e=>set('capacite',Number(e.target.value))}/>
          </div>
          <div className="full">
            <label className="label">Nom / Label (optionnel)</label>
            <input className="input" placeholder="Ex: Table VIP, Terrasse 1..." value={form.nom} onChange={e=>set('nom',e.target.value)}/>
          </div>
          <div className="full">
            <label className="label" style={{ display:'flex', justifyContent:'space-between' }}>
              Zone
              <button type="button" onClick={()=>setZoneLibre(!zoneLibre)}
                style={{ fontSize:10, color:'#1a3f6f', background:'none', border:'none', cursor:'pointer', padding:0 }}>
                {zoneLibre ? '↩ Choisir dans la liste' : '✏ Saisir un nom personnalisé'}
              </button>
            </label>
            {zoneLibre ? (
              <input className="input" value={form.zone} onChange={e=>set('zone',e.target.value)}
                placeholder="Ex: Salle VIP, Rooftop, Zone B..."/>
            ) : (
              <select className="input" value={form.zone} onChange={e=>set('zone',e.target.value)}>
                {toutesZones.map(z=><option key={z} value={z}>{z}</option>)}
                <option value="_custom">+ Autre zone (saisir manuellement)</option>
              </select>
            )}
            {form.zone === '_custom' && !zoneLibre && (
              <input className="input" style={{ marginTop:6 }} value='' onChange={e=>{set('zone',e.target.value);}}
                placeholder="Nom de la zone..."/>
            )}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={loading||!form.numero||!form.zone||form.zone==='_custom'}
            onClick={()=>onSave(form)} style={{ background:'#8B1A1A', border:'none' }}>
            {loading?'Enregistrement...' : table?'Modifier':'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal pour renommer une zone entière
function ModalRenommerZone({ zone, onClose, onSave, loading }) {
  const [nom, setNom] = useState(zone);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:360 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
          <h3 style={{ margin:0, fontFamily:'Syne', fontSize:15 }}>✏ Renommer la zone</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}><X size={16}/></button>
        </div>
        <div style={{ background:'#F7F7F5', borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:12, color:'#888' }}>
          Toutes les tables de la zone <strong>"{zone}"</strong> seront déplacées vers le nouveau nom.
        </div>
        <div>
          <label className="label">Nouveau nom</label>
          <input className="input" value={nom} onChange={e=>setNom(e.target.value)} autoFocus/>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" style={{ background:'#8B1A1A', border:'none' }}
            disabled={!nom||nom===zone||loading}
            onClick={()=>onSave({ ancienNom:zone, nouveauNom:nom })}>
            {loading?'...':'Renommer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TablesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editTable, setEditTable] = useState(null);
  const [renommerZone, setRenommerZone] = useState(null);
  const [toast, setToast] = useState(null);
  const showToast = (msg,t='success') => { setToast({msg,t}); setTimeout(()=>setToast(null),3000); };

  const { data: tables = [], isLoading } = useQuery({
    queryKey:['tables'], queryFn:yakroAPI.tables, staleTime:30000
  });

  const createMut = useMutation({
    mutationFn: yakroAPI.createTable,
    onSuccess:()=>{ qc.invalidateQueries(['tables']); setShowCreate(false); showToast('Table créée ✓'); },
    onError:(e)=>showToast(e?.response?.data?.error||'Erreur','error'),
  });
  const updateMut = useMutation({
    mutationFn:({id,data})=>yakroAPI.updateTableFull(id,data),
    onSuccess:()=>{ qc.invalidateQueries(['tables']); setEditTable(null); showToast('Table modifiée ✓'); },
    onError:(e)=>showToast(e?.response?.data?.error||'Erreur','error'),
  });
  const deleteMut = useMutation({
    mutationFn:yakroAPI.deleteTable,
    onSuccess:()=>{ qc.invalidateQueries(['tables']); showToast('Table supprimée'); },
    onError:(e)=>showToast(e?.response?.data?.error||'Erreur','error'),
  });

  // Renommer toutes les tables d'une zone
  const renommerMut = useMutation({
    mutationFn: async ({ ancienNom, nouveauNom }) => {
      const tablesZone = tables.filter(t=>t.zone===ancienNom);
      await Promise.all(tablesZone.map(t=>yakroAPI.updateTableFull(t.id, { ...t, zone:nouveauNom })));
    },
    onSuccess:()=>{ qc.invalidateQueries(['tables']); setRenommerZone(null); showToast('Zone renommée ✓'); },
    onError:(e)=>showToast(e?.message||'Erreur','error'),
  });

  const zones = [...new Set((tables||[]).map(t=>t.zone).filter(Boolean))].sort();
  const zonesExistantes = zones;

  const stats = {
    total: tables.length,
    libres: tables.filter(t=>t.statut==='LIBRE').length,
    occupees: tables.filter(t=>t.statut==='OCCUPEE').length,
    capacite: tables.reduce((s,t)=>s+(t.capacite||0),0),
  };

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20 }}>⚙ Config. Plan de Salle</h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>
            {stats.total} tables · {stats.libres} libres · {stats.occupees} occupées · {stats.capacite} couverts max
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>qc.invalidateQueries(['tables'])}>
            <RefreshCw size={13}/>
          </button>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowCreate(true)}
            style={{ background:'#8B1A1A', border:'none' }}>
            <Plus size={13}/> Nouvelle table
          </button>
        </div>
      </div>

      {/* Stats rapides */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
        {[
          {label:'Total tables',value:stats.total,color:'#8B1A1A'},
          {label:'Libres',value:stats.libres,color:'#27500A'},
          {label:'Occupées',value:stats.occupees,color:'#A32D2D'},
          {label:'Zones',value:zones.length,color:'#1a3f6f'},
        ].map((k,i)=>(
          <div key={i} className="kpi" style={{ borderTop:`3px solid ${k.color}` }}>
            <div className="kpi-label">{k.label}</div>
            <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:22, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div style={{ padding:40, textAlign:'center', color:'#888' }}>Chargement...</div>
      ) : (
        zones.map(zone => (
          <div key={zone} style={{ marginBottom:28 }}>
            {/* En-tête de zone avec bouton renommer */}
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <h3 style={{ fontFamily:'Syne', fontSize:13, color:'#888', margin:0, textTransform:'uppercase', letterSpacing:1, fontWeight:700 }}>
                {zone}
              </h3>
              <span style={{ fontSize:11, background:'#F7F7F5', borderRadius:8, padding:'1px 8px', color:'#888' }}>
                {tables.filter(t=>t.zone===zone).length} table(s)
              </span>
              <button onClick={()=>setRenommerZone(zone)}
                style={{ background:'#EEF3FB', border:'none', borderRadius:6, padding:'3px 8px', cursor:'pointer', fontSize:11, color:'#1a3f6f', display:'flex', alignItems:'center', gap:4 }}>
                <Settings size={10}/> Renommer la zone
              </button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(145px,1fr))', gap:8 }}>
              {(tables||[]).filter(t=>t.zone===zone).sort((a,b)=>a.numero-b.numero).map(t => (
                <div key={t.id} style={{ border:`1.5px solid ${t.statut==='OCCUPEE'?'#F7C1C1':t.statut==='LIBRE'?'#C8E6C9':'#e8e7e1'}`, borderRadius:10, padding:'12px 10px', background:'white', position:'relative' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                    <div style={{ fontFamily:'Syne', fontWeight:800, fontSize:20, color:'#8B1A1A' }}>T{t.numero}</div>
                    <div style={{ display:'flex', gap:3 }}>
                      <button onClick={()=>setEditTable(t)}
                        style={{ background:'#EEF3FB', border:'none', borderRadius:5, padding:'3px 5px', cursor:'pointer' }}>
                        <Edit2 size={10} color="#1a3f6f"/>
                      </button>
                      <button onClick={()=>{ if(window.confirm(`Supprimer Table ${t.numero} ?`)) deleteMut.mutate(t.id); }}
                        style={{ background:'#FCEBEB', border:'none', borderRadius:5, padding:'3px 5px', cursor:'pointer' }}>
                        <Trash2 size={10} color="#A32D2D"/>
                      </button>
                    </div>
                  </div>
                  {t.nom && <div style={{ fontSize:10, color:'#888', marginBottom:2, fontWeight:500 }}>{t.nom}</div>}
                  <div style={{ fontSize:11, color:'#888' }}>👥 {t.capacite} pers.</div>
                  <div style={{ marginTop:6 }}>
                    <span style={{ fontSize:9, fontWeight:600, borderRadius:8, padding:'2px 7px',
                      background:t.statut==='LIBRE'?'#EAF3DE':t.statut==='OCCUPEE'?'#FCEBEB':'#FAEEDA',
                      color:t.statut==='LIBRE'?'#27500A':t.statut==='OCCUPEE'?'#A32D2D':'#BA7517' }}>
                      {t.statut==='LIBRE'?'✓ Libre':t.statut==='OCCUPEE'?'⬤ Occupée':'⚑ Réservée'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {tables.length === 0 && !isLoading && (
        <div className="empty-state">
          <p>Aucune table configurée</p>
          <button className="btn btn-primary" onClick={()=>setShowCreate(true)} style={{ background:'#8B1A1A', border:'none' }}>
            <Plus size={13}/> Créer la première table
          </button>
        </div>
      )}

      {showCreate && <ModalTable zonesExistantes={zonesExistantes} onClose={()=>setShowCreate(false)} onSave={createMut.mutate} loading={createMut.isPending}/>}
      {editTable && <ModalTable table={editTable} zonesExistantes={zonesExistantes} onClose={()=>setEditTable(null)} onSave={(d)=>updateMut.mutate({id:editTable.id,data:d})} loading={updateMut.isPending}/>}
      {renommerZone && <ModalRenommerZone zone={renommerZone} onClose={()=>setRenommerZone(null)} onSave={renommerMut.mutate} loading={renommerMut.isPending}/>}

      {toast && <div style={{ position:'fixed',bottom:20,right:16,background:toast.t==='error'?'#A32D2D':'#27500A',color:'white',padding:'10px 18px',borderRadius:10,fontSize:13,zIndex:9999 }}>{toast.msg}</div>}
    </div>
  );
}
