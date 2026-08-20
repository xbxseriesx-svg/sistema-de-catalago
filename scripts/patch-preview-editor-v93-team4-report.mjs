import fs from 'node:fs';

const file = 'public/preview-editor-v93-source.js';
const MARKER = 'ASTER_V93_TEAM4_REPORT_COMPAT';
let source = fs.readFileSync(file, 'utf8');

if (source.includes(MARKER)) {
  console.log('V93: relatório de logos para o Grupo 4 já materializado.');
  process.exit(0);
}

const productSource = "    const sourceProducts = [...result.shell.querySelectorAll('.ltp-product')].filter(visible).length;";
const productTarget = "    const targetProducts = nodes.filter(item => item.props?.previewProductCard).length;";
const missingText = "    const missingTexts = [...new Set(sourceTexts)].filter(item => !targetTexts.includes(item));";
const okOld = "    const ok = nodes.length > 20 && missingImages.length === 0 && missingTexts.length === 0\n      && targetProducts === sourceProducts && unlocked === nodes.length && editable === nodes.length && malformedGeometry.length === 0;";
const sourceSummaryOld = "      source: { images: sourceImages.length, texts: sourceTexts.length, products: sourceProducts },";
const targetSummaryOld = "      target: { nodes: nodes.length, images: targetImages.length, texts: targetTexts.length, products: targetProducts, editable, unlocked },";
const reportOld = "      missingImages, missingTexts, malformedGeometry: malformedGeometry.map(item => item.id),";

for (const [label, token] of [
  ['produtos fonte', productSource],
  ['produtos destino', productTarget],
  ['textos ausentes', missingText],
  ['regra ok', okOld],
  ['resumo fonte', sourceSummaryOld],
  ['resumo destino', targetSummaryOld],
  ['payload do relatório', reportOld],
]) {
  if (!source.includes(token)) throw new Error(`Patch V93 Grupo 4: ponto esperado ausente (${label}).`);
}

source = source.replace(
  productSource,
  `${productSource}\n    const sourceBrandLogos = [...result.shell.querySelectorAll('.ltp-brand img[src]')].filter(visible)\n      .map(item => S.absoluteUrl(item.getAttribute('src'))).filter(Boolean);`,
);
source = source.replace(
  productTarget,
  `${productTarget}\n    const targetBrandLogos = nodes.filter(item => item.props?.brandLogoAuto && item.props?.src)\n      .map(item => S.absoluteUrl(item.props.src)).filter(Boolean);`,
);
source = source.replace(
  missingText,
  `${missingText}\n    const missingBrandLogos = [...new Set(sourceBrandLogos)].filter(item => !targetBrandLogos.includes(item));`,
);
source = source.replace(
  okOld,
  `    const ${MARKER}=true;\n    const ok = nodes.length > 20 && missingImages.length === 0 && missingTexts.length === 0 && missingBrandLogos.length === 0\n      && targetProducts === sourceProducts && unlocked === nodes.length && editable === nodes.length && malformedGeometry.length === 0;`,
);
source = source.replace(
  sourceSummaryOld,
  "      source: { images: sourceImages.length, texts: sourceTexts.length, products: sourceProducts, brandLogos: sourceBrandLogos.length },",
);
source = source.replace(
  targetSummaryOld,
  "      target: { nodes: nodes.length, images: targetImages.length, texts: targetTexts.length, products: targetProducts, brandLogos: targetBrandLogos.length, editable, unlocked },",
);
source = source.replace(
  reportOld,
  "      missingImages, missingTexts, missingBrandLogos, malformedGeometry: malformedGeometry.map(item => item.id),",
);

fs.writeFileSync(file, source);
console.log('V93: Grupo 3 agora reporta paridade independente de logos ao pré-gate do Grupo 4.');
