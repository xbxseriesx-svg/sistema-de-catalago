# Asteryon Catálogo Digital

Protótipo funcional do sistema desenhado na conversa, com dois módulos no mesmo código:

- **Portal público:** `/` (em produção: `www.empresa.com.br`)
- **Painel administrativo:** `/admin` (em produção: `admin.empresa.com.br`)

## Funcionalidades já implementadas no protótipo

- Portal público sem login.
- Pesquisa instantânea por produto, marca, código, departamento, categoria, seção e subcategoria.
- Hierarquia de catálogo e navegação por departamento.
- Ficha de produto com preço opcional e campos configuráveis.
- Promoções que podem misturar produtos de diferentes estruturas.
- Painel ADMIN com login de demonstração.
- Dashboard de acessos/interesse.
- Editor visual com preview em tempo real.
- Rascunho separado da versão pública + botão **Publicar alterações**.
- Personalização de marca, cores, banner e tema.
- Temas: Padrão, Natal, Black Friday, Dia das Mães, Dia dos Pais, Dia das Crianças, Ano Novo e Carnaval.
- Importação de produtos por Excel/CSV via SheetJS.
- Associação automática de imagens pelo código do produto (`10001.png`, `10001_2.png`).
- Cadastro/edição de produtos.
- Árvore de departamentos/categorias/seções/subcategorias.
- Analytics básicos para produtos, pesquisas, departamentos e promoções.
- Responsividade desktop/tablet/mobile.
- `supabase/schema.sql` com base inicial para migração ao banco real.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra:

- `http://localhost:5173/` — portal público
- `http://localhost:5173/admin` — painel ADMIN

No modo demonstração o login apenas libera o painel localmente. Antes de produção, substituir por Supabase Auth.

## Próxima etapa para produção

1. Criar/conectar projeto Supabase.
2. Executar `supabase/schema.sql`.
3. Criar Storage para produtos, banners, logos e encartes.
4. Substituir `localStorage` por queries Supabase.
5. Implementar RLS por empresa/usuário.
6. Subir o código ao GitHub.
7. Configurar Cloudflare para domínio oficial e subdomínio `admin`.
8. Adicionar cache, rate limit, proteção de upload e auditoria.

## Regra de publicação

O editor trabalha sempre no rascunho. O portal público usa apenas a configuração publicada. O botão **Publicar alterações** promove o rascunho para a versão visível ao público.
