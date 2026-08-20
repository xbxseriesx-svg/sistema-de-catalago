import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const [runtime, source, team4, v93Visual, v93Team4] = await Promise.all([
  readFile('public/preview-editor-v91-runtime.js', 'utf8'),
  readFile('public/preview-editor-v93-source.js', 'utf8'),
  readFile('public/preview-editor-v92-team4.js', 'utf8'),
  readFile('public/preview-editor-v93-visual-gate.js', 'utf8'),
  readFile('public/preview-editor-v93-team4.js', 'utf8'),
]);

assert.match(runtime, /ASTER_V94_EDITOR_PERFORMANCE/, 'Runtime V91 precisa carregar otimização V94.');
assert.match(runtime, /__ASTERYON_EDITOR_PERF_V94__/, 'Runtime deve expor contadores de performance para QA.');
assert.match(runtime, /observer\.observe\(document\.documentElement, \{ childList: true, subtree: true \}\)/, 'Observer V91 deve observar somente inserções/remoções estruturais.');
assert.doesNotMatch(runtime, /attributes:\s*true/, 'Observer V91 não pode voltar a observar atributos durante drag/resize.');
assert.doesNotMatch(runtime, /attributeFilter:\s*\[['"]class['"],['"]style['"],['"]src['"]\]/, 'Observer V91 não pode acordar por class/style/src.');
assert.match(runtime, /function mutationNeedsRun\(records\)/, 'Observer V91 precisa filtrar mutações antes de agendar trabalho.');
assert.match(runtime, /function stopParityPolling\(\)/, 'Polling de paridade precisa poder ser encerrado.');
assert.match(runtime, /if \(S\.initialParityChecked\) stopParityPolling\(\)/, 'Polling V91 deve encerrar após aprovação inicial.');
assert.match(runtime, /handle = document\.querySelector\('\[style\*=/, 'Seleção deve localizar o handle diretamente em vez de varrer todos os nós.');
assert.doesNotMatch(runtime, /\[\.\.\.document\.querySelectorAll\('\[data-node-id\]'\)\]\.find\(\(item\) => item\.querySelector/, 'Não pode voltar à varredura O(n) por wrapper para detectar seleção.');

assert.match(source, /ASTER_V94_TEMPLATE_OBSERVER_PERFORMANCE/, 'Fonte V93 precisa preservar filtro de observer V94.');
assert.match(source, /function templateMutation\(records\)/, 'Observer de templates precisa filtrar apenas mutações relacionadas ao painel Modelos.');
assert.match(source, /addedNodeTouchesTemplates/, 'Observer de templates deve inspecionar somente nós adicionados.');
assert.match(source, /if \(templateMutation\(records\)\) scheduleTemplateRefresh\(\)/, 'Refresh dos cards deve ocorrer apenas em mutação relevante.');
assert.doesNotMatch(source, /new MutationObserver\(\(\) => requestAnimationFrame\(refreshTemplateCards\)\)/, 'Não pode reintroduzir refresh global em toda mutação do DOM.');

assert.match(team4, /ASTER_V94_TEAM4_IDLE_PERFORMANCE/, 'Equipe 4 V92 precisa carregar otimização de idle V94.');
assert.match(team4, /function stopAuditPolling\(\)/, 'Polling da Equipe 4 precisa poder encerrar.');
assert.match(team4, /if \(state\.approved\) \{\s*clearBanner\(\);\s*stopAuditPolling\(\);/s, 'Equipe 4 deve desligar polling imediatamente após aprovação.');
assert.match(team4, /ensureAuditPolling\(\)/, 'Nova aplicação precisa poder religar auditoria de fallback.');

// Performance nunca pode remover os gates visuais V93.
assert.match(v93Visual, /asteryonV93VisualParity/, 'Gate visual V93 precisa permanecer ativo.');
assert.match(v93Visual, /productGeometryDriftCount/, 'Gate visual precisa continuar auditando proporção dos produtos.');
assert.match(v93Team4, /asteryonTeam4V93/, 'Auditoria independente V93 precisa permanecer ativa.');
assert.match(v93Team4, /independentAudit/, 'Equipe 4 V93 deve continuar recalculando a auditoria visual.');

for (const file of [
  'public/preview-editor-v91-runtime.js',
  'public/preview-editor-v93-source.js',
  'public/preview-editor-v92-team4.js',
]) execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });

console.log('QA Editor V94: observers filtrados, polling encerrável e gates V93 preservados.');
