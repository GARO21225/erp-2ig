import { useEffect, useRef, useState } from 'react';
import { X, Camera } from 'lucide-react';
import jsQR from 'jsqr';

/** Scanner de QR code intégré à l'application (caméra arrière). Appelle onCode(texte) au premier code lu. */
export default function ScanneurQR({ onCode, onClose }) {
  const video = useRef(null);
  const [err, setErr] = useState('');

  useEffect(() => {
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
  }, []);

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
      {err && <div role="alert" style={{ position: 'absolute', bottom: 24, left: 16, right: 16, background: '#fff', color: '#A32D2D', padding: 14, borderRadius: 14, fontSize: 14 }}>{err}</div>}
    </div>
  );
}
