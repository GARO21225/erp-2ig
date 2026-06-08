import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employesAPI } from '../../lib/api';
import { useAuthStore } from '../../store';
import { Plus, Search, ChevronRight, X } from 'lucide-react';
import TemplateButton from '../../components/ui/TemplateButton';
import ExportBar from '../../components/ui/ExportBar';
import ImportButton from '../../components/ui/ImportButton';
import FilterBar from '../../components/ui/FilterBar';
import { exportExcel, exportPDF, exportEmployes } from '../../lib/export';

const FILIALES_LABELS = { YAKRO_GRILL: 'Yakro Grill', TOPTELSIG: 'TOPTELSIG', LIYA: 'LiYA', GROUPE: 'Groupe' };
const FILIALES_COLORS = { YAKRO_GRILL: '#8B1A1A', TOPTELSIG: '#1a3f6f', LIYA: '#E85D04', GROUPE: '#444' };
const STATUT_BADGE = { ACTIF: 'badge-green', CONGE: 'badge-amber', SUSPENDU: 'badge-red', DEMISSIONNAIRE: 'badge-amber', QUITTE: 'badge-gray' };

function ModalCreateEmploye({ onClose, onSave }) {
  const [form, setForm] = useState({ matricule: '', nom: '', prenom: '', telephone: '', poste: '', departement: '', filiale: 'YAKRO_GRILL', dateEmbauche: '', salaireBase: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Nouvel employé</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[['Matricule', 'matricule'], ['Nom', 'nom'], ['Prénom', 'prenom'], ['Téléphone', 'telephone'], ['Poste', 'poste'], ['Département', 'departement']].map(([label, key]) => (
            <div key={key}><label className="label">{label}</label><input className="input" value={form[key]} onChange={e => set(key, e.target.value)} /></div>
          ))}
          <div>
            <label className="label">Filiale</label>
            <select className="input" value={form.filiale} onChange={e => set('filiale', e.target.value)}>
              {Object.entries(FILIALES_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div><label className="label">Date d'embauche</label><input className="input" type="date" value={form.dateEmbauche} onChange={e => set('dateEmbauche', e.target.value)} /></div>
          <div style={{ gridColumn: '1/-1' }}><label className="label">Salaire de base (FCFA)</label><input className="input" type="number" value={form.salaireBase} onChange={e => set('salaireBase', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" onClick={() => onSave(form)}>Créer</button>
        </div>
      </div>
    </div>
  );
}

function EmployeDetail({ employe, onClose }) {
  const [tab, setTab] = useState('info');
  if (!employe) return null;
  const color = FILIALES_COLORS[employe.filiale] || '#888';
  const tel = (employe.telephone || '').replace(/[\s\-\+]/g, '').replace(/^0/, '225');
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne', fontWeight: 700, color, fontSize: 16 }}>
              {employe.prenom?.[0]}{employe.nom?.[0]}
            </div>
            <div>
              <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 16 }}>{employe.prenom} {employe.nom}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{employe.poste} · {employe.matricule}</div>
              {/* Boutons communication */}
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <a href={`tel:${employe.telephone}`} style={{ padding: '3px 10px', borderRadius: 6, background: '#EAF3DE', color: '#27500A', textDecoration: 'none', fontSize: 11, fontWeight: 500 }}>📞 Appeler</a>
                <a href={`sms:${employe.telephone}`} style={{ padding: '3px 10px', borderRadius: 6, background: '#EEF3FB', color: '#1a3f6f', textDecoration: 'none', fontSize: 11, fontWeight: 500 }}>💬 SMS</a>
                <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer" style={{ padding: '3px 10px', borderRadius: 6, background: '#FFF0EB', color: '#E85D04', textDecoration: 'none', fontSize: 11, fontWeight: 500 }}>📱 WhatsApp</a>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '0.5px solid #e8e7e1' }}>
          {['info', 'conges', 'avances', 'fiches'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: tab === t ? 600 : 400, color: tab === t ? '#1a1a1a' : '#888', borderBottom: tab === t ? `2px solid ${color}` : '2px solid transparent' }}>
              {t === 'info' ? 'Infos' : t === 'conges' ? 'Congés' : t === 'avances' ? 'Avances' : 'Paie'}
            </button>
          ))}
        </div>
        {tab === 'info' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['Filiale', FILIALES_LABELS[employe.filiale]], ['Département', employe.departement || '—'], ['Téléphone', employe.telephone], ['Email', employe.email || '—'], ['Date embauche', employe.dateEmbauche ? new Date(employe.dateEmbauche).toLocaleDateString('fr') : '—'], ['Salaire base', employe.salaireBase?.toLocaleString('fr') + ' F'], ['Statut', employe.statut]].map(([label, val]) => (
              <div key={label} style={{ background: '#F7F7F5', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{val}</div>
              </div>
            ))}
          </div>
        )}
        {tab === 'conges' && (
          <div>{employe.conges?.length === 0 && <div style={{ color: '#888', fontSize: 13 }}>Aucun congé</div>}
            {employe.conges?.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid #f0efe9' }}>
                <div><div style={{ fontSize: 13, fontWeight: 500 }}>{c.type}</div><div style={{ fontSize: 11, color: '#888' }}>{new Date(c.dateDebut).toLocaleDateString('fr')} → {new Date(c.dateFin).toLocaleDateString('fr')}</div></div>
                <span className={`badge ${c.statut === 'APPROUVE' ? 'badge-green' : c.statut === 'REFUSE' ? 'badge-red' : 'badge-amber'}`}>{c.statut}</span>
              </div>
            ))}
          </div>
        )}
        {tab === 'avances' && (
          <div>{employe.avances?.map(a => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid #f0efe9' }}>
              <div><div style={{ fontSize: 13, fontWeight: 500 }}>{a.montant?.toLocaleString('fr')} F</div><div style={{ fontSize: 11, color: '#888' }}>{new Date(a.createdAt).toLocaleDateString('fr')} · {a.motif || '—'}</div></div>
              <span className={`badge ${a.statut === 'APPROUVEE' ? 'badge-green' : 'badge-amber'}`}>{a.statut}</span>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  );
}

export default function RHPage() {
  const { filiale } = useAuthStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filialeFilter, setFilialeFilter] = useState(filiale === 'GROUPE' ? '' : filiale);
  const [statutFilter, setStatutFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);
  const [importResult, setImportResult] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['employes', filialeFilter, search, statutFilter],
    queryFn: () => employesAPI.list({ filiale: filialeFilter || undefined, search: search || undefined, statut: statutFilter || undefined, limit: 100 }),
  });
  const { data: detail } = useQuery({ queryKey: ['employe', selected?.id], queryFn: () => employesAPI.get(selected.id), enabled: !!selected?.id });
  const createMut = useMutation({ mutationFn: employesAPI.create, onSuccess: () => { qc.invalidateQueries(['employes']); setShowCreate(false); } });

  const employes = data?.data || [];
  const total = data?.total || 0;
  const actifs = employes.filter(e => e.statut === 'ACTIF').length;

  const handleExcelExport = () => {
    const { entetes, lignes } = exportEmployes(employes);
    exportExcel('employes_2ig', 'Employés', entetes, lignes);
  };

  const handlePDFExport = () => {
    const { entetes, lignes } = exportEmployes(employes);
    exportPDF('Liste des Employés', 'employes_2ig', entetes, lignes, {
      sousTitre: `Filiale : ${filialeFilter || 'Toutes'} · ${total} employés · ${actifs} actifs`
    });
  };

  const handleImport = async ({ entetes, lignes, nomFichier }) => {
    // Simuler la validation côté client avant envoi
    const erreurs = [];
    const reqCols = ['matricule', 'nom', 'prenom', 'telephone', 'poste', 'filiale'];
    const headersLow = entetes.map(h => h.toLowerCase().replace(/ \*.*$/, '').trim());
    const missing = reqCols.filter(c => !headersLow.some(h => h.includes(c)));
    if (missing.length > 0) {
      setImportResult({ erreur: `Colonnes manquantes : ${missing.join(', ')}` });
      return;
    }
    setImportResult({ info: `Fichier "${nomFichier}" prêt — ${lignes.length} ligne(s) à importer via l'API /employes/import` });
  };

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Ressources Humaines</h1>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{total} employés · {actifs} actifs</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <TemplateButton url="/employes/template" label="Template employés" />
          <ImportButton onData={handleImport} label="Importer Excel" color="#27500A" />
          <ExportBar onExcelClick={handleExcelExport} onPDFClick={handlePDFExport} count={employes.length} />
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Nouvel employé</button>
        </div>
      </div>

      {importResult && (
        <div style={{ padding: '10px 14px', background: importResult.erreur ? '#FCEBEB' : '#EAF3DE', borderRadius: 8, marginBottom: 12, fontSize: 13, color: importResult.erreur ? '#A32D2D' : '#27500A', display: 'flex', justifyContent: 'space-between' }}>
          {importResult.erreur || importResult.info}
          <button onClick={() => setImportResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
        </div>
      )}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[{ label: 'Total effectif', value: total }, { label: 'Actifs', value: actifs }, { label: 'En congé', value: employes.filter(e => e.statut === 'CONGE').length }, { label: 'Suspendus', value: employes.filter(e => e.statut === 'SUSPENDU').length }].map(k => (
          <div key={k.label} className="kpi"><div className="kpi-label">{k.label}</div><div className="kpi-value" style={{ fontSize: 20 }}>{k.value}</div></div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, background: 'white', border: '0.5px solid #e8e7e1', borderRadius: 8, padding: '6px 12px', flex: 1 }}>
          <Search size={14} color="#888" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." style={{ border: 'none', outline: 'none', fontSize: 13, width: '100%' }} />
        </div>
        {filiale === 'GROUPE' && (
          <select className="input" style={{ width: 150 }} value={filialeFilter} onChange={e => setFilialeFilter(e.target.value)}>
            <option value="">Toutes filiales</option>
            {Object.entries(FILIALES_LABELS).filter(([k]) => k !== 'GROUPE').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
        <select className="input" style={{ width: 140 }} value={statutFilter} onChange={e => setStatutFilter(e.target.value)}>
          <option value="">Tous statuts</option>
          {['ACTIF', 'CONGE', 'SUSPENDU', 'DEMISSIONNAIRE', 'QUITTE'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? <div style={{ padding: 40, textAlign: 'center', color: '#888', fontSize: 13 }}>Chargement...</div> : (
          <table className="table-erp">
            <thead>
              <tr><th>Employé</th><th>Poste</th><th>Filiale</th><th>Contact</th><th>Embauche</th><th>Salaire</th><th>Statut</th><th></th></tr>
            </thead>
            <tbody>
              {employes.map(e => (
                <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(e)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: (FILIALES_COLORS[e.filiale] || '#888') + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: FILIALES_COLORS[e.filiale] }}>{e.prenom?.[0]}{e.nom?.[0]}</div>
                      <div><div style={{ fontWeight: 500, fontSize: 13 }}>{e.prenom} {e.nom}</div><div style={{ fontSize: 11, color: '#888' }}>{e.matricule}</div></div>
                    </div>
                  </td>
                  <td style={{ fontSize: 13 }}>{e.poste}</td>
                  <td><span className={`badge badge-${e.filiale === 'YAKRO_GRILL' ? 'yakro' : e.filiale === 'LIYA' ? 'liya' : 'toptelsig'}`}>{FILIALES_LABELS[e.filiale]}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                      <span style={{ color: '#666' }}>{e.telephone}</span>
                      <a href={`tel:${e.telephone}`} onClick={ev => ev.stopPropagation()} style={{ fontSize: 13 }} title="Appeler">📞</a>
                      <a href={`https://wa.me/${(e.telephone||'').replace(/[\s\-\+]/g,'').replace(/^0/,'225')}`} target="_blank" rel="noreferrer" onClick={ev => ev.stopPropagation()} style={{ fontSize: 13 }} title="WhatsApp">📱</a>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: '#888' }}>{e.dateEmbauche ? new Date(e.dateEmbauche).toLocaleDateString('fr') : '—'}</td>
                  <td style={{ fontSize: 13 }}>{e.salaireBase?.toLocaleString('fr')} F</td>
                  <td><span className={`badge ${STATUT_BADGE[e.statut] || 'badge-gray'}`}>{e.statut}</span></td>
                  <td><ChevronRight size={14} color="#ccc" /></td>
                </tr>
              ))}
              {employes.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#888', padding: 32, fontSize: 13 }}>Aucun employé trouvé</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <ModalCreateEmploye onClose={() => setShowCreate(false)} onSave={d => createMut.mutate(d)} />}
      {selected && <EmployeDetail employe={detail || selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
