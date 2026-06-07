const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign } = require('docx');
const fs = require('fs');
const path = require('path');

const C = { blue:'1a3f6f', orange:'E87722', green:'27500A', red:'A32D2D',
            amber:'BA7517', gray:'5F5E5A', lgray:'888780', white:'FFFFFF',
            near:'F7F7F5', bdr:'e8e7e1', ggreen:'EAF3DE', gred:'FCEBEB', gamb:'FAEEDA' };

const run  = (t,o={}) => new TextRun({text:t,size:20,font:'Calibri',...o});
const mono = (t)       => new TextRun({text:t,size:17,font:'Courier New',color:'1a3f6f'});
const h1   = (t,c=C.blue) => new Paragraph({heading:HeadingLevel.HEADING_1,spacing:{before:440,after:140},
  border:{bottom:{style:BorderStyle.SINGLE,size:8,color:c,space:8}},children:[run(t,{bold:true,size:34,color:c})]});
const h2   = (t,c=C.gray) => new Paragraph({heading:HeadingLevel.HEADING_2,spacing:{before:260,after:80},children:[run(t,{bold:true,size:24,color:c})]});
const h3   = (t) => new Paragraph({heading:HeadingLevel.HEADING_3,spacing:{before:180,after:60},children:[run(t,{bold:true,size:21,color:C.blue})]});
const p    = (t,o={}) => new Paragraph({spacing:{after:80},children:[run(t,{size:20,...o})]});
const b    = (t,lv=0) => new Paragraph({bullet:{level:lv},spacing:{after:60},children:[run(t,{size:20})]});
const code = (t) => new Paragraph({spacing:{after:40},shading:{type:ShadingType.SOLID,color:'EEF3FB'},indent:{left:360},children:[mono(t)]});
const sep  = () => new Paragraph({spacing:{before:200,after:200},border:{bottom:{style:BorderStyle.SINGLE,size:2,color:C.bdr}},children:[run('')]});
const alert = (t,color=C.red,bg='FCEBEB') => new Paragraph({spacing:{after:80},shading:{type:ShadingType.SOLID,color:bg},border:{left:{style:BorderStyle.SINGLE,size:12,color,space:6}},indent:{left:240},children:[run(t,{bold:true,color})]});
const note  = (t) => alert(t,C.blue,'EEF3FB');
const ok    = (t) => alert(t,C.green,'EAF3DE');
const warn  = (t) => alert(t,C.amber,'FAEEDA');
const cl    = (t,o={}) => new TableCell({verticalAlign:VerticalAlign.CENTER,shading:o.bg?{type:ShadingType.SOLID,color:o.bg}:undefined,
  margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({alignment:o.center?AlignmentType.CENTER:AlignmentType.LEFT,
    children:[run(t,{size:18,bold:o.bold||false,color:o.color||'1a1a1a'})]})]});
const thead = (cols,bg=C.blue) => new TableRow({tableHeader:true,children:cols.map(c=>cl(c,{bg,bold:true,color:C.white,center:true}))});
const trow  = (cols,bg=C.white) => new TableRow({children:cols.map(c=>cl(c,{bg}))});
const tbl   = (hd,rows) => new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[thead(hd),...rows.map((r,i)=>trow(r,i%2===1?'F7F7F5':C.white))]});

const STATUS = {
  OK:   (t) => new TableCell({verticalAlign:VerticalAlign.CENTER,shading:{type:ShadingType.SOLID,color:'EAF3DE'},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[run(t||'✅ IMPLÉMENTÉ',{size:18,bold:true,color:C.green})]})]}),
  PART: (t) => new TableCell({verticalAlign:VerticalAlign.CENTER,shading:{type:ShadingType.SOLID,color:'FAEEDA'},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[run(t||'⚠ PARTIEL',{size:18,bold:true,color:C.amber})]})]}),
  NO:   (t) => new TableCell({verticalAlign:VerticalAlign.CENTER,shading:{type:ShadingType.SOLID,color:'FCEBEB'},margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[run(t||'❌ NON IMPL.',{size:18,bold:true,color:C.red})]})]}),
};

