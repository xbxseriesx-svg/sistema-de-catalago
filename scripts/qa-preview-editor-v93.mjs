import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const [html, source, capture, visual, team4, bundle] = await Promise.all([
  readFile('public/index.html', 'utf8'),
  readFile('public/preview-editor-v93-source.js', 'utf8'),
  readFile('public/preview-editor-v91-capture.js', 'utf8'),
  readFile('public/preview-editor-v93-visual-gate.js', 'utf8'),
  readFile('public/preview-editor-v93-team4.js', 'utf8'),
  readFile('public/assets/index-V60Excel.js', 'utf8'),
]);

assert.match(html, /ASTERYON Editor V93/, 'Release visual precisa estar em V93.');
assert.match(html, /preview-editor-v93-source\.js\?v=93/, 'Fonte V93 precisa carregar.');
assert.match(html, /preview-editor-v93-visual-gate\.js\?v=93/, 'Gate visual V93 precisa carregar.');
assert.match(html, /preview-editor-v93-team4\.js\?v=93/, 'Equipe 4 V93 precisa carregar.');
assert.ok(html.indexOf('/preview-editor-v91-core.js') < html.indexOf('/preview-editor-v93-source.js'), 'Core deve existir antes da fonte V93.');
assert.ok(html.indexOf('/preview-editor-v93-source.js') < html.indexOf('/preview-editor-v91-capture.js'), 'V93 deve assumir o clique antes do capturador legado.');

assert.match(source, /ASTER_V93_FILLED_PREVIEW_SOURCE/, 'Fonte corrente precisa do marcador V93.');
assert.match(source, /sourceOfTruth: 'preview-final-filled-v93'/, 'Preview preenchido precisa ser a fonte oficial.');
assert.match(source, /legacyTemplateDisabled: true/, 'Árvore antiga precisa ficar desabilitada como fonte.');
assert.match(source, /previewLayoutGroup: true/, 'Captura precisa preservar grupos hierárquicos.');
assert.match(source, /relativeBox\(rect, parentRect, sourceScale\)/, 'Filhos precisam usar geometria relativa ao grupo.');
assert.match(source, /linePx \/ fontSize/, 'Line-height precisa ser normalizado para o renderer.');
assert.match(source, /previewSourceRect/, 'Nós precisam carregar geometria de referência da Prévia.');
assert.match(source, /previewProductCard: true/, 'Cards de produto precisam ser identificáveis no gate visual.');
assert.match(source, /Aplicar modelo preenchido V93/, 'Templates correntes precisam indicar aplicação preenchida.');
assert.match(source, /hasApprovedOneShot\(\)/, 'Aplicação direta antiga precisa ser bloqueada sem payload aprovado.');
assert.match(source, /previewButton\.click\(\)/, 'Clique legado precisa ser redirecionado para a Prévia preenchida.');
assert.match(source, /__ASTERYON_PREVIEW_EDITOR_APPLY_V92__/, 'Compatibilidade com a ponte one-shot do handler React deve ser preservada.');
assert.match(capture, /event\.__asteryonV93Captured/, 'Capturador legado precisa sair quando V93 já tratou o clique.');
assert.match(bundle, /ASTER_V92_PREVIEW_APPLY_BRIDGE/, 'Ponte React one-shot aprovada precisa continuar presente.');

assert.match(visual, /geometryDriftCount/, 'Grupo 3 V93 precisa medir divergência geométrica.');
assert.match(visual, /productGeometryDriftCount/, 'Grupo 3 V93 precisa reprovar produtos desproporcionais.');
assert.match(visual, /missingHeroTexts/, 'Grupo 3 V93 precisa reprovar textos do hero ausentes.');
assert.match(visual, /asteryonV93VisualParity/, 'Grupo 3 V93 precisa publicar resultado verificável.');
assert.match(team4, /independentAudit/, 'Equipe 4 precisa recalcular a auditoria independentemente.');
assert.match(team4, /asteryonTeam4V93/, 'Equipe 4 precisa publicar aprovação própria.');
assert.match(team4, /productGeometryDriftCount/, 'Equipe 4 precisa auditar proporção dos produtos.');
assert.match(team4, /4\/4 grupos aprovados/, 'Regra de release deve exigir os quatro grupos.');

for (const file of [
  'public/preview-editor-v93-source.js',
  'public/preview-editor-v93-visual-gate.js',
  'public/preview-editor-v93-team4.js',
  'scripts/patch-v93-filled-preview.mjs',
  'scripts/qa-preview-editor-v93.mjs',
]) execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });

console.log('QA V93: Preview preenchido é fonte corrente; hierarquia, tipografia, geometria, produtos e Equipe 4 estão protegidos.');