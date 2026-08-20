import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const [html, capture, team4, e2e] = await Promise.all([
  readFile('public/index.html', 'utf8'),
  readFile('public/preview-editor-v91-capture.js', 'utf8'),
  readFile('public/preview-editor-v92-team4.js', 'utf8'),
  readFile('tests/e2e/preview-editor-team4-v92.spec.mjs', 'utf8'),
]);

assert.match(html, /preview-editor-v92-team4\.js\?v=92/, 'Equipe 4 precisa carregar na release V92.');
assert.ok(html.indexOf('/preview-editor-v91-capture.js') < html.indexOf('/preview-editor-v92-team4.js'), 'Equipe 4 deve auditar a captura produzida pelo Grupo 3.');
assert.ok(html.indexOf('/preview-editor-v92-team4.js') < html.indexOf('/assets/index-V60Excel.js'), 'Equipe 4 precisa estar ativa antes do bundle/editor.');

assert.match(capture, /text\.includes\(name\)/, 'Marca sem logo precisa ser identificada pelo nome mesmo com subtítulo visível.');
assert.match(capture, /card\.querySelector\('strong'\)/, 'Nome da marca sem logo deve vir do elemento visual real, não do textContent agregado.');
assert.match(capture, /querySelectorAll\('strong,small,span,p'\)/, 'Captura deve copiar todos os textos visíveis do card de marca sem logo.');
assert.match(capture, /S\.stylesFrom\(item\)/, 'Textos de fallback de marca precisam preservar estilos reais do Preview.');
assert.match(capture, /relativeGeometry\(rect, cardRect, width \/ cardRect\.width\)/, 'Textos de fallback precisam preservar geometria real do Preview.');
assert.match(capture, /asteryon:team4-preflight-request-v92/, 'Grupo 3 precisa pedir auditoria síncrona da Equipe 4 antes de alterar a árvore.');
assert.match(capture, /team4Request\.team4Report\?\.ok !== true/, 'Grupo 3 deve bloquear quando a Equipe 4 não aprovar o preflight.');
assert.ok(
  capture.indexOf('asteryon:team4-preflight-request-v92') < capture.indexOf('S.replaceTemplateNodes(result.modelName, result.nodes)'),
  'A aprovação da Equipe 4 obrigatoriamente precisa ocorrer antes de substituir a árvore do template.',
);

assert.match(team4, /asteryon:team4-preflight-request-v92/, 'Equipe 4 precisa responder à solicitação pré-mutação da Equipe 3.');
assert.match(team4, /event\.detail\.team4Report = report/, 'Equipe 4 precisa devolver seu resultado independente de forma síncrona.');
assert.match(team4, /asteryon:preview-final-copied-v91/, 'Equipe 4 deve observar também a conclusão da cópia da Equipe 3.');
assert.match(team4, /asteryon:preview-editor-parity-v91/, 'Equipe 4 precisa auditar o relatório pós-renderização da Equipe 3.');
assert.match(team4, /group3ApplyOk/, 'Equipe 4 deve verificar explicitamente a aprovação da Equipe 3.');
assert.match(team4, /missingImages\.length === 0/, 'Equipe 4 deve exigir zero imagens ausentes.');
assert.match(team4, /missingTexts\.length === 0/, 'Equipe 4 deve exigir zero textos ausentes.');
assert.match(team4, /missingBrandLogos\.length === 0/, 'Equipe 4 deve exigir zero logos ausentes.');
assert.match(team4, /blockApply/, 'Equipe 4 precisa manter uma barreira defensiva de aplicação.');
assert.match(team4, /blockPublish/, 'Equipe 4 precisa poder bloquear a publicação.');
assert.match(team4, /group4:/, 'A regra operacional deve registrar a Equipe 4.');
assert.match(team4, /somente Equipe 3 APROVADA \+ Equipe 4 APROVADA/, 'Release deve depender de aprovação dupla.');

assert.match(e2e, /Aplicar este modelo/, 'E2E deve clicar no botão real do Preview Final.');
assert.match(e2e, /Marca do catálogo/, 'E2E deve reproduzir marca sem logo com o subtítulo que causava o bloqueio.');
assert.match(e2e, /Modelo não aplicado/, 'E2E deve falhar se o alerta de produção reaparecer.');
assert.match(e2e, /asteryonTeam4Parity/, 'E2E deve exigir aprovação pós-renderização da Equipe 4.');

for (const file of ['public/preview-editor-v91-capture.js', 'public/preview-editor-v92-team4.js', 'scripts/qa-preview-editor-v92-team4.mjs', 'tests/e2e/preview-editor-team4-v92.spec.mjs']) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

console.log('QA V92 Equipe 4: causa real coberta, auditoria ocorre antes da mutação e aprovação dupla é obrigatória.');
