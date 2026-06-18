/**
 * Assistant ERP — questions-réponses sur calculs réels, sans IA externe.
 *
 * L'intégration initiale appelait directement l'API Anthropic depuis le
 * navigateur, ce qui ne peut pas fonctionner sans clé API exposée (risque
 * de sécurité) et a un coût récurrent. Remplacé par un moteur qui répond
 * à un ensemble de questions prédéfinies par de vrais calculs sur les
 * données de l'ERP (route backend /api/assistant) : pas de coût, pas de
 * dépendance externe, réponse garantie exacte puisque calculée et non
 * générée.
 *
 * Pas de champ de texte libre : les questions sont des boutons, pas une
 * invite à taper n'importe quoi qui ne pourrait pas être traité.
 */
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../store';
import { assistantAPI } from '../../lib/api';

export default function AssistantERP({ filiale = 'GROUPE' }) {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [historique, setHistorique] = useState([]); // [{ question, reponse }]

  const { data: questionsParFiliale } = useQuery({
    queryKey: ['assistant-questions'],
    queryFn: assistantAPI.questions,
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const queryMut = useMutation({
    mutationFn: (questionId) => assistantAPI.query(questionId),
  });

  const questions = questionsParFiliale?.[filiale] || questionsParFiliale?.GROUPE || [];

  const poserQuestion = (q) => {
    setHistorique(prev => [...prev, { question: q.label, reponse: null }]);
    queryMut.mutate(q.id, {
      onSuccess: (res) => {
        setHistorique(prev => {
          const copy = [...prev];
          copy[copy.length - 1].reponse = res.reponse;
          return copy;
        });
      },
      onError: () => {
        setHistorique(prev => {
          const copy = [...prev];
          copy[copy.length - 1].reponse = 'Erreur — impossible de calculer cette réponse pour le moment.';
          return copy;
        });
      },
    });
  };

  const FILIALE_COLOR = {
    GROUPE: '#1a3f6f', TOPTELSIG: '#27500A', YAKRO_GRILL: '#8B1A1A', LIYA: '#E85D04'
  }[filiale] || '#1a3f6f';

  if (!open) return (
    <button onClick={() => setOpen(true)}
      style={{ position: 'fixed', bottom: 24, right: 24, width: 52, height: 52, borderRadius: '50%',
        background: FILIALE_COLOR, color: 'white', border: 'none', cursor: 'pointer',
        fontSize: 22, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      title="Assistant ERP">
      🤖
    </button>
  );

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, width: 380, maxHeight: 560,
      background: 'white', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
      display: 'flex', flexDirection: 'column', zIndex: 1000, overflow: 'hidden', border: '1px solid #e8e7e1' }}>
      {/* Header */}
      <div style={{ background: FILIALE_COLOR, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: 'white' }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14 }}>🤖 Assistant ERP</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>Réponses calculées sur vos données réelles</div>
        </div>
        <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: 'white', fontSize: 14 }}>✕</button>
      </div>

      {/* Historique */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 120 }}>
        {historique.length === 0 && (
          <div style={{ fontSize: 12, color: '#888', textAlign: 'center', padding: '20px 10px' }}>
            Bonjour {user?.prenom} ! Choisissez une question ci-dessous — je calcule la réponse directement à partir de vos données, je ne devine rien.
          </div>
        )}
        {historique.map((h, i) => (
          <div key={i}>
            <div style={{ maxWidth: '85%', marginLeft: 'auto', padding: '7px 12px',
              borderRadius: '12px 12px 2px 12px', background: FILIALE_COLOR, color: 'white', fontSize: 12, marginBottom: 6 }}>
              {h.question}
            </div>
            <div style={{ maxWidth: '95%', padding: '8px 12px', borderRadius: '12px 12px 12px 2px',
              background: '#F7F7F5', color: '#333', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {h.reponse === null ? <span style={{ color: '#888' }}>Calcul en cours…</span> : h.reponse}
            </div>
          </div>
        ))}
      </div>

      {/* Questions disponibles */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid #e8e7e1', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
        <div style={{ fontSize: 10, color: '#888', fontWeight: 600, marginBottom: 2 }}>QUESTIONS DISPONIBLES</div>
        {questions.length === 0 && <div style={{ fontSize: 11, color: '#888' }}>Chargement…</div>}
        {questions.map(q => (
          <button key={q.id} onClick={() => poserQuestion(q)} disabled={queryMut.isPending}
            style={{ textAlign: 'left', fontSize: 12, padding: '7px 10px', borderRadius: 8, background: '#EEF3FB',
              color: '#1a3f6f', border: 'none', cursor: queryMut.isPending ? 'default' : 'pointer', opacity: queryMut.isPending ? 0.6 : 1 }}>
            {q.label}
          </button>
        ))}
      </div>
    </div>
  );
}
