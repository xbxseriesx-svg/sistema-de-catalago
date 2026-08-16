import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const bundle = await readFile('public/assets/index-V60Excel.js', 'utf8');

assert.doesNotMatch(bundle, /q\.useState\(ZH\)/, 'CatalogProvider ainda inicia com produtos fictícios.');
assert.doesNotMatch(bundle, /q\.useState\(GH\)/, 'CatalogProvider ainda inicia com marcas fictícias.');
assert.doesNotMatch(bundle, /q\.useState\(\$H\)/, 'CatalogProvider ainda inicia com distribuições fictícias.');
assert.doesNotMatch(bundle, /q\.useState\(WH\)/, 'CatalogProvider ainda inicia com hierarquia fictícia.');
assert.doesNotMatch(bundle, /q\.useState\(KH\)/, 'CatalogProvider ainda inicia com promoções fictícias.');
assert.match(bundle, /function JH\(\{children:e\}\)\{const\[t,a\]=q\.useState\(\[\]\),\[r,n\]=q\.useState\(\[\]\),\[i,o\]=q\.useState\(\[\]\),\[s,d\]=q\.useState\(\[\]\),\[h,u\]=q\.useState\(\[\]\)/, 'CatalogProvider V63 não inicia vazio.');
assert.doesNotMatch(bundle, /\["Atacado","Distribuição"\]\.includes\(/, 'Ainda existe filtro fixo Atacado/Distribuição.');
assert.doesNotMatch(bundle, /Selecione Atacado ou Distribuição\./, 'Mensagem antiga de departamento ainda existe.');
assert.doesNotMatch(bundle, /M\.departamentoName\|\|"Atacado"/, 'Formulário ainda força Atacado como fallback.');
assert.match(bundle, /Qe\.getCatalog\(!1\)/, 'Carga administrativa do catálogo ausente.');
assert.match(bundle, /catch\{m=await Qe\.getCatalog\(!0\)\}/, 'Fallback para catálogo público do Supabase ausente.');
assert.match(bundle, /Falha ao carregar catálogo do Supabase/, 'Erro de catálogo ainda não identifica Supabase.');

console.log('QA catálogo V63 OK: sem seed fictício, sem departamentos fixos e com fallback Supabase.');
