import { useEffect, useRef, useState } from 'react';
import { X, Camera } from 'lucide-react';
import jsQR from 'jsqr';

/** Scanner de QR code intégré à l'application (caméra arrière). Appelle onCode(texte) au premier code lu. */
export default function ScanneurQR({ onCode, onClose }) {
  const video = useRef(null);
  const [err, setErr] = useState('');
  const [photo, setPhoto] = useState(!(typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia));

  // Sans HTTPS le navigateur bloque la caméra en direct : l'agent prend alors une photo du QR (appareil photo du téléphone) que l'on décode ici.
  const lirePhoto = async (f) => {
    if (!f) return;
    setErr('');
    try {
      const bmp = await createImageBitmap(f);
      for (const max of [1200, 800, 1600]) {
        const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
        const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0, c.width, c.height);
        const r = jsQR(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
        if (r?.data) return onCode(r.data);
      }
      setErr('QR code non reconnu : rapprochez-vous, cadrez bien le QR et reprenez la photo.');
    } catch { setErr('Photo illisible, réessayez.'); }
  };

  useEffect(() => {
    if (photo) return;
    let flux, stop = false, raf;
    const detector = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Caméra indisponible (la page doit être en HTTPS).');
        flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stop) return flux.getTracks().forEach(t => t.stop());
        video.current.srcObject = flux; await video.current.play();
        const boucle = async () => {
          if (stop) return;
          const v = video.current;
          if (v && v.readyState >= 2 && v.videoWidth) {
            let texte = '';
            try {
              if (detector) texte = (await detector.detect(v))[0]?.rawValue || '';
              else {
                canvas.width = v.videoWidth; canvas.height = v.videoHeight; ctx.drawImage(v, 0, 0);
                texte = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data || '';
              }
            } catch { /* image suivante */ }
            if (texte) { stop = true; flux.getTracks().forEach(t => t.stop()); return onCode(texte); }
          }
          raf = setTimeout(boucle, 150);
        };
        boucle();
      } catch (e) {
        setErr(e?.name === 'NotAllowedError' ? 'Accès à la caméra refusé. Autorisez-la dans les réglages du navigateur puis réessayez.' : (e?.message || 'Impossible d’ouvrir la caméra.'));
      }
    })();
    return () => { stop = true; clearTimeout(raf); flux?.getTracks().forEach(t => t.stop()); };
  }, [photo]);

  if (photo) return (
    <div role="dialog" aria-label="Photographier le QR code" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#FAF6F0', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
        <button onClick={onClose} aria-label="Fermer" style={{ position: 'absolute', top: 12, right: 12, minWidth: 44, minHeight: 44, border: 0, borderRadius: 22, background: '#fff', cursor: 'pointer' }}><X size={20} /></button>
        <Camera size={48} color="#8B1A1A" />
        <h2 style={{ fontFamily: 'Syne', margin: '10px 0 6px' }}>Photographiez le QR code</h2>
        <p style={{ color: '#6B5F57', fontSize: 14, margin: '0 0 18px' }}>Cadrez le QR affiché au restaurant, prenez la photo : le pointage est enregistré automatiquement.</p>
        <label style={{ display: 'block', minHeight: 56, lineHeight: '56px', borderRadius: 14, background: '#8B1A1A', color: '#fff', fontFamily: 'Syne', fontWeight: 700, cursor: 'pointer' }}>
          Ouvrir l'appareil photo
          <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; lirePhoto(f); }} />
        </label>
        {err && <p role="alert" style={{ color: '#A32D2D', fontSize: 14, marginTop: 14 }}>{err}</p>}
      </div>
    </div>
  );

  return (
    <div role="dialog" aria-label="Scanner le QR code" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000', display: 'grid', placeItems: 'center' }}>
      <video ref={video} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
        <div style={{ width: 'min(70vw,300px)', aspectRatio: '1', borderRadius: 22, boxShadow: '0 0 0 100vmax rgba(0,0,0,.55)', border: '3px solid #fff' }} />
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
        <b style={{ fontFamily: 'Syne' }}><Camera size={16} style={{ verticalAlign: -3 }} /> Scannez le QR du restaurant</b>
        <button onClick={onClose} aria-label="Fermer" style={{ minWidth: 44, minHeight: 44, border: 0, borderRadius: 22, background: 'rgba(255,255,255,.2)', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
      </div>
      {err && <div role="alert" onClick={() => setPhoto(true)} style={{ position: 'absolute', bottom: 24, left: 16, right: 16, background: '#fff', color: '#A32D2D', padding: 14, borderRadius: 14, fontSize: 14 }}>{err}</div>}
    </div>
  );
}
