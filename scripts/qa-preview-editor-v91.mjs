import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const [html, core, capture, runtime, guard] = await Promise.all([
  readFile('public/index.html', 'utf8'),
  readFile('public/preview-editor-v91-core.js', 'utf8'),
  readFile('public/preview-editor-v91-capture.js', 'utf8'),
  readFile('public/preview-editor-v91-runtime.js', 'utf8'),
  readFile('public/preview-editor-v91-guard.js', 'utf8'),
]);

for (const file of ['preview-editor-v91-core.js', 'preview-editor-v91-capture.js', 'preview-editor-v91-runtime.js', 'preview-editor-v91-guard.js']) {
  assert.match(html, new RegExp(`${file.replaceAll('.', '\\.')}\\?v=91`), `${file} precisa estar no HTML publicado com cache key V91.`);
  assert.ok(html.indexOf(`/${file}`) < html.indexOf('/assets/index-V60Excel.js'), `${file} precisa carregar antes do bundle para compartilhar a mesma árvore do template.`);
  execFileSync(process.execPath, ['--check', `public/${file}`], { stdio: 'pipe' });
}

assert.doesNotMatch(html, /\?v=89(?:[&"'])/, 'HTML publicado não pode manter cache key V89 após a release V91.');
assert.match(core, /templateNodeRefs:\s*new Map\(\)/, 'V91 precisa reter referências reais das árvores carregadas pelo editor.');
assert.match(core, /ref\.splice\(0,\s*ref\.length,\s*\.\.\.nodes\)/, 'A árvore original precisa ser substituída in-place para o handler existente receber a cópia do preview.');
assert.match(core, /\/api\/admin\/templates/, 'V91 precisa interceptar a carga dos modelos antes do bundle.');
assert.match(core, /\/api\/public\/catalog/, 'V91 precisa compartilhar a mesma fonte de dados reais usada pelo Preview Final.');
assert.match(core, /brandLogoAuto/, 'Persistência precisa resolver logo automaticamente para nós vinculados a marcas.');
assert.match(core, /styleOverrides/, 'A edição adicional de fundos e gradientes precisa entrar na persistência.');

assert.match(capture, /sourceOfTruth:\s*'preview-final-filled'/, 'Preview Final preenchido deve ser declarado como fonte de verdade do editor.');
assert.match(capture, /previewEditorParityPolicy:\s*'ctrl-c-ctrl-v'/, 'A política obrigatória precisa ser Ctrl+C/Ctrl+V estrutural.');
assert.match(capture, /\.ltp-shell/, 'A cópia precisa nascer do renderer real do Preview Final.');
assert.match(capture, /getBoundingClientRect\(\)/, 'Geometria precisa ser copiada da renderização final, não de um template-base paralelo.');
assert.match(capture, /locked:\s*false/, 'Todos os elementos copiados precisam chegar destravados.');
assert.match(capture, /brandLogoAuto:\s*true/, 'Logo da marca precisa viajar junto com o vínculo.');
assert.match(capture, /actionContext:\s*'brand'/, 'Logo de marca precisa permanecer vinculável no editor.');
assert.match(capture, /carouselAnimated:\s*true/, 'Área de marcas precisa continuar sendo carrossel animado.');
assert.match(capture, /missingImages\.length\s*===\s*0/, 'Grupo 3 deve exigir zero imagens ausentes.');
assert.match(capture, /missingTexts\.length\s*===\s*0/, 'Grupo 3 deve exigir zero textos ausentes.');
assert.match(capture, /missingBrandLogos\.length\s*===\s*0/, 'Grupo 3 deve exigir zero logos de marcas ausentes.');
assert.match(capture, /stopImmediatePropagation\(\)/, 'Aplicação precisa ser bloqueada quando a equivalência falhar.');
assert.match(capture, /S\.replaceTemplateNodes\(result\.modelName,\s*result\.nodes\)/, 'A cópia validada precisa substituir a árvore aplicada pelo editor.');

assert.match(runtime, /editorInitialParityOk:\s*ok/, 'O Editor renderizado precisa passar por uma segunda validação após a aplicação.');
assert.match(runtime, /missingEditorImages/, 'Grupo 3 deve validar imagens efetivamente renderizadas no editor.');
assert.match(runtime, /missingEditorBrandLogos/, 'Grupo 3 deve validar logos efetivamente renderizados no editor.');
assert.match(runtime, /missingEditorTexts/, 'Grupo 3 deve validar textos efetivamente renderizados no editor.');
assert.match(runtime, /startsWith\('marca'\)/, 'Alteração de marca no inspetor precisa acionar atualização automática do logo.');
assert.match(runtime, /Fundo \/ gradiente/, 'Fundo e gradiente precisam permanecer editáveis no modelo copiado.');
assert.match(runtime, /Publicação bloqueada pelo Grupo 3/, 'Modelo divergente não pode ser publicado como se estivesse aprovado.');
assert.match(runtime, /failRule:\s*'qualquer diferença retorna ao Grupo 1'/, 'A regra de retorno aos grupos deve estar codificada.');

assert.match(guard, /brandOverrides\.set\(id,\s*override\)/, 'Card e logo precisam compartilhar a troca de marca vinculada.');
assert.match(guard, /brandLogoAuto:\s*true/, 'A sincronização deve manter o nó de imagem identificado como logo automático da marca.');
assert.match(guard, /actionEntityId:\s*override\.brandId/, 'Card e logo precisam persistir o novo ID de marca.');

console.log('QA V91: Preview Final preenchido = Editor inicial editável, cache V91, logos vinculados, cores e trava do Grupo 3: OK');
