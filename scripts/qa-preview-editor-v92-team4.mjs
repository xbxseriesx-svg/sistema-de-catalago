import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const [html, bundle, core, capture, team4, e2e, versionRaw] = await Promise.all([
  readFile('public/index.html', 'utf8'),
  readFile('public/assets/index-V60Excel.js', 'utf8'),
  readFile('public/preview-editor-v91-core.js', 'utf8'),
  readFile('public/preview-editor-v91-capture.js', 'utf8'),
  readFile('public/preview-editor-v92-team4.js', 'utf8'),
  readFile('tests/e2e/preview-editor-team4-v92.spec.mjs', 'utf8'),
  readFile('VERSION', 'utf8'),
]);
const release = versionRaw.trim();

assert.match(html, new RegExp(`preview-editor-v92-team4\\.js\\?v=${release}(?:["&])`), 'Equipe 4 V92 precisa continuar carregada como pré-gate com o cache da release corrente.');
assert.ok(html.indexOf('/preview-editor-v91-capture.js') < html.indexOf('/preview-editor-v92-team4.js'), 'Equipe 4 deve auditar a captura produzida pelo Grupo 3.');
assert.ok(html.indexOf('/preview-editor-v92-team4.js') < html.indexOf('/assets/index-V60Excel.js'), 'Equipe 4 precisa estar ativa antes do bundle/editor.');

assert.match(bundle, /ASTER_V92_PREVIEW_APPLY_BRIDGE/, 'Bundle publicado precisa conter a ponte V92 para a árvore aprovada.');
assert.match(bundle, /__ASTERYON_PREVIEW_EDITOR_APPLY_V92__/, 'Handler React precisa consumir o payload one-shot aprovado do Preview.');
assert.match(bundle, /V92A.modelName===b/, 'Payload V92 só pode ser consumido pelo mesmo modelo que originou o Preview.');
assert.match(bundle, /V92A.team3Ok===!0&&V92A.team4Ok===!0/, 'Handler só pode consumir árvore com dupla aprovação prévia.');
assert.match(capture, /__ASTERYON_PREVIEW_EDITOR_APPLY_V92__/, 'Captura precisa entregar o payload aprovado ao handler real.');
assert.match(capture, /team3Ok: report.ok === true/, 'Payload deve carregar aprovação da Equipe 3.');
assert.ok(capture.includes('team4Ok: team4Request.team4Report?.ok === true'), 'Payload deve carregar aprovação da Equipe 4.');

assert.match(core, /document\.querySelector\('\[data-node-id\]'\)/, 'Detecção do Editor precisa reconhecer o canvas editável real.');
assert.match(core, /data-asteryon-editor-sidebar/, 'Detecção estrutural deve confirmar chrome do editor, não apenas um título.');
assert.doesNotMatch(core, /const isEditor = \(\) => location\.pathname\.startsWith\('\/admin'\) &&/, 'V92 não pode voltar a depender exclusivamente do heading Editar catálogo.');

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

for (const file of ['public/preview-editor-v91-capture.js', 'public/preview-editor-v92-team4.js', 'scripts/patch-preview-apply-v92.mjs', 'scripts/qa-preview-editor-v92-team4.mjs', 'tests/e2e/preview-editor-team4-v92.spec.mjs']) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

console.log(`QA compatibilidade V92 na release V${release}: pré-gate, causa real, auditoria pré-mutação e aprovação dupla preservados.`);