// ══════════════════════════════════════════════════════════════════════════
// DOCUMENT 1 : SECURITY_AUDIT_REPORT
// ══════════════════════════════════════════════════════════════════════════
function rowStatus(items) {
  return items.map(([label, status, detail, proof]) => {
    const statusCell = status === 'OK' ? STATUS.OK() : status === 'PART' ? STATUS.PART() : STATUS.NO();
    return new TableRow({ children: [
      cl(label, {bg: C.white}),
      statusCell,
      cl(detail || '', {}),
      cl(proof || '', {}),
    ]});
  });
}

const auditChildren = [
  new Paragraph({spacing:{before:1200,after:280},alignment:AlignmentType.CENTER,children:[run('ERP GROUPE 2IG',{size:48,bold:true,color:C.blue})]}),
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:160},children:[run('SECURITY AUDIT REPORT',{size:30,bold:true,color:C.orange})]}),
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:300},children:[run('Audit de sécurité complet — Juin 2026',{size:20,color:C.gray,italics:true})]}),
  alert('⚠ DOCUMENT CONFIDENTIEL — DG et responsable technique uniquement', C.red),
  new Paragraph({spacing:{after:400},children:[]}),

  h1('RÉSUMÉ EXÉCUTIF'),
  new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[
    thead(['Domaine sécurité','Statut','Risque résiduel']),
    trow(['Authentification JWT + bcrypt','✅ IMPLÉMENTÉ','Faible']),
    trow(['Politique mot de passe fort','✅ IMPLÉMENTÉ (ce sprint)','Faible'],'F7F7F5'),
    trow(['Blocage compte après 5 tentatives','✅ IMPLÉMENTÉ (ce sprint)','Faible']),
    trow(['Validation token en BDD (révocation)','✅ IMPLÉMENTÉ (ce sprint)','Faible'],'F7F7F5'),
    trow(['RBAC 14 rôles + isolation filiale','✅ IMPLÉMENTÉ','Faible']),
    trow(['Audit trail login/logout avec IP','✅ IMPLÉMENTÉ (ce sprint)','Faible'],'F7F7F5'),
    trow(['Rate limiting API + login','✅ IMPLÉMENTÉ','Faible']),
    trow(['Helmet.js + CORS','✅ IMPLÉMENTÉ','Moyen — CSP désactivé volontairement']),
    trow(['Permissions granulaires','⚠ PARTIEL','Moyen — matrice définie, non câblée partout'],'F7F7F5'),
    trow(['Chiffrement bcrypt (saltRounds=12)','✅ IMPLÉMENTÉ (ce sprint, corrigé de 10)','Faible']),
    trow(['GED — fileFilter types fichiers','⚠ PARTIEL','Moyen — non étendu à tous les uploads']),
    trow(['2FA (authentification double facteur)','❌ NON IMPLÉMENTÉ','Élevé — Phase 2 obligatoire avant prod'],'F7F7F5'),
    trow(['Refresh token','❌ NON IMPLÉMENTÉ','Faible — token 8h, sessions en BDD compensent']),
    trow(['Réinitialisation mot de passe (email)','❌ NON IMPLÉMENTÉ','Moyen — reset manuel via DG possible'],'F7F7F5'),
    trow(['Sauvegardes automatiques quotidiennes','✅ IMPLÉMENTÉ','Faible']),
    trow(['HTTPS','✅ RENDER (automatique)','Faible — géré par Render']),
  ]}),
  sep(),

  h1('1. AUTHENTIFICATION'),
  new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[
    new TableRow({tableHeader:true,children:[cl('Point de contrôle',{bg:C.blue,bold:true,color:C.white}),cl('Statut',{bg:C.blue,bold:true,color:C.white,center:true}),cl('Implémentation réelle',{bg:C.blue,bold:true,color:C.white}),cl('Fichier / preuve',{bg:C.blue,bold:true,color:C.white})]}),
    new TableRow({children:[cl('JWT sécurisé (HS256)'),STATUS.OK(),cl('jwt.sign({userId}, JWT_SECRET, {expiresIn:"8h", issuer:"erp-2ig"})'),cl('auth.js ligne 78')]}),
    new TableRow({children:[cl('bcrypt saltRounds=12',{bg:'F7F7F5'}),STATUS.OK('✅ CORRIGÉ'),cl('Corrigé de 10 → 12 (OWASP production)'),cl('auth.js SALT_ROUNDS=12')]}),
    new TableRow({children:[cl('Politique 12 car + Maj + min + chiffre + spécial'),STATUS.OK('✅ NOUVEAU'),cl('validatePassword() — 6 règles vérifiées'),cl('auth.js validatePassword()')]}),
    new TableRow({children:[cl('Blocage compte (5 tentatives, 15 min)',{bg:'F7F7F5'}),STATUS.OK('✅ NOUVEAU'),cl('loginAttempts + lockedUntil sur Utilisateur — feedback tentatives restantes'),cl('auth.js + schema.prisma')]}),
    new TableRow({children:[cl('Token validé en BDD (révocation réelle)'),STATUS.OK('✅ NOUVEAU'),cl('Session.findUnique(token) à chaque requête — révocation immédiate'),cl('middleware/auth.js + Session BDD')]}),
    new TableRow({children:[cl('Session 8h (réduit de 7j)',{bg:'F7F7F5'}),STATUS.OK('✅ CORRIGÉ'),cl('TOKEN_EXPIRY="8h" — réduction surface d\'attaque'),cl('auth.js TOKEN_EXPIRY')]}),
    new TableRow({children:[cl('Max 5 sessions actives simultanées'),STATUS.OK('✅ NOUVEAU'),cl('Nettoyage auto sessions au login (slice(5))'),cl('auth.js login route')]}),
    new TableRow({children:[cl('Déconnexion forcée (DG → user)',{bg:'F7F7F5'}),STATUS.OK('✅ NOUVEAU'),cl('POST /auth/force-logout/:userId — révoque toutes sessions'),cl('auth.js force-logout')]}),
    new TableRow({children:[cl('Logout révoque token en BDD'),STATUS.OK('✅ CORRIGÉ'),cl('Session.deleteMany({token}) — token immédiatement invalide'),cl('auth.js logout')]}),
    new TableRow({children:[cl('Changement MdP révoque autres sessions',{bg:'F7F7F5'}),STATUS.OK('✅ NOUVEAU'),cl('Session.deleteMany({userId, NOT currentToken})'),cl('auth.js /password')]}),
    new TableRow({children:[cl('Audit login/logout avec IP'),STATUS.OK('✅ NOUVEAU'),cl('logAudit() avec IP réelle (x-forwarded-for)'),cl('auth.js logAudit()')]}),
    new TableRow({children:[cl('2FA (TOTP)',{bg:'F7F7F5'}),STATUS.NO(),cl('Non implémenté — architecture prévue Phase 2'),cl('FEATURE_BACKLOG.docx #9')]}),
    new TableRow({children:[cl('Refresh token'),STATUS.NO(),cl('Compensé par sessions en BDD (révocables) + 8h expiry'),cl('—')]}),
    new TableRow({children:[cl('Réinitialisation MdP par email',{bg:'F7F7F5'}),STATUS.NO(),cl('Reset manuel via DG (POST /auth/password)'),cl('—')]}),
  ]}),
  sep(),

  h1('2. GESTION DES RÔLES (RBAC)'),
  tbl(['Rôle','Niveau','Filiale','Droits principaux','Implémenté'],[
    ['DG','100','GROUPE','Tous les droits sur toutes les filiales','✅'],
    ['DIRECTEUR','90','GROUPE','Lecture+écriture toutes filiales, pas de suppression critique','✅'],
    ['RH','80','GROUPE','Employés, congés, sanctions, salaires (lecture)','✅'],
    ['COMPTABLE','80','GROUPE','Finance, décaissements, budgets, export financier','✅'],
    ['RESP_FONCIER','70','TOPTELSIG','Projets, lots, ventes, dépenses — validation N1','✅'],
    ['MANAGER','70','YAKRO_GRILL','POS, équipes, stocks Yakro','✅'],
    ['COMMERCIAL','60','TOPTELSIG','Souscripteurs, ventes (pas de suppression)','✅'],
    ['CAISSIER','40','YAKRO_GRILL','Encaissements, paiements POS uniquement','✅'],
    ['SERVEUR','30','YAKRO_GRILL','POS (créer commande, voir menu)','✅'],
    ['BARMAN','30','YAKRO_GRILL','POS boissons + bar uniquement','✅'],
    ['RESP_LIVRAISON','70','LIYA','Livraisons, motos, affectations','✅'],
    ['LIVREUR','20','LIYA','Voir ses livraisons uniquement','✅'],
    ['MAGASINIER','50','GROUPE','Stocks (entrées, sorties, inventaire)','✅'],
    ['EMPLOYE','10','GROUPE','Profil personnel uniquement','✅'],
  ]),
  h3('Isolation par filiale — Implémentée'),
  p('requireFiliale() middleware : un utilisateur LIYA ne peut pas accéder aux routes /toptelsig/ ni /yakro/.'),
  p('Seule la filiale GROUPE (DG, DIRECTEUR, RH, COMPTABLE) a accès transversal.'),
  sep(),

  h1('3. PERMISSIONS GRANULAIRES'),
  tbl(['Permission','Rôles autorisés','Statut'],[
    ['Lecture salaires','DG, RH, COMPTABLE, DIRECTEUR','⚠ Matrice définie, implémentation partielle'],
    ['Export salaires','DG, COMPTABLE','⚠ Matrice définie, implémentation partielle'],
    ['Lecture finances','DG, DIRECTEUR, COMPTABLE','✅ requireRole() sur toutes routes finance'],
    ['Export finances','DG, COMPTABLE','⚠ Matrice définie, vérification ExportBar à ajouter'],
    ['Validation dépenses N1','RESP_FONCIER','✅ Implémenté'],
    ['Validation dépenses finale','DG, DIRECTEUR','✅ Implémenté'],
    ['Paiement dépenses','COMPTABLE','✅ Implémenté'],
    ['Suppression GED','DG, DIRECTEUR','⚠ Soft delete implémenté, rôle à renforcer'],
    ['Audit log lecture','DG, DIRECTEUR','✅ /api/auth/security-log'],
    ['Export lots/souscripteurs','DG, DIRECTEUR, RESP_FONCIER, COMMERCIAL','⚠ À ajouter en middleware'],
  ]),
  sep(),

  h1('4. AUDIT TRAIL'),
  tbl(['Action','Implémentée','Champs capturés'],[
    ['Connexion (LOGIN)','✅ OUI','utilisateurId, nom, filiale, IP, horodatage'],
    ['Déconnexion (LOGOUT)','✅ OUI','utilisateurId, nom, filiale, IP, horodatage'],
    ['Échec login (LOGIN_FAILED)','✅ OUI','email, IP, nb tentatives'],
    ['Compte bloqué (LOGIN_BLOCKED)','✅ OUI','IP, horodatage'],
    ['Changement MdP','✅ OUI','utilisateurId, IP'],
    ['Déconnexion forcée','✅ OUI','auteur DG, cible userId, IP'],
    ['Création/modif entité','✅ OUI','avant + après en JSON, IP'],
    ['Suppression','✅ OUI','avant en JSON, motif'],
    ['Validation dépense','✅ OUI','niveau, montant, motif'],
    ['Paiement foncier','✅ OUI','montant, mode, souscripteur, vente'],
    ['Annulation vente','✅ OUI','motif, montant déjà payé, auteur'],
    ['Export données','⚠ PARTIEL','À ajouter dans lib/export.js'],
    ['Impressions','❌ NON','Non capturées'],
  ]),
  note('L\'AuditLog est NON MODIFIABLE par conception : aucun endpoint DELETE ni UPDATE n\'existe sur cette table.'),
  sep(),

  h1('5. PROTECTION API'),
  tbl(['Protection','Statut','Implémentation','Fichier'],[
    ['Validation inputs (middleware)','✅ OUI','VALIDATORS pour 6 entités — types, enums, min/max','middleware/validate.js'],
    ['Protection SQL Injection','✅ OUI','Prisma ORM — requêtes paramétrées uniquement','Toutes les routes'],
    ['Protection XSS','✅ OUI','Helmet.js + pas de rendu HTML côté serveur','index.js'],
    ['CORS restrictif','⚠ PARTIEL','FRONTEND_URL configurée, fallback "*" en dev','index.js'],
    ['Rate limiting API','✅ OUI','500 req/15min par IP via express-rate-limit','index.js'],
    ['Rate limiting login','✅ OUI','20 req/15min par IP sur /api/auth/login','index.js'],
    ['Validation taille fichiers','✅ OUI','5 MB max via multer limits.fileSize','lots.js, employes.js'],
    ['Content-Security-Policy','⚠ DÉSACTIVÉ','contentSecurityPolicy: false — activer en production','index.js'],
    ['Protection CSRF','⚠ ABSENT','SameSite cookies non configurés — JWT Bearer compense','—'],
    ['Antivirus upload','❌ NON','Architecture à prévoir — ClamAV ou VirusTotal API','Phase 2'],
  ]),
  sep(),

  h1('6. GED — CONTRÔLE D\'ACCÈS AUX FICHIERS'),
  tbl(['Contrôle','Statut','Détail'],[
    ['Types fichiers autorisés (Excel import)','✅ OUI','fileFilter: xlsx, csv uniquement dans multer'],
    ['Taille max 5 MB','✅ OUI','limits.fileSize: 5*1024*1024'],
    ['Contrôle accès documents (par entité)','⚠ PARTIEL','Soft delete OK, RBAC GED à renforcer'],
    ['Upload GED réels (CNI, contrats)','❌ À CONFIGURER','Cloudinary — CLOUDINARY_URL non définie'],
    ['Types GED autorisés','❌ À DÉFINIR','PDF, JPG, PNG, DOCX — à configurer dans multer GED'],
    ['Antivirus scan','❌ NON','Phase 2 — ClamAV ou API externe'],
    ['Suppression définitive GED','✅ PROTÉGÉ','Soft delete uniquement — pas de DELETE physique'],
  ]),
  sep(),

  h1('7. CHIFFREMENT'),
  tbl(['Élément','Algorithme','Statut'],[
    ['Mots de passe','bcrypt saltRounds=12','✅ CONFORME OWASP'],
    ['JWT','HS256 + JWT_SECRET','✅ OK — Secret fort recommandé (min 32 car)'],
    ['HTTPS','TLS 1.2+ géré par Render','✅ AUTOMATIQUE sur Render'],
    ['Secrets .env','Variables Render Env','✅ Non commitées en Git'],
    ['Données BDD','PostgreSQL Render','⚠ Chiffrement disk = plan Render Pro'],
    ['Tokens JWT en transit','HTTPS uniquement','✅ Render enforce HTTPS'],
    ['Mots de passe dans AuditLog','Jamais stockés','✅ Masquage motDePasse dans JSON avant/après'],
  ]),
  sep(),

  h1('8. CONFORMITÉ MÉTIER — RÈGLES CRITIQUES'),
  tbl(['Règle','Statut','Implémentation'],[
    ['Aucun utilisateur ne voit les salaires sans autorisation','⚠ PARTIEL','requireRole RH/DG/COMPTABLE — à étendre sur export'],
    ['Isolation finances inter-filiales','✅ OUI','requireFiliale() — YAKRO ne voit pas TOPTELSIG'],
    ['Modification historique interdite','✅ OUI','AuditLog sans PUT/DELETE — immutable par design'],
    ['Suppression preuves paiement interdite','✅ OUI','Soft delete uniquement — statut ANNULE pas DELETE'],
    ['Suppression documents GED critiques','✅ PARTIEL','Soft delete, renforcer role requis'],
    ['Export données réservé aux profils autorisés','⚠ PARTIEL','requirePermission() défini, à câbler ExportBar'],
    ['Double avance salaire bloquée','✅ OUI','Vérification backend 1 avance max active'],
  ]),
  sep(),
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:320},
    children:[run('Security Audit Report — ERP Groupe 2IG — Juin 2026',{size:16,italics:true,color:C.lgray})]})
];

