import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { liyaAPI, partenairesLiyaAPI, documentsAPI, employesAPI } from '../../lib/api';
import { Plus, X, Truck, CheckCircle, Camera, Edit2, Trash2, Users } from 'lucide-react';
import FilterBar from '../../components/ui/FilterBar';
import ExportBar from '../../components/ui/ExportBar';
import SelecteurAdresse from '../../components/ui/SelecteurAdresse';
import SelecteurTiers from '../../components/ui/SelecteurTiers';
import { exportExcel, exportPDF, exportLivraisons } from '../../lib/export';

const STATUT_MAP = {
  EN_ATTENTE: { label: 'En attente', badge: 'badge-gray', color: '#888' },
  PRISE_EN_CHARGE: { label: 'Prise en charge', badge: 'badge-blue', color: '#1a3f6f' },
  EN_ROUTE: { label: 'En route', badge: 'badge-amber', color: '#BA7517' },
  LIVRE: { label: 'Livré', badge: 'badge-green', color: '#639922' },
  ECHEC: { label: 'Échec', badge: 'badge-red', color: '#A32D2D' },
  ANNULE: { label: 'Annulé', badge: 'badge-red', color: '#A32D2D' },
};

// ── Modal Photo d'étape (prise en charge OU livraison) ─────────────────────
// Capture photo obligatoire à chaque étape clé, comme demandé ("comme Glovo
// lorsque le colis est pris le livreur fait une photo"). capture="environment"
// ouvre directement l'appareil photo arrière sur mobile, pas juste la galerie.
function ModalPhotoEtape({ livraison, etape, onClose, onValide }) {
  const [fichier, setFichier] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  const titre = etape === 'prise' ? '📸 Photo de prise en charge' : '📸 Photo de livraison';
  const consigne = etape === 'prise'
    ? `Prenez en photo le colis remis par ${livraison.expediteurNom || livraison.clientNom}`
    : `Prenez en photo le colis remis à ${livraison.destinataireNom || '—'}`;

  const handleFichier = (f) => {
    setFichier(f);
    setApercu(f ? URL.createObjectURL(f) : null);
  };

  const valider = async () => {
    if (!fichier) return;
    setEnvoiEnCours(true); setErreur(null);
    try {
      const formData = new FormData();
      formData.append('fichier', fichier);
      formData.append('entiteType', 'Livraison');
      formData.append('entiteId', livraison.id);
      formData.append('type', 'PHOTO');
      formData.append('nom', `${etape === 'prise' ? 'Prise en charge' : 'Livraison'} ${livraison.numero}`);
      const doc = await documentsAPI.upload(formData);
      onValide(doc.url);
    } catch (e) {
      setErreur('Échec de l\'envoi de la photo — réessayez ou vérifiez votre connexion.');
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 15 }}>{titre}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>{consigne}</p>

        {apercu ? (
          <img src={apercu} alt="Aperçu" style={{ width: '100%', borderRadius: 8, marginBottom: 12, maxHeight: 280, objectFit: 'cover' }} />
        ) : (
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '30px 10px', border: '2px dashed #e8e7e1', borderRadius: 10, cursor: 'pointer', marginBottom: 12 }}>
            <Camera size={28} color="#ccc" />
            <span style={{ fontSize: 12, color: '#888' }}>Prendre une photo</span>
            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={e => handleFichier(e.target.files?.[0] || null)} />
          </label>
        )}

        {erreur && <div style={{ fontSize: 11, color: '#A32D2D', marginBottom: 10 }}>{erreur}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {apercu && <button className="btn btn-ghost btn-sm" onClick={() => handleFichier(null)}>Refaire</button>}
          <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none' }}
            disabled={!fichier || envoiEnCours} onClick={valider}>
            {envoiEnCours ? 'Envoi...' : 'Valider'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Code de certification ─────────────────────────────────────────────
// La saisie correcte du code EST l'action qui termine la course (demande
// explicite d'Edgar) — pas une confirmation séparée. Le destinataire reçoit
// le code (par SMS à terme — pour l'instant affiché à l'écran pour
// transmission manuelle) et le communique oralement au livreur.
function ModalCodeLivraison({ livraison, onClose, onValide, loading, erreurServeur }) {
  const [code, setCode] = useState('');
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 15 }}>🔑 Code de certification</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>
          Demandez le code à <strong>{livraison.destinataireNom || 'le destinataire'}</strong> pour confirmer la remise du colis.
        </p>
        <input className="input" placeholder="Code à 4 chiffres" value={code} maxLength={4}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, letterSpacing: 6 }} />
        {erreurServeur && <div style={{ fontSize: 11, color: '#A32D2D', marginTop: 8 }}>{erreurServeur}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-sm" style={{ background: '#27500A', color: 'white', border: 'none' }}
            disabled={code.length !== 4 || loading} onClick={() => onValide(code)}>
            {loading ? 'Vérification...' : 'Confirmer la livraison'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Modifier une livraison ────────────────────────────────────────────
// Édition simple des infos (hors statut, qui garde sa logique propre avec
// code/photo). Permet de corriger une erreur de saisie sans devoir annuler
// et recréer toute la course.
function ModalEditLivraison({ livraison, motos, onClose, onSave, loading }) {
  const [form, setForm] = useState({
    adressePrise: livraison.adressePrise || '', adresseLivraison: livraison.adresseLivraison || '',
    latPrise: livraison.latPrise || null, lonPrise: livraison.lonPrise || null,
    latDest: livraison.latDest || null, lonDest: livraison.lonDest || null,
    montant: livraison.montant || '', typePaiement: livraison.typePaiement || 'ORANGE_MONEY',
    motoId: livraison.motoId || '', notes: livraison.notes || '',
    expediteurNom: livraison.expediteurNom || livraison.clientNom || '', expediteurTel: livraison.expediteurTel || livraison.clientTel || '',
    destinataireNom: livraison.destinataireNom || '', destinataireTel: livraison.destinataireTel || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Modifier {livraison.numero}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label className="label">Expéditeur</label><input className="input" value={form.expediteurNom} onChange={e => set('expediteurNom', e.target.value)} /></div>
          <div><label className="label">Tél. expéditeur</label><input className="input" value={form.expediteurTel} onChange={e => set('expediteurTel', e.target.value)} /></div>
          <div><label className="label">Destinataire</label><input className="input" value={form.destinataireNom} onChange={e => set('destinataireNom', e.target.value)} /></div>
          <div><label className="label">Tél. destinataire</label><input className="input" value={form.destinataireTel} onChange={e => set('destinataireTel', e.target.value)} /></div>
          <div style={{ gridColumn: '1/-1' }}>
            <SelecteurAdresse label="Adresse de prise en charge"
              value={{ adresse: form.adressePrise, lat: form.latPrise, lon: form.lonPrise }}
              onChange={({ adresse, lat, lon }) => setForm(f => ({ ...f, adressePrise: adresse, latPrise: lat, lonPrise: lon }))} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <SelecteurAdresse label="Adresse de livraison"
              value={{ adresse: form.adresseLivraison, lat: form.latDest, lon: form.lonDest }}
              onChange={({ adresse, lat, lon }) => setForm(f => ({ ...f, adresseLivraison: adresse, latDest: lat, lonDest: lon }))} />
          </div>
          <div><label className="label">Montant (FCFA)</label><input className="input" type="number" value={form.montant} onChange={e => set('montant', e.target.value)} /></div>
          <div><label className="label">Paiement</label>
            <select className="input" value={form.typePaiement} onChange={e => set('typePaiement', e.target.value)}>
              {['ESPECES', 'ORANGE_MONEY', 'WAVE', 'MTN_MONEY'].map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1/-1' }}><label className="label">Moto</label>
            <select className="input" value={form.motoId} onChange={e => set('motoId', e.target.value)}>
              <option value="">Non assignée</option>
              {(motos || []).map(m => <option key={m.id} value={m.id}>{m.immatriculation} — {m.marque}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1/-1' }}><label className="label">Notes</label><input className="input" value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none' }} disabled={loading}
            onClick={() => onSave({ ...form, montant: Number(form.montant) })}>
            {loading ? '...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Assigner en masse ──────────────────────────────────────────────────
function ModalAssignerMasse({ nbSelection, onClose, onSave, loading }) {
  const [chauffeurId, setChauffeurId] = useState('');
  const [motoId, setMotoId] = useState('');
  const { data: livreurs = [] } = useQuery({ queryKey: ['employes-liya-livreurs'], queryFn: () => employesAPI.list({ filiale: 'LIYA', statut: 'ACTIF', limit: 50 }) });
  const { data: motosDispo = [] } = useQuery({ queryKey: ['motos-dispo-masse'], queryFn: () => liyaAPI.motos() });
  const listeLivreurs = Array.isArray(livreurs) ? livreurs : (livreurs?.data || []);
  const listeMotos = (Array.isArray(motosDispo) ? motosDispo : (motosDispo?.data || [])).filter(m => m.statut === 'DISPONIBLE');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 15 }}><Users size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Assigner {nbSelection} livraison(s)</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>
          Les livraisons sélectionnées seront ajoutées à la file de ce livreur, dans l'ordre.
        </p>
        <label className="label">Livreur *</label>
        <select className="input" value={chauffeurId} onChange={e => setChauffeurId(e.target.value)} style={{ marginBottom: 10 }}>
          <option value="">Sélectionner...</option>
          {listeLivreurs.map(l => <option key={l.id} value={l.id}>{l.prenom} {l.nom}</option>)}
        </select>
        <label className="label">Moto (optionnel)</label>
        <select className="input" value={motoId} onChange={e => setMotoId(e.target.value)}>
          <option value="">Ne pas changer</option>
          {listeMotos.map(m => <option key={m.id} value={m.id}>{m.immatriculation} — {m.marque}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none' }}
            disabled={!chauffeurId || loading} onClick={() => onSave(chauffeurId, motoId)}>
            {loading ? '...' : 'Assigner'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalCreateLivraison({ motos, onClose, onSave }) {
  const [clientType, setClientType] = useState('ordinaire'); // 'ordinaire' | 'stock3pl'
  // Étape d'ajout d'une nouvelle ligne (panier multi-partenaires)
  const [partenaireSelId, setPartenaireSelId] = useState('');
  const [stock3plId, setStock3plId] = useState('');
  const [quantiteSaisie, setQuantiteSaisie] = useState('');
  // Lignes déjà ajoutées au panier de cette livraison : [{ partenaireId, partenaireNom, stockClientId, article, quantite, unite, disponible }]
  const [lignesPanier, setLignesPanier] = useState([]);
  const [form, setForm] = useState({
    expediteur: { partenaireId: null, clientId: null, nom: '', tel: '' },
    destinataire: { partenaireId: null, clientId: null, nom: '', tel: '' },
    adressePrise: '', adresseLivraison: '', latPrise: null, lonPrise: null, latDest: null, lonDest: null,
    montant: '', typePaiement: 'ORANGE_MONEY', motoId: '', notes: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: stocks3pl = [] } = useQuery({
    queryKey: ['stock3pl-dispo'],
    queryFn: () => liyaAPI.stock3pl({ statut: 'EN_STOCK', limit: 100 }),
    staleTime: 30000,
  });
  const listeStocks = Array.isArray(stocks3pl) ? stocks3pl : (stocks3pl?.data || []);

  const { data: partenaires = [] } = useQuery({
    queryKey: ['partenaires-liya'],
    queryFn: () => partenairesLiyaAPI.list({ actif: true }),
    staleTime: 60000,
  });
  const listePartenaires = Array.isArray(partenaires) ? partenaires : [];

  const stockSelectionne = listeStocks.find(s => s.id === stock3plId);

  const ajouterLigne = () => {
    if (!partenaireSelId || !stock3plId || !quantiteSaisie || Number(quantiteSaisie) <= 0) return;
    const partenaire = listePartenaires.find(p => p.id === partenaireSelId);
    setLignesPanier(prev => [...prev, {
      partenaireId: partenaireSelId,
      partenaireNom: partenaire?.nom || '',
      stockClientId: stock3plId,
      article: stockSelectionne?.article || '',
      quantite: Number(quantiteSaisie),
      unite: stockSelectionne?.unite || 'unité',
      disponible: stockSelectionne?.quantite || 0,
    }]);
    // Reset pour permettre d'ajouter un autre article, éventuellement d'un autre partenaire
    setPartenaireSelId(''); setStock3plId(''); setQuantiteSaisie('');
  };

  const retirerLigne = (idx) => setLignesPanier(prev => prev.filter((_, i) => i !== idx));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontFamily: 'Syne', fontSize: 16 }}>Nouvelle livraison</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        {/* Choix type client */}
        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          {[['ordinaire','🧑 Client ordinaire'],['stock3pl','📦 Stock clients 3PL']].map(([key,label]) => (
            <button key={key} type="button"
              onClick={() => { setClientType(key); setLignesPanier([]); setPartenaireSelId(''); setStock3plId(''); }}
              style={{ flex:1, padding:'8px', borderRadius:8, border:`1.5px solid ${clientType===key?'#E85D04':'#e8e7e1'}`, background:clientType===key?'#FFF0EB':'white', color:clientType===key?'#E85D04':'#666', fontSize:12, fontWeight:clientType===key?600:400, cursor:'pointer' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Parcours Stock 3PL : Partenaire → Stock → Quantité, répétable pour plusieurs partenaires */}
        {clientType === 'stock3pl' && (
          <div style={{ marginBottom:14 }}>
            {/* Panier des lignes déjà ajoutées */}
            {lignesPanier.length > 0 && (
              <div style={{ marginBottom:12, display:'flex', flexDirection:'column', gap:6 }}>
                <label className="label">Articles de cette livraison ({lignesPanier.length})</label>
                {lignesPanier.map((l, idx) => (
                  <div key={idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#FFF0EB', borderRadius:8, padding:'7px 10px', fontSize:12 }}>
                    <div>
                      <span style={{ fontWeight:600 }}>{l.article}</span>
                      <span style={{ color:'#888' }}> · {l.quantite} {l.unite} · 🏢 {l.partenaireNom}</span>
                      {l.quantite > l.disponible && <span style={{ color:'#A32D2D', fontWeight:600 }}> ⚠ stock insuffisant ({l.disponible} dispo)</span>}
                    </div>
                    <button type="button" onClick={() => retirerLigne(idx)} style={{ background:'none', border:'none', cursor:'pointer', color:'#A32D2D' }}><X size={14}/></button>
                  </div>
                ))}
              </div>
            )}

            {/* Étape 1 : Choisir le partenaire pour une nouvelle ligne */}
            <div style={{ marginBottom:10 }}>
              <label className="label">Ajouter un article — 1. Partenaire</label>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:6 }}>
                {listePartenaires.map(p => (
                  <button key={p.id} type="button" onClick={()=>{ setPartenaireSelId(p.id); setStock3plId(''); }}
                    style={{ padding:'5px 12px', borderRadius:16, border:`1.5px solid ${partenaireSelId===p.id?'#E85D04':'#e8e7e1'}`, background:partenaireSelId===p.id?'#FFF0EB':'white', color:partenaireSelId===p.id?'#E85D04':'#555', fontSize:11, cursor:'pointer', fontWeight:partenaireSelId===p.id?600:400 }}>
                    🏢 {p.nom}
                  </button>
                ))}
                {listePartenaires.length === 0 && <div style={{ fontSize:11, color:'#888' }}>Aucun partenaire actif</div>}
              </div>
            </div>

            {/* Étape 2 : Choisir le stock précis de ce partenaire (il peut en avoir plusieurs) */}
            {partenaireSelId && (
              <div style={{ marginBottom:10 }}>
                <label className="label">2. Stock du partenaire</label>
                {listeStocks.filter(s=>s.partenaireId===partenaireSelId).length === 0 ? (
                  <div style={{ background:'#FAEEDA', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#BA7517' }}>
                    ⚠ Aucun article en stock pour ce partenaire
                  </div>
                ) : (
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {listeStocks.filter(s=>s.partenaireId===partenaireSelId).map(s => (
                      <button key={s.id} type="button" onClick={()=>setStock3plId(s.id)}
                        style={{ padding:'6px 12px', borderRadius:8, border:`1.5px solid ${stock3plId===s.id?'#E85D04':'#e8e7e1'}`, background:stock3plId===s.id?'#FFF0EB':'white', color:stock3plId===s.id?'#E85D04':'#555', fontSize:11, cursor:'pointer', textAlign:'left' }}>
                        <div style={{ fontWeight:600 }}>{s.article}</div>
                        <div style={{ fontSize:10, color:'#888' }}>{s.quantite} {s.unite} en stock</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Étape 3 : Quantité à déduire */}
            {stock3plId && (
              <div style={{ marginBottom:10, display:'flex', gap:8, alignItems:'flex-end' }}>
                <div style={{ flex:1 }}>
                  <label className="label">3. Quantité ({stockSelectionne?.disponible !== undefined ? stockSelectionne.quantite : stockSelectionne?.quantite} {stockSelectionne?.unite} disponible)</label>
                  <input className="input" type="number" min="0" step="any" value={quantiteSaisie} onChange={e=>setQuantiteSaisie(e.target.value)} placeholder="Quantité"/>
                </div>
                <button type="button" onClick={ajouterLigne} disabled={!quantiteSaisie || Number(quantiteSaisie)<=0}
                  style={{ padding:'8px 16px', borderRadius:8, background:'#E85D04', color:'white', border:'none', cursor:'pointer', fontSize:12, fontWeight:600, opacity:(!quantiteSaisie||Number(quantiteSaisie)<=0)?0.5:1 }}>
                  + Ajouter
                </button>
              </div>
            )}
            {quantiteSaisie && stockSelectionne && Number(quantiteSaisie) > stockSelectionne.quantite && (
              <div style={{ background:'#FCEBEB', borderRadius:6, padding:'6px 10px', fontSize:11, color:'#A32D2D', marginBottom:8 }}>
                ⚠ Quantité supérieure au stock disponible ({stockSelectionne.quantite} {stockSelectionne.unite}) — sera quand même autorisée, le stock deviendra négatif.
              </div>
            )}

            <div style={{ fontSize:11, color:'#888', marginTop:8 }}>
              Le client peut prendre des articles chez plusieurs partenaires différents : ajoutez autant de lignes que nécessaire avant de créer la livraison.
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <SelecteurTiers label="📤 Expéditeur (remet le colis)" value={form.expediteur}
              onChange={v => setForm(f => ({ ...f, expediteur: v }))} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <SelecteurTiers label="📥 Destinataire (reçoit le colis)" value={form.destinataire}
              onChange={v => setForm(f => ({ ...f, destinataire: v }))} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <SelecteurAdresse label="Adresse de prise en charge"
              value={{ adresse: form.adressePrise, lat: form.latPrise, lon: form.lonPrise }}
              onChange={({ adresse, lat, lon }) => setForm(f => ({ ...f, adressePrise: adresse, latPrise: lat, lonPrise: lon }))} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <SelecteurAdresse label="Adresse de livraison"
              value={{ adresse: form.adresseLivraison, lat: form.latDest, lon: form.lonDest }}
              onChange={({ adresse, lat, lon }) => setForm(f => ({ ...f, adresseLivraison: adresse, latDest: lat, lonDest: lon }))} />
          </div>
          <div><label className="label">Montant (FCFA)</label><input className="input" type="number" value={form.montant} onChange={e => set('montant', e.target.value)} /></div>
          <div><label className="label">Paiement</label>
            <select className="input" value={form.typePaiement} onChange={e => set('typePaiement', e.target.value)}>
              {['ESPECES', 'ORANGE_MONEY', 'WAVE', 'MTN_MONEY'].map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1/-1' }}><label className="label">Moto assignée</label>
            <select className="input" value={form.motoId} onChange={e => set('motoId', e.target.value)}>
              <option value="">Non assignée</option>
              {(motos || []).filter(m => m.statut === 'DISPONIBLE').map(m => <option key={m.id} value={m.id}>{m.immatriculation} — {m.marque}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1/-1' }}><label className="label">Notes</label><input className="input" value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-sm" style={{ background: '#E85D04', color: 'white', border: 'none' }}
            disabled={!form.expediteur.nom || !form.expediteur.tel || !form.destinataire.nom || !form.destinataire.tel}
            onClick={() => onSave({
              expediteurPartenaireId: form.expediteur.partenaireId,
              expediteurClientId: form.expediteur.clientId,
              expediteurNom: form.expediteur.nom,
              expediteurTel: form.expediteur.tel,
              destinatairePartenaireId: form.destinataire.partenaireId,
              destinataireClientId: form.destinataire.clientId,
              destinataireNom: form.destinataire.nom,
              destinataireTel: form.destinataire.tel,
              adressePrise: form.adressePrise, adresseLivraison: form.adresseLivraison,
              latPrise: form.latPrise, lonPrise: form.lonPrise, latDest: form.latDest, lonDest: form.lonDest,
              montant: Number(form.montant), typePaiement: form.typePaiement, motoId: form.motoId, notes: form.notes,
              lignesStock3PL: lignesPanier.map(l => ({
                partenaireId: l.partenaireId, stockClientId: l.stockClientId,
                article: l.article, quantite: l.quantite, unite: l.unite,
              })),
            })}>
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LivraisonsPage() {
  const qc = useQueryClient();
  const [statut, setStatut] = useState('');
  const [filtreDates, setFiltreDates] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [photoEtape, setPhotoEtape] = useState(null); // { livraison, etape: 'prise'|'livraison' }
  const [codeLivraisonFor, setCodeLivraisonFor] = useState(null); // livraison en attente de code
  const [erreurCode, setErreurCode] = useState(null);
  const [selection, setSelection] = useState([]); // ids des livraisons sélectionnées pour action en masse
  const [editLivraison, setEditLivraison] = useState(null);
  const [showAssignerMasse, setShowAssignerMasse] = useState(false);

  const { data } = useQuery({
    queryKey: ['livraisons', statut, filtreDates],
    queryFn: () => liyaAPI.livraisons({
      statut: statut || undefined,
      dateDebut: filtreDates?.debut?.toISOString(),
      dateFin: filtreDates?.fin?.toISOString(),
    }),
    // Le rafraîchissement automatique toutes les 15s recrée le tableau complet
    // à chaque fois — avec une grosse liste (50-100+ lignes), ça interrompt
    // la frappe dans une modal ouverte (édition, photo, code) et donne une
    // sensation de lenteur perceptible. Suspendu tant qu'une modal est ouverte.
    refetchInterval: (editLivraison || photoEtape || codeLivraisonFor) ? false : 15000,
  });
  const { data: stats } = useQuery({ queryKey: ['stats-liya'], queryFn: liyaAPI.stats, refetchInterval: 15000 });
  const { data: motos } = useQuery({ queryKey: ['motos'], queryFn: liyaAPI.motos });

  const [toast, setToast] = useState(null);
  const showToast = (msg, t='success') => { setToast({msg,t}); setTimeout(()=>setToast(null),3500); };

  const createMut = useMutation({
    mutationFn: liyaAPI.createLivraison,
    onSuccess: () => { qc.invalidateQueries(['livraisons']); qc.invalidateQueries(['stats-liya']); setShowCreate(false); showToast('Livraison créée ✓'); },
    onError: e => showToast(e?.response?.data?.error || 'Erreur création livraison', 'error'),
  });
  const editMut = useMutation({
    mutationFn: ({ id, data }) => liyaAPI.updateLivraison(id, data),
    onSuccess: () => { qc.invalidateQueries(['livraisons']); setEditLivraison(null); showToast('Livraison modifiée ✓'); },
    onError: e => showToast(e?.response?.data?.error || 'Erreur modification', 'error'),
  });
  const deleteMut = useMutation({
    mutationFn: liyaAPI.deleteLivraison,
    onSuccess: () => { qc.invalidateQueries(['livraisons']); qc.invalidateQueries(['stats-liya']); showToast('Livraison annulée'); },
    onError: e => showToast(e?.response?.data?.error || 'Erreur annulation', 'error'),
  });
  const assignerMasseMut = useMutation({
    mutationFn: ({ chauffeurId, motoId }) => liyaAPI.assignerMasse(selection, chauffeurId, motoId || undefined),
    onSuccess: (res) => { qc.invalidateQueries(['livraisons']); setShowAssignerMasse(false); setSelection([]); showToast(res.message); },
    onError: e => showToast(e?.response?.data?.error || 'Erreur assignation', 'error'),
  });
  const updateStatut = useMutation({
    mutationFn: ({ id, statut, codeSaisi, photoUrl }) => liyaAPI.updateStatut(id, statut, { codeSaisi, photoUrl }),
    onSuccess: (res) => {
      qc.invalidateQueries(['livraisons']);
      qc.invalidateQueries(['stats-liya']);
      if (res?.avertissementsStock?.length > 0) {
        showToast(res.avertissementsStock.join(' '), 'error');
      }
      if (res?.prochaineCourse) {
        showToast(`Course terminée — ${res.prochaineCourse.numero} attend ce livreur dans sa file`, 'success');
      }
    },
    onError: e => showToast(e?.response?.data?.error || 'Erreur changement de statut', 'error'),
  });

  const livraisons = data?.data || [];

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontFamily: 'Syne', fontWeight: 800 }}>Livraisons</h1>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <div className="dot dot-pulse" style={{ background: '#E85D04', marginTop: 2 }} />
            <span style={{ fontSize: 12, color: '#888' }}>Temps réel · {stats?.enCours || 0} en transit</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <FilterBar onChange={setFiltreDates} defaultPreset="today" color="#E85D04" />
          <ExportBar
            onExcelClick={() => { const { entetes, lignes } = exportLivraisons(livraisons); exportExcel('livraisons_liya', 'Livraisons', entetes, lignes); }}
            onPDFClick={() => { const { entetes, lignes } = exportLivraisons(livraisons); exportPDF('Rapport Livraisons LiYA', 'livraisons_liya', entetes, lignes, { orientation: 'landscape' }); }}
            count={livraisons.length}
          />
          <button className="btn btn-sm" style={{ background: '#E85D04', color: 'white', border: 'none' }} onClick={() => setShowCreate(true)}><Plus size={13} /> Nouvelle livraison</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Livraisons / jour', value: stats?.total || 0, color: '#E85D04' },
          { label: 'Livrées', value: stats?.livrees || 0, color: '#639922' },
          { label: 'En transit', value: stats?.enCours || 0, color: '#BA7517' },
          { label: 'Taux réussite', value: (stats?.tauxReussite || 0) + '%', color: '#1a3f6f' },
          { label: 'CA du jour', value: ((stats?.caJour || 0) / 1000).toFixed(0) + 'k F', color: '#E85D04' },
        ].map(k => (
          <div key={k.label} className="kpi">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ fontSize: 20, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtres statut */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[['', 'Toutes'], ['EN_ATTENTE', 'En attente'], ['EN_ROUTE', 'En route'], ['LIVRE', 'Livrées'], ['ECHEC', 'Échecs']].map(([k, v]) => (
          <button key={k} onClick={() => setStatut(k)} style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, background: statut === k ? '#E85D04' : '#F1EFE8', color: statut === k ? 'white' : '#666', fontWeight: statut === k ? 600 : 400 }}>{v}</button>
        ))}
      </div>

      {/* Barre d'actions en masse — visible seulement si sélection non vide */}
      {selection.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#EEF3FB', borderRadius: 10, padding: '8px 14px', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1a3f6f' }}>{selection.length} sélectionnée(s)</span>
          <button onClick={() => setShowAssignerMasse(true)} className="btn btn-sm" style={{ background: '#1a3f6f', color: 'white', border: 'none', fontSize: 11 }}>
            <Users size={11} /> Assigner à un livreur
          </button>
          <button onClick={() => setSelection([])} style={{ fontSize: 11, color: '#888', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>
            Annuler la sélection
          </button>
        </div>
      )}

      {/* Liste */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="table-erp">
          <thead>
            <tr>
              <th style={{ width: 30 }}>
                <input type="checkbox" checked={selection.length > 0 && selection.length === livraisons.length}
                  onChange={e => setSelection(e.target.checked ? livraisons.map(l => l.id) : [])} />
              </th>
              <th>N° Livraison</th><th>Expéditeur / Destinataire</th><th>Itinéraire</th><th>Moto</th><th>Montant</th><th>Statut</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {livraisons.map(l => {
              const s = STATUT_MAP[l.statut] || STATUT_MAP.EN_ATTENTE;
              return (
                <tr key={l.id}>
                  <td>
                    <input type="checkbox" checked={selection.includes(l.id)}
                      onChange={e => setSelection(prev => e.target.checked ? [...prev, l.id] : prev.filter(id => id !== l.id))} />
                  </td>
                  <td><span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: '#E85D04' }}>{l.numero}</span></td>
                  <td>
                    <div style={{ fontSize: 12 }}>
                      <span style={{ color: '#888' }}>📤</span> <span style={{ fontWeight: 500 }}>{l.expediteurNom || l.clientNom}</span>
                      {l.expediteurPartenaire && <span style={{ fontSize: 10, color: '#1a3f6f' }}> · Partenaire</span>}
                      {l.expediteurClient && <span style={{ fontSize: 10, color: '#27500A' }}> · {l.expediteurClient.typeClient}</span>}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 2 }}>
                      <span style={{ color: '#888' }}>📥</span> <span style={{ fontWeight: 500 }}>{l.destinataireNom || '—'}</span>
                      {l.destinatairePartenaire && <span style={{ fontSize: 10, color: '#1a3f6f' }}> · Partenaire</span>}
                      {l.destinataireClient && <span style={{ fontSize: 10, color: '#27500A' }}> · {l.destinataireClient.typeClient}</span>}
                    </div>
                    {l.lignesStock3PL?.length > 0 && (
                      <div style={{ fontSize: 10, color: '#E85D04', marginTop: 3 }}>
                        {l.lignesStock3PL.map((ln, i) => (
                          <div key={i}>📦 {ln.article} ({ln.quantite} {ln.unite}) · 🏢 {ln.partenaire?.nom}</div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    <div style={{ color: '#888', marginBottom: 2 }}>📍 {l.adressePrise}</div>
                    <div>🏁 {l.adresseLivraison}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{l.moto?.immatriculation || <span style={{ color: '#ccc' }}>Non assignée</span>}</td>
                  <td style={{ fontWeight: 600, color: '#E85D04' }}>{l.montant?.toLocaleString('fr')} F</td>
                  <td><span className={`badge ${s.badge}`}>{s.label}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {l.statut === 'EN_ATTENTE' && <button onClick={() => setPhotoEtape({ livraison: l, etape: 'prise' })} className="btn btn-sm" style={{ background: '#E6F1FB', color: '#042C53', border: 'none', fontSize: 10 }}><Camera size={10} /> Prendre</button>}
                      {l.statut === 'PRISE_EN_CHARGE' && <button onClick={() => updateStatut.mutate({ id: l.id, statut: 'EN_ROUTE' })} className="btn btn-sm" style={{ background: '#FAEEDA', color: '#412402', border: 'none', fontSize: 10 }}>En route</button>}
                      {l.statut === 'EN_ROUTE' && (
                        <>
                          <button onClick={() => { setErreurCode(null); setCodeLivraisonFor(l); }} className="btn btn-sm" style={{ background: '#EAF3DE', color: '#27500A', border: 'none', fontSize: 10 }}><CheckCircle size={10} /> Livré</button>
                          <button onClick={() => updateStatut.mutate({ id: l.id, statut: 'ECHEC' })} className="btn btn-sm" style={{ background: '#FCEBEB', color: '#A32D2D', border: 'none', fontSize: 10 }}>Échec</button>
                        </>
                      )}
                      {!['LIVRE', 'ANNULE'].includes(l.statut) && (
                        <>
                          <button onClick={() => setEditLivraison(l)} title="Modifier"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 4 }}>
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => { if (window.confirm(`Annuler la livraison ${l.numero} ?`)) deleteMut.mutate(l.id); }} title="Annuler"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A32D2D', padding: 4 }}>
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {livraisons.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#ccc', padding: 40, fontSize: 13 }}><Truck size={28} style={{ marginBottom: 8 }} /><br />Aucune livraison</td></tr>}
          </tbody>
        </table>
      </div>

      {showCreate && <ModalCreateLivraison motos={Array.isArray(motos) ? motos : []} onClose={() => setShowCreate(false)} onSave={d => createMut.mutate(d)} />}

      {photoEtape && (
        <ModalPhotoEtape
          livraison={photoEtape.livraison}
          etape={photoEtape.etape}
          onClose={() => setPhotoEtape(null)}
          onValide={(photoUrl) => {
            if (photoEtape.etape === 'prise') {
              updateStatut.mutate({ id: photoEtape.livraison.id, statut: 'PRISE_EN_CHARGE', photoUrl });
            } else {
              // Le code a déjà été vérifié à l'étape précédente (ModalCodeLivraison) ;
              // cet appel envoie la photo + reconfirme le même code déjà validé.
              updateStatut.mutate({ id: photoEtape.livraison.id, statut: 'LIVRE', codeSaisi: photoEtape.codeDejaValide, photoUrl });
            }
            setPhotoEtape(null);
          }}
        />
      )}

      {codeLivraisonFor && (
        <ModalCodeLivraison
          livraison={codeLivraisonFor}
          loading={updateStatut.isPending}
          erreurServeur={erreurCode}
          onClose={() => { setCodeLivraisonFor(null); setErreurCode(null); }}
          onValide={(code) => {
            // Vérification du code SANS encore marquer LIVRE — on confirme
            // juste qu'il est correct, l'appel qui marque réellement la
            // course terminée part de ModalPhotoEtape une fois la photo prise.
            liyaAPI.verifierCode(codeLivraisonFor.id, code)
              .then(() => {
                setErreurCode(null);
                setPhotoEtape({ livraison: codeLivraisonFor, etape: 'livraison', codeDejaValide: code });
                setCodeLivraisonFor(null);
              })
              .catch((e) => setErreurCode(e?.response?.data?.error || 'Code incorrect'));
          }}
        />
      )}

      {editLivraison && (
        <ModalEditLivraison
          livraison={editLivraison}
          motos={Array.isArray(motos) ? motos : []}
          loading={editMut.isPending}
          onClose={() => setEditLivraison(null)}
          onSave={(data) => editMut.mutate({ id: editLivraison.id, data })}
        />
      )}

      {showAssignerMasse && (
        <ModalAssignerMasse
          nbSelection={selection.length}
          loading={assignerMasseMut.isPending}
          onClose={() => setShowAssignerMasse(false)}
          onSave={(chauffeurId, motoId) => assignerMasseMut.mutate({ chauffeurId, motoId })}
        />
      )}
    </div>
  );
}
