import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile('public/editor-overflow-fix.css', 'utf8');
const controller = await readFile('public/product-modal-v66.js', 'utf8');
const html = await readFile('public/index.html', 'utf8');
const version = Number((await readFile('VERSION', 'utf8')).trim());

assert.ok(Number.isFinite(version) && version >= 66, 'Versão precisa preservar a correção V66 ou superior.');
assert.match(html, new RegExp(`ASTERYON Editor V${version}`), 'Título precisa acompanhar VERSION.');
assert.match(html, new RegExp(`editor-overflow-fix\\.css\\?v=${version}`), 'CSS de overflow precisa usar cache-busting da versão atual.');
assert.match(html, /product-modal-v66\.js/, 'Controlador V66 não está carregado.');

assert.match(css, /data-asteryon-product-modal-root/, 'Raiz do modal V66 não está protegida.');
assert.match(css, /align-items:\s*flex-start\s*!important/, 'Modal não está alinhado pelo topo.');
assert.match(css, /height:\s*100dvh\s*!important/, 'Raiz do modal não está limitada ao viewport dinâmico.');
assert.match(css, /max-height:\s*calc\(100dvh - 24px\)\s*!important/, 'Painel não possui altura máxima segura.');
assert.match(css, /overflow-y:\s*scroll\s*!important/, 'Scrollbar interna do produto não é garantida.');
assert.match(css, /position:\s*sticky\s*!important/, 'Cabeçalho do produto não permanece visível.');
assert.match(css, /button\[aria-label="Fechar produto"\]/, 'Botão Fechar não possui proteção de layout.');

assert.match(controller, /MutationObserver/, 'Controlador não observa abertura/troca de produto.');
assert.match(controller, /document\.body\.style\.overflow = 'hidden'/, 'Fundo não é bloqueado durante o modal.');
assert.match(controller, /panel\.scrollTop = 0/, 'Troca por produto similar não retorna ao topo.');
assert.match(controller, /event\.key !== 'Escape'/, 'Fechamento por Escape não está protegido.');

console.log(`QA Produto V66+ OK na V${version}: viewport, scrollbar, cabeçalho/fechar fixos e reset de scroll nos similares.`);
