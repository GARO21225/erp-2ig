/**
 * Assistant ERP — IA connectée aux données métier
 * Utilise l'API Anthropic via fetch pour répondre aux questions de gestion
 * Accessible depuis tous les dashboards
 */
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../store';
import { financeAPI, toptelsigAPI, liyaAPI, alertesAPI } from '../../lib/api';
import { useQuery } from '@tanstack/react-query';

const SUGGESTIONS = {
  GROUPE:      ["Quel est le CA total ce mois ?","Quels projets dépassent leur budget ?","Combien de souscripteurs sont en retard ?"],
  TOPTELSIG:   ["Quels clients ont des impayés ?","Quel commercial a le meilleur taux de conversion ?","Quels lots sont disponibles ?"],
  YAKRO_GRILL: ["Quel est le CA du jour ?","Quels produits sont sous seuil ?","Quel serveur a généré le plus de CA ?"],
  LIYA:        ["Combien de livraisons en attente ?","Quelles motos ont l'assurance qui expire ?","Quel partenaire a le plus de stock ?"],
};

export default function AssistantERP({ filiale = 'GROUPE', contexteData = {} }) {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Bonjour ${user?.prenom || ''} ! Je suis votre assistant ERP. Posez-moi une question sur vos données.` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  const { data: alertes } = useQuery({
    queryKey: ['alertes-assistant'],
    queryFn: alertesAPI.critiques,
    staleTime: 60000,
    enabled: open,
  });

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const buildContexte = () => {
    const ctx = {
      filiale_active: filiale,
      utilisateur: { nom: `${user?.prenom} ${user?.nom}`, role: user?.role },
      date: new Date().toLocaleDateString('fr', { weekday:'long', day:'numeric', month:'long', year:'numeric' }),
      alertes_critiques: alertes?.critiques || 0,
      alertes: (alertes?.alertes || []).slice(0, 5).map(a => a.message),
      ...contexteData,
    };
    return JSON.stringify(ctx, null, 2);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const contexte = buildContexte();
      const systemPrompt = `Tu es l'assistant ERP du Groupe 2iG en Côte d'Ivoire.
Tu as accès au contexte suivant (données actuelles du système) :
${contexte}

L'application gère :
- TOPTELSIG : immobilier foncier, CRM prospects, souscripteurs, paiements, lots
- YAKRO GRILL : restaurant, plan de salle, commandes, caisse, stocks
- LiYA Logistics : livraisons, motos, stock 3PL partenaires
- Finance Groupe : tableau de bord consolidé, dépenses, encaissements

Règles :
- Réponds en français, concis et précis (max 150 mots)
- Base-toi sur le contexte fourni
- Si tu n'as pas l'info précise, dis-le honnêtement
- Donne des actions concrètes quand possible
- L'utilisateur est ${user?.role} — adapte le niveau de détail`;

      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [...history, { role: 'user', content: userMsg }],
        })
      });

      const data = await response.json();
      const reply = data.content?.[0]?.text || "Je n'ai pas pu obtenir une réponse.";
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Erreur de connexion à l'assistant. Vérifiez votre connexion internet." }]);
    } finally { setLoading(false); }
  };

  const FILIALE_COLOR = {
    GROUPE:'#1a3f6f', TOPTELSIG:'#27500A', YAKRO_GRILL:'#8B1A1A', LIYA:'#E85D04'
  }[filiale] || '#1a3f6f';

  if (!open) return (
    <button onClick={()=>setOpen(true)}
      style={{ position:'fixed', bottom:24, right:24, width:52, height:52, borderRadius:'50%',
        background:FILIALE_COLOR, color:'white', border:'none', cursor:'pointer',
        fontSize:22, boxShadow:'0 4px 20px rgba(0,0,0,0.25)', zIndex:1000,
        display:'flex', alignItems:'center', justifyContent:'center' }}
      title="Assistant ERP">
      🤖
    </button>
  );

  return (
    <div style={{ position:'fixed', bottom:24, right:24, width:380, height:520,
      background:'white', borderRadius:16, boxShadow:'0 8px 40px rgba(0,0,0,0.2)',
      display:'flex', flexDirection:'column', zIndex:1000, overflow:'hidden', border:'1px solid #e8e7e1' }}>
      {/* Header */}
      <div style={{ background:FILIALE_COLOR, padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ color:'white' }}>
          <div style={{ fontFamily:'Syne', fontWeight:700, fontSize:14 }}>🤖 Assistant ERP 2iG</div>
          <div style={{ fontSize:11, opacity:0.8 }}>IA connectée à vos données</div>
        </div>
        <button onClick={()=>setOpen(false)} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:28, height:28, cursor:'pointer', color:'white', fontSize:14 }}>✕</button>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:12, display:'flex', flexDirection:'column', gap:8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start' }}>
            <div style={{ maxWidth:'85%', padding:'8px 12px', borderRadius:m.role==='user'?'12px 12px 2px 12px':'12px 12px 12px 2px',
              background:m.role==='user'?FILIALE_COLOR:'#F7F7F5', color:m.role==='user'?'white':'#333',
              fontSize:12, lineHeight:1.5, whiteSpace:'pre-wrap' }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:'flex', justifyContent:'flex-start' }}>
            <div style={{ background:'#F7F7F5', borderRadius:'12px 12px 12px 2px', padding:'8px 14px', fontSize:12, color:'#888' }}>
              <span style={{ animation:'pulse 1s infinite' }}>Analyse en cours…</span>
            </div>
          </div>
        )}
        <div ref={endRef}/>
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div style={{ padding:'0 12px 8px', display:'flex', gap:6, flexWrap:'wrap' }}>
          {(SUGGESTIONS[filiale]||SUGGESTIONS.GROUPE).map((s,i) => (
            <button key={i} onClick={()=>{setInput(s);}}
              style={{ fontSize:10, padding:'4px 8px', borderRadius:10, background:'#EEF3FB', color:'#1a3f6f', border:'none', cursor:'pointer', lineHeight:1.3 }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding:'8px 12px', borderTop:'1px solid #e8e7e1', display:'flex', gap:8 }}>
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}}}
          placeholder="Posez votre question..."
          style={{ flex:1, border:'0.5px solid #e8e7e1', borderRadius:20, padding:'7px 12px', fontSize:12, outline:'none' }}/>
        <button onClick={sendMessage} disabled={!input.trim()||loading}
          style={{ width:34, height:34, borderRadius:'50%', background:FILIALE_COLOR, color:'white', border:'none', cursor:'pointer', fontSize:14, flexShrink:0, opacity:input.trim()&&!loading?1:0.5 }}>
          ↑
        </button>
      </div>
    </div>
  );
}