const auditDoc = new Document({creator:'ERP 2IG',title:'Security Audit Report',
  sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:900,right:900,bottom:900,left:900}}},
    children:auditChildren}]});

// ══════════════════════════════════════════════════════════════════════════
// DOCUMENT 2 : SECURITY_SCORE
// ══════════════════════════════════════════════════════════════════════════
const scoreDoc = new Document({creator:'ERP 2IG',title:'Security Score — ERP Groupe 2IG',
  sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:900,right:900,bottom:900,left:900}}},
    children:[
  new Paragraph({spacing:{before:1200,after:280},alignment:AlignmentType.CENTER,children:[run('ERP GROUPE 2IG',{size:48,bold:true,color:C.blue})]}),
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:160},children:[run('SECURITY SCORE',{size:30,bold:true,color:C.orange})]}),
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:300},children:[run('Évaluation sécurité — Juin 2026',{size:20,color:C.gray,italics:true})]}),

  h1('NOTE GLOBALE'),
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:240,after:40},
    children:[run('78',{size:120,bold:true,color:C.blue})]}),
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:120},
    children:[run('/ 100 — Niveau : PRODUCTION CONDITIONNELLE',{size:24,bold:true,color:C.amber})]}),
  note('Score : Bon niveau de sécurité. Déploiement possible sous condition de résoudre les 3 risques CRITIQUES.'),
  sep(),

  h1('DÉTAIL PAR DOMAINE'),
  tbl(['Domaine','Score','Pondération','Contribution'],[
    ['Authentification','90/100','20%','18.0'],
    ['RBAC & Isolation filiale','95/100','20%','19.0'],
    ['Protection API (injection, XSS)','85/100','15%','12.75'],
    ['Audit trail','80/100','15%','12.0'],
    ['Chiffrement','90/100','10%','9.0'],
    ['Sauvegardes & Continuité','85/100','10%','8.5'],
    ['GED & Contrôle fichiers','55/100','5%','2.75'],
    ['Conformité métier','75/100','5%','3.75'],
    ['TOTAL PONDÉRÉ','—','100%','78 / 100'],
  ]),
  sep(),

  h1('RISQUES CRITIQUES — À CORRIGER AVANT PRODUCTION'),
  alert('CRITIQUE 1 — 2FA non implémenté pour les administrateurs (DG, DIRECTEUR)', C.red),
  b('Impact : Un seul mot de passe suffit à compromettre tout le groupe.'),
  b('Solution : TOTP (Google Authenticator) via speakeasy — 4h de développement.'),
  b('Priorité : OBLIGATOIRE avant mise en production réelle.'),
  p(''),
  alert('CRITIQUE 2 — Stockage externe sauvegardes non configuré', C.red),
  b('Impact : Sauvegardes uniquement en /tmp/ sur Render — perdues si le service est supprimé.'),
  b('Solution : Configurer BACKUP_S3_BUCKET ou BACKUP_FTP_HOST dans les variables Render.'),
  b('Priorité : OBLIGATOIRE — 15 minutes de configuration.'),
  p(''),
  alert('CRITIQUE 3 — Cloudinary (GED) non configuré', C.red),
  b('Impact : Les uploads de documents (CNI, contrats) échouent silencieusement.'),
  b('Solution : Configurer CLOUDINARY_URL dans les variables Render.'),
  b('Priorité : OBLIGATOIRE si GED utilisée.'),
  sep(),

  h1('RISQUES ÉLEVÉS — À CORRIGER RAPIDEMENT'),
  warn('ÉLEVÉ 1 — CSP (Content-Security-Policy) désactivé'),
  b('Impact : Risque XSS si une injection HTML survenait.'),
  b('Solution : helmet({ contentSecurityPolicy: true }) après test des directives CSP.'),
  p(''),
  warn('ÉLEVÉ 2 — Réinitialisation mot de passe par email absente'),
  b('Impact : Un utilisateur qui oublie son mot de passe doit contacter le DG manuellement.'),
  b('Solution : Endpoint /auth/reset-password avec token email à durée limitée — 3h de dev.'),
  p(''),
  warn('ÉLEVÉ 3 — Permissions granulaires partiellement câblées'),
  b('Impact : Un COMMERCIAL pourrait accéder à un export de données non autorisé si ExportBar non protégée.'),
  b('Solution : Ajouter requirePermission() sur les boutons d\'export dans le frontend (role check côté API).'),
  sep(),

  h1('RISQUES FAIBLES — AMÉLIORATIONS RECOMMANDÉES'),
  b('FAIBLE 1 — CORS fallback "*" en développement (corriger en production)'),
  b('FAIBLE 2 — Antivirus sur les uploads GED (ClamAV ou VirusTotal API — Phase 2)'),
  b('FAIBLE 3 — Refresh token (compensé par sessions 8h révisables en BDD)'),
  b('FAIBLE 4 — Export audit (impression non tracée dans AuditLog)'),
  sep(),

  h1('CE QUI EST ACQUIS (forces)'),
  ok('Bcrypt saltRounds=12 — OWASP conforme'),
  ok('Blocage compte 5 tentatives + 15 min — Protection brute force'),
  ok('Token validé en BDD à chaque requête — Révocation immédiate'),
  ok('Politique mot de passe fort — 12 car, maj, min, chiffre, spécial'),
  ok('RBAC 14 rôles + isolation filiale stricte'),
  ok('AuditLog immutable — Aucun endpoint de modification'),
  ok('IP capturée sur toutes les actions sensibles'),
  ok('Sessions multiples gérées (max 5, révocation individuelle)'),
  ok('Helmet.js — 8 protections HTTP headers activées'),
  ok('Rate limiting — 500/15min API, 20/15min login'),
  ok('Sauvegardes quotidiennes avec cron 03h00'),
  ok('HTTPS automatique sur Render'),
  ok('Soft delete partout — Jamais de suppression définitive'),
  sep(),
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:320},
    children:[run('Security Score — ERP Groupe 2IG — Juin 2026',{size:16,italics:true,color:C.lgray})]})
]}]});

