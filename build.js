// Construit le site dans le dossier "dist" à partir des photos des dossiers "book" et "accueil".
// Lancé automatiquement par Netlify à chaque modification sur GitHub.
const fs = require('fs');
const path = require('path');

let sharp = null;
try { sharp = require('sharp'); } catch (e) { console.log('sharp indisponible : les photos seront copiées sans redimensionnement'); }

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const IMG = /\.(jpe?g|png|webp)$/i;

// Dossier du book -> code du filtre dans la page
const CATEGORIES = {
  streetwear: 'street',
  fitness: 'fit',
  lifestyle: 'life',
  habille: 'dress',
  portrait: 'portrait',
};
const LABELS = { street: 'Streetwear', fit: 'Fitness', life: 'Lifestyle', dress: 'Habillé', portrait: 'Portrait' };
const LABEL_KEYS = { fit: 'c_fit', life: 'c_life', dress: 'c_dress', portrait: 'c_portrait' };

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    const s = path.join(src, f), d = path.join(dst, f);
    if (fs.statSync(s).isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

function listImages(dir) {
  if (!fs.existsSync(dir)) return [];
  // Les noms les plus "grands" d'abord : les photos envoyées depuis l'iPhone (IMG_xxxx) passent devant
  return fs.readdirSync(dir).filter(f => IMG.test(f)).sort((a, b) => b.localeCompare(a, 'en', { numeric: true }));
}

async function processImage(src, dstName) {
  const dst = path.join(OUT, 'img', dstName);
  if (sharp) {
    try {
      await sharp(src).rotate().resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80, progressive: true, mozjpeg: true }).toFile(dst);
      return dstName;
    } catch (e) { console.log('Photo ignorée (format non lu) :', src); return null; }
  }
  fs.copyFileSync(src, dst);
  return dstName;
}

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  copyDir(path.join(ROOT, 'site'), OUT);
  fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });

  // Book
  const book = [];
  for (const [folder, code] of Object.entries(CATEGORIES)) {
    for (const f of listImages(path.join(ROOT, 'book', folder))) {
      const out = await processImage(path.join(ROOT, 'book', folder, f), `book-${folder}-${f.replace(IMG, '')}.jpg`.replace(/\s+/g, '-'));
      if (out) book.push({ src: 'img/' + out, code, name: f });
    }
  }
  book.sort((a, b) => b.name.localeCompare(a.name, 'en', { numeric: true }));

  // Accueil (diaporama)
  const hero = [];
  for (const f of listImages(path.join(ROOT, 'accueil'))) {
    const out = await processImage(path.join(ROOT, 'accueil', f), `accueil-${f.replace(IMG, '')}.jpg`.replace(/\s+/g, '-'));
    if (out) hero.push('img/' + out);
  }
  if (!hero.length) hero.push(...book.slice(0, 5).map(b => b.src));

  const label = code => {
    const k = LABEL_KEYS[code];
    return `<span${k ? ` data-i18n="${k}"` : ''}>${LABELS[code]}</span>`;
  };

  const heroHtml = hero.map((src, i) => `      <div class="slide${i === 0 ? ' on' : ''}"><img src="${esc(src)}" alt=""></div>`).join('\n');
  const railHtml = book.slice(0, 6).map(b => `        <a class="tile" href="#book"><img src="${esc(b.src)}" alt="" loading="lazy">${label(b.code)}</a>`).join('\n');
  const bookHtml = book.map(b => `        <figure class="tile" data-c="${b.code}"><img src="${esc(b.src)}" alt="Photo ${LABELS[b.code]}" loading="lazy"></figure>`).join('\n');

  const file = path.join(OUT, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace('<!--HERO-->', heroHtml).replace('<!--RAIL-->', railHtml).replace('<!--BOOK-->', bookHtml);
  fs.writeFileSync(file, html);

  console.log(`Site prêt : ${book.length} photos dans le book, ${hero.length} dans le diaporama.`);
})();
