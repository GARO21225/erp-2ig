import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Check, X, CalendarDays } from 'lucide-react';
import { yakroAPI } from '../../lib/api';
import { useAuthStore, porteeGlobale } from '../../store';

const ROUGE = '#8B1A1A';
const TYPES = { ANNUEL: 'Congé annuel', MALADIE: 'Maladie', PERMISSION: 'Permission', SANS_SOLDE: 'Sans solde', AUTRE: 'Autre' };
const STATUTS = { DEMANDE: ['En attente', '#B97A18', '#FBF1DD'], APPROUVE: ['Approuvé', '#3C7A37', '#E6F2E4'], REFUSE: ['Refusé', '#A32D2D', '#FCEBEB'], ANNULE: ['Annulé', '#777', '#eee'] };
const fr = (d) => new Date(d).toLocaleDateString('fr', { day: 'numeric', month: 'short', year: 'numeric' });
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const lendemain = (d) => iso(new Date(new Date(d).getTime() + 86400000));
const msg = (e) => e?.response?.data?.error || e?.message || 'Erreur';

function Demande({ onClose }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ type: 'ANNUEL', dateDebut: iso(new Date()), dateFin: iso(new Date()), motif: '' });
  const m = useMutation({ mutationFn: () => yakroAPI.demanderConge(f), onSuccess: () => { qc.invalidateQueries({ queryKey: ['conges-yakro'] }); onClose(); } });
  return (
    <div className="card" style={{ padding: 16, marginBottom: 14, maxWidth: 520 }}>
      <b>Nouvelle demande de congé</b>
      <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
        <label>Type<select className="input" value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ flex: 1 }}>Du<input type="date" className="input" value={f.dateDebut} onChange={e => setF({ ...f, dateDebut: e.target.value, dateFin: e.target.value > f.dateFin ? e.target.value : f.dateFin })} /></label>
          <label style={{ flex: 1 }}>Au<input type="date" className="input" min={f.dateDebut} value={f.dateFin} onChange={e => setF({ ...f, dateFin: e.target.value })} /></label>
        </div>
        <label>Motif (facultatif)<textarea className="input" rows={2} value={f.motif} onChange={e => setF({ ...f, motif: e.target.value })} /></label>
        {m.isError && <div style={{ color: '#A32D2D', fontSize: 13 }}>{msg(m.error)}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" disabled={m.isPending} onClick={() => m.mutate()}>Envoyer la demande</button>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

function Decision({ c, onClose }) {
  const qc = useQueryClient();
  const [refus, setRefus] = useState(false);
  const [reprise, setReprise] = useState(lendemain(c.dateFin));
  const [motif, setMotif] = useState('');
  const m = useMutation({
    mutationFn: () => yakroAPI.deciderConge(c.id, refus ? { decision: 'REFUSE', motif } : { decision: 'APPROUVE', dateReprise: reprise }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conges-yakro'] }); qc.invalidateQueries({ queryKey: ['notifs-yakro'] }); onClose(); },
  });
  return (
    <div style={{ background: '#F7F7F5', padding: 12, borderRadius: 8, marginTop: 8, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className={`btn btn-sm ${!refus ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setRefus(false)}><Check size={14} /> Approuver</button>
        <button className={`btn btn-sm ${refus ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setRefus(true)}><X size={14} /> Refuser</button>
      </div>
      {refus
        ? <input className="input" placeholder="Motif du refus (obligatoire)" value={motif} onChange={e => setMotif(e.target.value)} />
        : <label style={{ fontSize: 13 }}>Date de reprise du travail<input type="date" className="input" min={lendemain(c.dateFin)} value={reprise} onChange={e => setReprise(e.target.value)} /></label>}
      {m.isError && <div style={{ color: '#A32D2D', fontSize: 13 }}>{msg(m.error)}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-sm btn-primary" disabled={m.isPending} onClick={() => m.mutate()}>Confirmer et notifier</button>
        <button className="btn btn-sm btn-ghost" onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}

function Reprise({ c }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState(iso(c.dateReprise));
  const m = useMutation({ mutationFn: () => yakroAPI.repriseConge(c.id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['conges-yakro'] }); setEdit(false); } });
  if (!edit) return <button className="btn btn-sm btn-ghost" onClick={() => setEdit(true)}>Modifier la reprise</button>;
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <input type="date" className="input" min={lendemain(c.dateFin)} value={d} onChange={e => setD(e.target.value)} />
      <button className="btn btn-sm btn-primary" disabled={m.isPending} onClick={() => m.mutate()}>OK</button>
      {m.isError && <span style={{ color: '#A32D2D', fontSize: 12 }}>{msg(m.error)}</span>}
    </span>
  );
}

export default function CongesYakroPage() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const patron = ['DG', 'DIRECTEUR'].includes(user?.role);
  const [nouveau, setNouveau] = useState(false);
  const [ouvert, setOuvert] = useState(null);
  const global = porteeGlobale();
  const { data = [], isLoading, isError, error } = useQuery({ queryKey: ['conges-yakro'], queryFn: () => yakroAPI.conges().then(r => r.data), refetchInterval: 30000 });
  const annuler = useMutation({ mutationFn: (id) => yakroAPI.annulerConge(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['conges-yakro'] }) });
  const attente = data.filter(c => c.statut === 'DEMANDE');

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center', margin: 0 }}><CalendarDays size={20} color={ROUGE} /> Congés</h1>
        {!global && <button className="btn btn-primary" onClick={() => setNouveau(true)}><Plus size={14} /> Demander un congé</button>}
      </div>
      {nouveau && <Demande onClose={() => setNouveau(false)} />}
      {patron && attente.length > 0 && <div style={{ background: '#FBF1DD', color: '#8a5a0c', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 600 }}>{attente.length} demande(s) à valider</div>}
      {isLoading && <div>Chargement…</div>}
      {isError && <div style={{ color: '#A32D2D' }}>{msg(error)}</div>}
      {!isLoading && data.length === 0 && <div style={{ color: '#888', padding: 20, textAlign: 'center' }}>Aucune demande de congé</div>}
      <div style={{ display: 'grid', gap: 10 }}>
        {data.map(c => {
          const [lib, col, bg] = STATUTS[c.statut] || STATUTS.DEMANDE;
          return (
            <div key={c.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <b>{c.nom}</b> <span style={{ color: '#888', fontSize: 12 }}>{c.numero}</span>
                  <div style={{ fontSize: 13, marginTop: 2 }}>{TYPES[c.type] || c.type} · du {fr(c.dateDebut)} au {fr(c.dateFin)}</div>
                  {c.motif && <div style={{ fontSize: 12, color: '#666' }}>{c.motif}</div>}
                  {c.statut === 'APPROUVE' && <div style={{ fontSize: 13, color: '#3C7A37', fontWeight: 600, marginTop: 4 }}>Reprise le {fr(c.dateReprise)} · validé par {c.decideParNom}</div>}
                  {c.statut === 'REFUSE' && <div style={{ fontSize: 13, color: '#A32D2D', marginTop: 4 }}>Refusé par {c.decideParNom} : {c.motifRefus}</div>}
                </div>
                <span style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 700, color: col, background: bg, borderRadius: 10, padding: '2px 10px' }}>{lib}</span>
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {patron && c.statut === 'DEMANDE' && ouvert !== c.id && <button className="btn btn-sm btn-primary" onClick={() => setOuvert(c.id)}>Traiter</button>}
                {patron && c.statut === 'APPROUVE' && <Reprise c={c} />}
                {c.statut === 'DEMANDE' && c.utilisateurId === user?.id && <button className="btn btn-sm btn-ghost" disabled={annuler.isPending} onClick={() => annuler.mutate(c.id)}>Annuler ma demande</button>}
              </div>
              {ouvert === c.id && <Decision c={c} onClose={() => setOuvert(null)} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
