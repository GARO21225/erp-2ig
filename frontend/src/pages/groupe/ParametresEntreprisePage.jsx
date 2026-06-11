/**
 * Paramètres Entreprise — logos, coordonnées, RCCM/IFU par filiale
 * Les paramètres alimentent automatiquement toutes les factures et documents PDF
 */
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facturationAPI } from '../../lib/api';
import { Upload, Check, X, Save } from 'lucide-react';

const FILIALES = [
  { key:'TOPTELSIG', label:'TOPTELSIG', color:'#1a3f6f' },
  { key:'YAKRO_GRILL', label:'Yakro Grill', color:'#8B1A1A' },
  { key:'LIYA', label:'LiYA', color:'#E85D04' },
  { key:'GROUPE', label:'Groupe 2IG', color:'#1a1a1a' },
];

function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export default function ParametresEntreprisePage() {
  const qc = useQueryClient();
  const [filiale, setFiliale] = useState('TOPTELSIG');
  const [toast, setToast] = useState(null);
  const showToast = (msg, t='success') => { setToast({msg,t}); setTimeout(()=>setToast(null),3000); };
  const logoRef = useRef(null);

  const { data: params, isLoading } = useQuery({
    queryKey: ['params-entreprise', filiale],
    queryFn: () => facturationAPI.params(filiale),
    staleTime: 60000,
  });

  const [form, setForm] = useState({});
  const [logoPreview, setLogoPreview] = useState(null);

  // Sync form quand params change
  const currentParams = params || {};
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveMut = useMutation({
    mutationFn: (data) => facturationAPI.updateParams(filiale, data),
    onSuccess: () => {
      qc.invalidateQueries(['params-entreprise', filiale]);
      setForm({});
      setLogoPreview(null);
      showToast('Paramètres enregistrés ✓');
    },
    onError: e => showToast(e?.error || 'Erreur', 'error'),
  });

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { showToast('Logo trop grand (max 500KB)', 'error'); return; }
    const b64 = await toBase64(file);
    setLogoPreview(b64);
    set('logoUrl', b64);
  };

  const merged = { ...currentParams, ...form };
  const fil = FILIALES.find(f => f.key === filiale);
  const hasChanges = Object.keys(form).length > 0;

  const fields = [
    { key:'nomLegal', label:'Nom légal *', placeholder:'Ex: TOPTELSIG Sarl' },
    { key:'sigle', label:'Sigle', placeholder:'Ex: TOPTELSIG' },
    { key:'slogan', label:'Slogan', placeholder:'Ex: Votre partenaire foncier' },
    { key:'adresse', label:'Adresse', placeholder:'Ex: Abidjan Cocody, Côte d\'Ivoire', full:true },
    { key:'telephone', label:'Téléphone', placeholder:'Ex: +225 07 00 00 00' },
    { key:'email', label:'Email', placeholder:'Ex: contact@toptelsig.ci' },
    { key:'siteWeb', label:'Site web', placeholder:'Ex: www.toptelsig.ci' },
    { key:'rccm', label:'RCCM', placeholder:'Ex: CI-ABJ-2020-B-12345' },
    { key:'ifu', label:'IFU / NCC', placeholder:'Ex: 0123456789' },
    { key:'couleurPrimaire', label:'Couleur principale', type:'color' },
    { key:'couleurSecondaire', label:'Couleur secondaire', type:'color' },
    { key:'mentions', label:'Mentions légales (pied de page)', placeholder:'Capital : 1 000 000 FCFA...', textarea:true, full:true },
  ];

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 style={{ margin:0, fontFamily:'Syne', fontWeight:800, fontSize:20 }}>⚙️ Paramètres Entreprise</h1>
          <p style={{ margin:'4px 0 0', fontSize:12, color:'#888' }}>Logos, coordonnées et identité visuelle — injectés dans toutes les factures et documents</p>
        </div>
        {hasChanges && (
          <button className="btn btn-primary" style={{ background:'#27500A', border:'none' }}
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate(form)}>
            <Save size={14}/> {saveMut.isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
        )}
      </div>

      {/* Sélecteur filiale */}
      <div style={{ display:'flex', gap:8, marginBottom:24 }}>
        {FILIALES.map(f => (
          <button key={f.key} onClick={() => { setFiliale(f.key); setForm({}); setLogoPreview(null); }}
            style={{ padding:'8px 20px', borderRadius:10, border:`2px solid ${filiale===f.key?f.color:'#e8e7e1'}`, background:filiale===f.key?f.color+'15':'white', color:filiale===f.key?f.color:'#888', fontWeight:filiale===f.key?700:400, cursor:'pointer', fontSize:13 }}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? <div style={{ textAlign:'center', padding:40, color:'#888' }}>Chargement...</div> : (
        <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:24, alignItems:'start' }}>
          {/* Logo */}
          <div>
            <div style={{ background:'white', border:'0.5px solid #e8e7e1', borderRadius:12, padding:20, textAlign:'center' }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#888', marginBottom:12 }}>LOGO</div>
              <div style={{ height:120, display:'flex', alignItems:'center', justifyContent:'center', background:'#F7F7F5', borderRadius:8, marginBottom:12, overflow:'hidden' }}>
                {(logoPreview || merged.logoUrl) ? (
                  <img src={logoPreview || merged.logoUrl} alt="Logo" style={{ maxHeight:'100%', maxWidth:'100%', objectFit:'contain' }}/>
                ) : (
                  <div style={{ textAlign:'center', color:'#ccc' }}>
                    <div style={{ fontSize:28, fontWeight:900, color:fil?.color+'60' }}>{merged.sigle?.slice(0,3) || fil?.label?.slice(0,3)}</div>
                    <div style={{ fontSize:11, marginTop:4 }}>Aucun logo</div>
                  </div>
                )}
              </div>
              <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/svg+xml" style={{ display:'none' }} onChange={handleLogo}/>
              <button className="btn btn-ghost btn-sm" style={{ width:'100%' }} onClick={() => logoRef.current?.click()}>
                <Upload size={13}/> Changer le logo
              </button>
              <div style={{ fontSize:10, color:'#aaa', marginTop:6 }}>PNG, JPG, SVG — max 500KB<br/>Format recommandé : 200×80px</div>
              {(logoPreview || merged.logoUrl) && (
                <button className="btn btn-ghost btn-xs" style={{ marginTop:6, color:'#A32D2D', width:'100%' }}
                  onClick={() => { setLogoPreview(null); set('logoUrl', ''); }}>
                  <X size={11}/> Supprimer le logo
                </button>
              )}
            </div>

            {/* Aperçu couleur */}
            <div style={{ background:'white', border:'0.5px solid #e8e7e1', borderRadius:12, padding:16, marginTop:12 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#888', marginBottom:10 }}>APERÇU EN-TÊTE</div>
              <div style={{ background:'#F7F7F5', borderRadius:8, padding:12, borderLeft:`4px solid ${merged.couleurPrimaire||fil?.color}` }}>
                <div style={{ fontSize:14, fontWeight:900, color:merged.couleurPrimaire||fil?.color }}>{merged.sigle||fil?.label}</div>
                <div style={{ fontSize:11, color:'#555', marginTop:2 }}>{merged.nomLegal||''}</div>
                <div style={{ fontSize:10, color:'#888', marginTop:4 }}>{merged.adresse||''}</div>
                <div style={{ fontSize:10, color:'#888' }}>{merged.telephone||''} {merged.email?'· '+merged.email:''}</div>
                {merged.rccm && <div style={{ fontSize:9, color:'#aaa', marginTop:4 }}>RCCM: {merged.rccm} {merged.ifu?'· IFU: '+merged.ifu:''}</div>}
              </div>
            </div>
          </div>

          {/* Formulaire */}
          <div style={{ background:'white', border:'0.5px solid #e8e7e1', borderRadius:12, padding:24 }}>
            <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:16, marginBottom:20, color:fil?.color }}>
              {fil?.label} — Informations légales
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              {fields.map(f => (
                <div key={f.key} style={{ gridColumn: f.full ? '1/-1' : undefined }}>
                  <label className="label">{f.label}</label>
                  {f.textarea ? (
                    <textarea className="input" rows={3} style={{ resize:'vertical' }}
                      value={form[f.key] !== undefined ? form[f.key] : (currentParams[f.key] || '')}
                      onChange={e => set(f.key, e.target.value)}
                      placeholder={f.placeholder}/>
                  ) : f.type === 'color' ? (
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <input type="color"
                        value={form[f.key] !== undefined ? form[f.key] : (currentParams[f.key] || '#1a3f6f')}
                        onChange={e => set(f.key, e.target.value)}
                        style={{ width:44, height:36, borderRadius:6, border:'0.5px solid #ddd', cursor:'pointer', padding:2 }}/>
                      <input className="input" style={{ flex:1, fontFamily:'monospace', fontSize:12 }}
                        value={form[f.key] !== undefined ? form[f.key] : (currentParams[f.key] || '')}
                        onChange={e => set(f.key, e.target.value)}
                        placeholder="#1a3f6f"/>
                    </div>
                  ) : (
                    <input className="input"
                      value={form[f.key] !== undefined ? form[f.key] : (currentParams[f.key] || '')}
                      onChange={e => set(f.key, e.target.value)}
                      placeholder={f.placeholder}/>
                  )}
                </div>
              ))}
            </div>

            {hasChanges && (
              <div style={{ marginTop:20, padding:'10px 14px', background:'#FAEEDA', borderRadius:8, fontSize:12, color:'#412402', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span>⚠ Modifications non enregistrées</span>
                <button className="btn btn-primary btn-sm" style={{ background:'#27500A', border:'none' }}
                  disabled={saveMut.isPending} onClick={() => saveMut.mutate(form)}>
                  <Save size={13}/> Enregistrer
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <div style={{ position:'fixed', bottom:20, right:16, background:toast.t==='error'?'#A32D2D':'#27500A', color:'white', padding:'10px 18px', borderRadius:10, fontSize:13, zIndex:9999 }}>{toast.msg}</div>}
    </div>
  );
}
