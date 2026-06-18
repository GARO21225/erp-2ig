/**
 * Script de secours — débloque un compte directement en BDD
 * sans passer par l'API (utile si le DG lui-même est verrouillé
 * et que personne ne peut se connecter pour le débloquer).
 *
 * Usage sur Render (Shell du service backend) :
 *   node scripts/unlock-account.js email@exemple.com
 *
 * Sans argument : liste tous les comptes actuellement verrouillés.
 */
const prisma = require('../src/lib/prisma');

async function main() {
  const email = process.argv[2];

  if (!email) {
    const verrouilles = await prisma.utilisateur.findMany({
      where: { lockedUntil: { gt: new Date() } },
      select: { email: true, nom: true, prenom: true, role: true, lockedUntil: true, loginAttempts: true },
    });
    if (verrouilles.length === 0) {
      console.log('Aucun compte verrouillé actuellement.');
    } else {
      console.log('Comptes verrouillés :');
      verrouilles.forEach(u => {
        const minutesRestantes = Math.ceil((new Date(u.lockedUntil) - Date.now()) / 60000);
        console.log(`  ${u.email} (${u.prenom} ${u.nom}, ${u.role}) — ${u.loginAttempts} tentatives — ${minutesRestantes} min restantes`);
      });
      console.log('\nPour débloquer : node scripts/unlock-account.js <email>');
    }
    process.exit(0);
  }

  const user = await prisma.utilisateur.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) {
    console.error(`Aucun compte trouvé pour l'email : ${email}`);
    process.exit(1);
  }

  await prisma.utilisateur.update({
    where: { id: user.id },
    data: { loginAttempts: 0, lockedUntil: null },
  });

  console.log(`✅ Compte débloqué : ${user.prenom} ${user.nom} (${user.email}, rôle ${user.role})`);
  process.exit(0);
}

main().catch(e => { console.error('Erreur :', e.message); process.exit(1); });