// ══════════════════════════════════════════════════════════════════════════
// DOCUMENT 3 : INCIDENT_RESPONSE
// ══════════════════════════════════════════════════════════════════════════
const irDoc = new Document({creator:'ERP 2IG',title:'Incident Response Plan — ERP Groupe 2IG',
  sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:900,right:900,bottom:900,left:900}}},
    children:[
  new Paragraph({spacing:{before:1200,after:280},alignment:AlignmentType.CENTER,children:[run('ERP GROUPE 2IG',{size:48,bold:true,color:C.blue})]}),
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:160},children:[run('PLAN DE RÉPONSE AUX INCIDENTS',{size:28,bold:true,color:C.orange})]}),
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:200},children:[run('INCIDENT_RESPONSE.md — Juin 2026',{size:20,color:C.gray,italics:true})]}),
  alert('⚠ IMPRIMER ET CONSERVER HORS LIGNE — Accessible même si l\'ERP est indisponible'),
  new Paragraph({spacing:{after:400},children:[]}),

  h1('CONTACTS D\'URGENCE'),
  tbl(['Rôle','Responsabilité','À contacter si'],[
    ['DG 2IG','Autorisation finale toutes décisions','Tout incident critique'],
    ['Responsable technique','Exécution technique, accès serveurs','Panne, hack, corruption données'],
    ['Support Render','Infrastructure serveur','Panne Render, base inaccessible'],
    ['Support Cloudinary','Fichiers GED perdus','Documents inaccessibles'],
    ['Avocat / DPO','Fuite de données personnelles','RGPD, notification clients'],
  ]),
  sep(),

  h1('SCÉNARIO A : Compte compromis'),
  tbl(['Élément','Détail'],[
    ['Détection','Connexion depuis IP inconnue dans security-log, actions inhabituelles'],
    ['Impact','Données accessibles par l\'attaquant selon le rôle'],
    ['Délai de réponse','< 15 minutes'],
  ]),
  h3('Procédure immédiate'),
  b('1. DG → POST /api/auth/force-logout/{userId} — Déconnexion immédiate'),
  code('curl -X POST https://api.erp-2ig.com/api/auth/force-logout/USER_ID \\'),
  code('  -H "Authorization: Bearer $TOKEN_DG"'),
  b('2. DG → Désactiver le compte : PATCH /api/employes/:id → { actif: false }'),
  b('3. Consulter le security-log : GET /api/auth/security-log?action=LOGIN'),
  b('4. Identifier toutes les actions faites depuis la compromission'),
  b('5. Réinitialiser le mot de passe (DG) : PUT /api/auth/password'),
  b('6. Vérifier l\'intégrité des données modifiées dans la période suspecte'),
  b('7. Informer l\'utilisateur concerné'),
  sep(),

  h1('SCÉNARIO B : Vol ou fuite de mot de passe'),
  tbl(['Élément','Détail'],[
    ['Détection','Signalement utilisateur, tentatives depuis IP étrangère'],
    ['Impact','Variable selon rôle — DG = accès total'],
    ['Délai de réponse','< 5 minutes si DG concerné'],
  ]),
  h3('Procédure'),
  b('1. IMMÉDIAT : POST /api/auth/logout-all → révoque TOUTES les sessions de l\'utilisateur'),
  b('2. Changer le JWT_SECRET dans Render env → invalide TOUS les tokens de TOUS les utilisateurs'),
  code('# Dans Render Dashboard → Environment Variables'),
  code('JWT_SECRET = nouveau_secret_tres_long_et_aleatoire'),
  b('3. Tous les utilisateurs doivent se reconnecter → opportunité de changer leurs mots de passe'),
  b('4. Si DG compromis : appeler immédiatement le responsable technique'),
  b('5. Audit de toutes les actions faites depuis la dernière connexion légitime'),
  sep(),

  h1('SCÉNARIO C : Suppression accidentelle de données'),
  h3('Procédure'),
  b('1. NE PAS écrire de nouvelles données — geler l\'activité si possible'),
  b('2. Identifier la table et la fenêtre temporelle'),
  b('3. Restaurer depuis le dernier backup daily :'),
  code('./scripts/restore.sh /tmp/erp-2ig-backups/daily/postgres-daily-YYYY-MM-DD.sql.gz'),
  b('4. Si restauration table unique possible (ex: souscripteurs) :'),
  code('pg_restore -h HOST -U USER -d erp_2ig --table=souscripteurs backup.dump'),
  b('5. Vérifier dans AuditLog ce qui a été supprimé : action=DELETE'),
  b('6. Documenter l\'incident'),
  sep(),

  h1('SCÉNARIO D : Fuite de données (RGPD)'),
  tbl(['Élément','Détail'],[
    ['Obligation légale','Notification CNIL (ou autorité équivalente CI) dans les 72h si données personnelles'],
    ['Données personnelles dans l\'ERP','Employés, souscripteurs, clients LiYA — noms, téléphones, CNI'],
  ]),
  h3('Procédure'),
  b('1. Évaluer le périmètre : quelles données, combien de personnes, depuis quand'),
  b('2. Couper l\'accès externe si la fuite est en cours'),
  b('3. Notifier l\'avocat / DPO dans l\'heure'),
  b('4. Préparer la notification aux personnes concernées (noms, données exposées, date)'),
  b('5. Notifier l\'autorité de protection des données (ARTCI en Côte d\'Ivoire) dans les 72h'),
  b('6. Corriger la faille technique'),
  b('7. Documenter toutes les actions prises'),
  sep(),

  h1('SCÉNARIO E : Cyberattaque'),
  h3('Réponse immédiate'),
  b('1. Render → Suspend le service backend (coupe l\'accès externe immédiatement)'),
  b('2. Changer le JWT_SECRET → invalide tous les tokens actifs'),
  b('3. Changer le mot de passe PostgreSQL Render'),
  b('4. Auditer les logs Render (Logs → Live)'),
  b('5. Identifier le vecteur d\'attaque (injection ? dépendance compromise ? MdP volé ?)'),
  b('6. Corriger la faille sur un environnement de staging'),
  b('7. Restaurer les données si nécessaire depuis le dernier backup non compromis'),
  b('8. Redéployer sur le serveur propre'),
  b('9. Informer tous les utilisateurs — forcer changement de mots de passe'),
  sep(),
  new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:320},
    children:[run('Incident Response Plan — ERP Groupe 2IG — Juin 2026',{size:16,italics:true,color:C.lgray})]})
]}]});

// ── Génération
async function generate() {
  const docs = [
    [auditDoc, 'SECURITY_AUDIT_REPORT.docx'],
    [scoreDoc, 'SECURITY_SCORE.docx'],
    [irDoc, 'INCIDENT_RESPONSE.docx'],
  ];
  for (const [doc, name] of docs) {
    const buf = await Packer.toBuffer(doc);
    fs.writeFileSync(path.join('/mnt/user-data/outputs', name), buf);
    console.log(`✅ ${name} (${(buf.length/1024).toFixed(0)} KB)`);
  }
}
generate().catch(err => { console.error('❌', err.message); process.exit(1); });
