import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../lib/api';
import { useAuthStore } from '../store';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await authAPI.login({ email, motDePasse: password });
      setAuth(res.user, res.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.error || 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 48, letterSpacing: -2 }}>
            <span style={{ color: '#E87722' }}>2</span><span style={{ color: '#1a3f6f' }}>iG</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: '#888', marginTop: 4 }}>
            Impact & Innovation Group
          </div>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>ERP Groupe — Accès sécurisé</div>
        </div>

        <div className="card" style={{ padding: 32 }}>
          <h2 style={{ margin: '0 0 24px', fontSize: 18, fontFamily: 'Syne', fontWeight: 700 }}>Connexion</h2>

          {error && (
            <div style={{ background: '#FCEBEB', color: '#501313', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@2ig.ci" required />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="label">Mot de passe</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '10px', background: '#1a3f6f', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: '#bbb' }}>
          © 2IG — ERP Groupe v1.0
        </div>
      </div>
    </div>
  );
}
