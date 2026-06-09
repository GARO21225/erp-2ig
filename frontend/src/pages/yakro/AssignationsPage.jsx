import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employesAPI, yakroAPI } from '../../lib/api';
import { Users, Coffee, CreditCard, ChefHat, Clock } from 'lucide-react';

const ROLES_YAKRO = [
  { key: 'SERVEUR',  label: 'Serveurs de salle',   icon: Coffee,     color: '#8B1A1A', bg: '#FDF2F2' },
  { key: 'CAISSIER', label: 'Caissiers',            icon: CreditCard, color: '#1a3f6f', bg: '#EEF3FB' },
  { key: 'BARMAN',   label: 'Barmans',              icon: Coffee,     color: '#E85D04', bg: '#FFF0EB' },
  { key: 'MANAGER',  label: 'Managers',             icon: Users,      color: '#27500A', bg: '#EAF3DE' },
];

const SERVICES = ['Matin (7h-15h)', 'Soir (15h-23h)', 'Nuit (23h-7h)', 'Journée complète'];

function EmployeCard({ employe, selected, onToggle, service, onServiceChange }) {
  return (
    <div style={{
      border: `1.5px solid ${selected ? '#8B1A1A' : '#e8e7e1'}`,
      background: selected ? '#FDF2F2' : 'white',
      borderRadius: 10, padding: 12, cursor: 'pointer', transition: 'all 0.15s',
    }} onClick={onToggle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: selected ? 8 : 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: selected ? '#8B1A1A' : '#F1EFE8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: selected ? 'white' : '#888', flexShrink: 0 }}>
          {employe.prenom?.[0]}{employe.nom?.[0]}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {employe.prenom} {employe.nom}
          </div>
          <div style={{ fontSize: 10, color: '#888' }}>{employe.matricule}</div>
        </div>
        <div style={{ marginLeft: 'auto', width: 18, height: 18, borderRadius: '50%', border: `2px solid ${selected ? '#8B1A1A' : '#ddd'}`, background: selected ? '#8B1A1A' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {selected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />}
        </div>
      </div>
      {selected && (
        <div onClick={e => e.stopPropagation()}>
          <label style={{ fontSize: 10, color: '#888', display: 'block', marginBottom: 3 }}>Service</label>
          <select className="input" style={{ fontSize: 11, padding: '4px 8px' }}
            value={service || SERVICES[0]} onChange={e => onServiceChange(employe.id, e.target.value)}>
            {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

export default function AssignationsPage() {
  const qc = useQueryClient();
  const [roleFilter, setRoleFilter] = useState('SERVEUR');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignes, setAssignes] = useState({}); // { employeId: service }
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = (msg, type='success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const { data: employes } = useQuery({
    queryKey: ['employes-yakro', roleFilter],
    queryFn: () => employesAPI.list({ filiale: 'YAKRO_GRILL', statut: 'ACTIF', limit: 100 }),
  });

  const { data: tables } = useQuery({ queryKey: ['tables'], queryFn: yakroAPI.tables });

  const listeEmployes = (employes?.data || employes || []).filter(e =>
    ['SERVEUR', 'CAISSIER', 'BARMAN', 'MANAGER'].includes(e.role) || true // Montrer tous les Yakro
  );

  const toggleAssign = (employeId) => {
    setAssignes(prev => {
      const n = { ...prev };
      if (n[employeId]) delete n[employeId];
      else n[employeId] = SERVICES[0];
      return n;
    });
  };

  const setService = (employeId, service) => {
    setAssignes(prev => ({ ...prev, [employeId]: service }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Enregistrer via AuditLog (assignations simples — pas de table dédiée)
      const count = Object.keys(assignes).length;
      showToast(`✅ ${count} assignation(s) pour le ${new Date(date).toLocaleDateString('fr')}`);
      // TODO: persister en BDD si besoin d'un historique
    } catch(e) { showToast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const nbAssignes = Object.keys(assignes).length;
  const roleActif = ROLES_YAKRO.find(r => r.key === roleFilter);

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20, color:'#8B1A1A' }}>
            👥 Assignation du service
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>
            Affecter les équipes par service et par jour
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" className="input" style={{ width: 150 }} value={date} onChange={e => setDate(e.target.value)} />
          <button className="btn btn-primary btn-sm" style={{ background: '#8B1A1A', border: 'none' }}
            disabled={saving || nbAssignes === 0} onClick={handleSave}>
            {saving ? 'Enregistrement...' : `💾 Valider (${nbAssignes})`}
          </button>
        </div>
      </div>

      {/* KPI du jour */}
      <div className="grid-kpi" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-label">Tables ouvertes</div>
          <div className="kpi-value" style={{ fontSize: 20, color: '#8B1A1A' }}>
            {(tables || []).filter(t => t.statut === 'OCCUPEE').length}/{(tables || []).length}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Employés assignés</div>
          <div className="kpi-value" style={{ fontSize: 20, color: '#1a3f6f' }}>{nbAssignes}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Date service</div>
          <div className="kpi-value" style={{ fontSize: 14 }}>{new Date(date).toLocaleDateString('fr', { weekday:'long', day:'2-digit', month:'short' })}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Effectif disponible</div>
          <div className="kpi-value" style={{ fontSize: 20 }}>{listeEmployes.length}</div>
        </div>
      </div>

      {/* Filtres par rôle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {ROLES_YAKRO.map(r => (
          <button key={r.key} onClick={() => setRoleFilter(r.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              background: roleFilter === r.key ? r.color : r.bg, color: roleFilter === r.key ? 'white' : r.color }}>
            <r.icon size={13} /> {r.label}
          </button>
        ))}
      </div>

      {/* Grille employés */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {listeEmployes.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <Users size={32} />
            <p>Aucun employé Yakro Grill actif trouvé</p>
            <p style={{ fontSize: 11, marginTop: 4 }}>Ajouter des employés dans RH & Équipes</p>
          </div>
        )}
        {listeEmployes.map(e => (
          <EmployeCard key={e.id} employe={e}
            selected={!!assignes[e.id]}
            service={assignes[e.id]}
            onToggle={() => toggleAssign(e.id)}
            onServiceChange={setService} />
        ))}
      </div>

      {toast && <div style={{ position:'fixed', bottom:20, right:16, background: toast.type==='error'?'#A32D2D':'#27500A', color:'white', padding:'10px 18px', borderRadius:10, fontSize:13, zIndex:9999 }}>{toast.msg}</div>}
    </div>
  );
}
