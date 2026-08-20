import type { Env } from '../env';
import { COMPANY_ID } from '../env';
import { audit } from '../audit';
import { activeStatus, keepOr, normalizeDepartment, slug, uid } from '../domain';
import { clean, fail, ok, requestBody } from '../http';
import { requireUser } from '../auth/session';
import { table, tableByValues } from '../supabase';

export async function handleProductsRoute(req: Request, env: Env, path: string): Promise<Response | null> {
  if (path === '/api/admin/catalog/products/bulk' && req.method === 'POST') {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']);
    if (auth.error || !auth.user) return auth.error;
    const input = await requestBody(req);
    const incoming = Array.isArray(input.products) ? input.products.slice(0, 5000) : [];
    if (!incoming.length) return fail('Nenhum produto recebido');

    const requestedCodes = [...new Set<string>(
      incoming.map((product: any) => clean(product?.code ?? product?.codigo)).filter(Boolean),
    )];
    const existing = requestedCodes.length
      ? await tableByValues(env, 'products', `company_id=eq.${COMPANY_ID}&select=*`, 'code', requestedCodes)
      : [];
    const byCode = new Map<string, any>((existing || []).map((item: any) => [clean(item.code), item]));

    let hierarchy = await table(
      env,
      'hierarchy_nodes',
      `company_id=eq.${COMPANY_ID}&select=id,type,name,slug,parent_id,sort_order,active`,
    ) as any[];
    let brands = await table(
      env,
      'brands',
      `company_id=eq.${COMPANY_ID}&select=id,name,slug,active`,
    ) as any[];

    const seenCodes = new Set<string>();
    const errors: string[] = [];
    let ignored = 0;

    const nodeKey = (type: string, parentId: string | null, name: string) =>
      `${type}:${parentId || ''}:${slug(name)}`;
    const rebuildNodes = () => new Map<string, any>(
      (hierarchy || []).map((node: any) => [nodeKey(node.type, node.parent_id, node.name), node]),
    );
    let nodes = rebuildNodes();

    const departments = new Map<string, any>();
    for (const node of hierarchy || []) {
      if (node.type === 'departamento') departments.set(normalizeDepartment(node.name), node);
    }

    const missingDepartments = new Map<string, any>();
    for (const product of incoming) {
      const department = normalizeDepartment(
        product?.departamentoName ?? product?.department ?? product?.departamento,
      );
      const key = slug(department);
      if (department && !departments.has(department) && !missingDepartments.has(key)) {
        missingDepartments.set(key, {
          id: uid('hier'),
          company_id: COMPANY_ID,
          type: 'departamento',
          name: department,
          slug: key,
          parent_id: null,
          sort_order: 100,
          active: true,
          data: {},
        });
      }
    }

    if (missingDepartments.size) {
      await table(env, 'hierarchy_nodes', 'on_conflict=company_id,type,slug,parent_id', {
        method: 'POST',
        headers: { prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify([...missingDepartments.values()]),
      });
      hierarchy = await table(
        env,
        'hierarchy_nodes',
        `company_id=eq.${COMPANY_ID}&select=id,type,name,slug,parent_id,sort_order,active`,
      ) as any[];
      for (const node of hierarchy || []) {
        if (node.type === 'departamento') departments.set(normalizeDepartment(node.name), node);
      }
    }

    const valid: Array<{
      index: number;
      product: any;
      code: string;
      name: string;
      previous: any;
      previousData: any;
      department: string;
      section: string;
      category: string;
    }> = [];

    for (let index = 0; index < incoming.length; index++) {
      const product = incoming[index] || {};
      const code = clean(product.code ?? product.codigo);
      const previous: any = byCode.get(code);
      const previousData = previous?.data || {};
      const name = clean(product.name ?? product.shortDescription ?? product.description ?? product.descricao)
        || clean(previous?.name ?? previousData.name);
      const department = normalizeDepartment(
        product.departamentoName ?? product.department ?? product.departamento ?? previousData.departamentoName,
      );
      const section = clean(product.secaoName ?? product.section ?? product.secao ?? previousData.secaoName);
      const category = clean(
        product.categoriaName ?? product.category ?? product.categoria ?? previousData.categoriaName,
      ) || 'Sem categoria';

      if (seenCodes.has(code)) {
        ignored++;
        if (errors.length < 30) errors.push(`Linha ${index + 2}: código ${code || 'vazio'} repetido no arquivo`);
        continue;
      }
      if (code) seenCodes.add(code);

      if (!code || !name || !department || !section || !category) {
        ignored++;
        if (errors.length < 30) {
          errors.push(
            `Linha ${index + 2}: ${!code ? 'Código; ' : ''}${!name ? 'Descrição; ' : ''}${!department ? 'Departamento; ' : ''}${!section ? 'Seção; ' : ''}`.replace(/; $/, ''),
          );
        }
        continue;
      }
      if (!departments.get(department)) {
        ignored++;
        if (errors.length < 30) errors.push(`Linha ${index + 2}: departamento ${department} não configurado`);
        continue;
      }

      valid.push({
        index,
        product,
        code,
        name,
        previous,
        previousData,
        department,
        section,
        category,
      });
    }

    const missingSections = new Map<string, any>();
    for (const item of valid) {
      const department = departments.get(item.department);
      const key = nodeKey('secao', department.id, item.section);
      if (!nodes.has(key) && !missingSections.has(key)) {
        missingSections.set(key, {
          id: uid('hier'),
          company_id: COMPANY_ID,
          type: 'secao',
          name: item.section,
          slug: `${slug(item.department)}--${slug(item.section)}`,
          parent_id: department.id,
          sort_order: 100,
          active: true,
          data: {},
        });
      }
    }
    if (missingSections.size) {
      await table(env, 'hierarchy_nodes', 'on_conflict=company_id,type,slug,parent_id', {
        method: 'POST',
        headers: { prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify([...missingSections.values()]),
      });
      hierarchy = await table(
        env,
        'hierarchy_nodes',
        `company_id=eq.${COMPANY_ID}&select=id,type,name,slug,parent_id,sort_order,active`,
      ) as any[];
    }
    nodes = rebuildNodes();

    const missingCategories = new Map<string, any>();
    for (const item of valid) {
      const department = departments.get(item.department);
      const section = nodes.get(nodeKey('secao', department.id, item.section));
      if (!section) continue;
      const key = nodeKey('categoria', section.id, item.category);
      if (!nodes.has(key) && !missingCategories.has(key)) {
        missingCategories.set(key, {
          id: uid('hier'),
          company_id: COMPANY_ID,
          type: 'categoria',
          name: item.category,
          slug: `${slug(item.section)}--${slug(item.category)}`,
          parent_id: section.id,
          sort_order: 100,
          active: true,
          data: {},
        });
      }
    }
    if (missingCategories.size) {
      await table(env, 'hierarchy_nodes', 'on_conflict=company_id,type,slug,parent_id', {
        method: 'POST',
        headers: { prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify([...missingCategories.values()]),
      });
      hierarchy = await table(
        env,
        'hierarchy_nodes',
        `company_id=eq.${COMPANY_ID}&select=id,type,name,slug,parent_id,sort_order,active`,
      ) as any[];
    }
    nodes = rebuildNodes();

    const brandMap = new Map<string, any>((brands || []).map((brand: any) => [slug(brand.name), brand]));
    const missingBrands = new Map<string, any>();
    for (const item of valid) {
      const brandName = clean(
        item.product.brandName ?? item.product.brand ?? item.product.marca ?? item.previousData.brandName,
      );
      const key = slug(brandName);
      if (key && !brandMap.has(key) && !missingBrands.has(key)) {
        missingBrands.set(key, {
          id: uid('brd'),
          company_id: COMPANY_ID,
          name: brandName,
          slug: key,
          active: true,
          data: {},
        });
      }
    }
    if (missingBrands.size) {
      await table(env, 'brands', 'on_conflict=company_id,slug', {
        method: 'POST',
        headers: { prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify([...missingBrands.values()]),
      });
      brands = await table(
        env,
        'brands',
        `company_id=eq.${COMPANY_ID}&select=id,name,slug,active`,
      ) as any[];
    }
    for (const brand of brands || []) brandMap.set(slug(brand.name), brand);

    let inserted = 0;
    let updated = 0;
    const rows: any[] = [];

    for (const item of valid) {
      const { product, code, name, previous, previousData, department, section, category } = item;
      const departmentNode = departments.get(department);
      const sectionNode = nodes.get(nodeKey('secao', departmentNode.id, section));
      const categoryNode = sectionNode && nodes.get(nodeKey('categoria', sectionNode.id, category));
      if (!sectionNode || !categoryNode) {
        ignored++;
        if (errors.length < 30) errors.push(`Linha ${item.index + 2}: falha ao resolver seção ou categoria`);
        continue;
      }

      const brandName = clean(
        product.brandName ?? product.brand ?? product.marca ?? previousData.brandName,
      );
      const brandId = brandName
        ? brandMap.get(slug(brandName))?.id || previous?.brand_id || null
        : previous?.brand_id || null;
      const image = clean(product.image) || clean(previous?.image_url) || clean(previousData.image) || null;
      const gallery = Array.isArray(product.gallery) && product.gallery.length
        ? product.gallery
        : Array.isArray(previous?.gallery)
          ? previous.gallery
          : Array.isArray(previousData.gallery)
            ? previousData.gallery
            : [];
      const shortDescription = clean(product.shortDescription) || clean(previous?.short_description) || name;
      const longDescription = clean(product.longDescription)
        || clean(previous?.long_description)
        || clean(previousData.longDescription)
        || name;
      const data = {
        ...previousData,
        ...product,
        code,
        name,
        shortDescription,
        longDescription,
        departamentoId: departmentNode.id,
        secaoId: sectionNode.id,
        categoriaId: categoryNode.id,
        departamentoName: department,
        secaoName: section,
        categoriaName: category,
        brandId,
        brandName: brandName || previousData.brandName || '',
        image,
        gallery,
      };

      rows.push({
        id: previous?.id || uid('prd'),
        company_id: COMPANY_ID,
        code,
        name,
        ean: keepOr(clean(product.ean) || null, previous?.ean),
        short_description: shortDescription,
        long_description: longDescription,
        brand_id: brandId,
        departamento_id: departmentNode.id,
        secao_id: sectionNode.id,
        categoria_id: categoryNode.id,
        unit: keepOr(clean(product.unit) || null, previous?.unit),
        packaging: keepOr(clean(product.packaging) || null, previous?.packaging),
        ncm: keepOr(clean(product.ncm) || null, previous?.ncm),
        price: keepOr(product.price, previous?.price),
        promo_price: keepOr(product.promoPrice, previous?.promo_price),
        stock: keepOr(product.stock, previous?.stock),
        image_url: image,
        video_url: clean(product.video ?? product.videoUrl) || clean(previous?.video_url) || null,
        gallery,
        technical: product.technical && typeof product.technical === 'object'
          ? { ...(previous?.technical || {}), ...product.technical }
          : previous?.technical || {},
        attributes: product.attributes && typeof product.attributes === 'object'
          ? { ...(previous?.attributes || {}), ...product.attributes }
          : previous?.attributes || {},
        tags: Array.isArray(product.tags)
          ? product.tags
          : Array.isArray(previous?.tags)
            ? previous.tags
            : [],
        status: activeStatus(product.status, previous?.status || 'active'),
        data,
      });
      if (previous) updated++;
      else inserted++;
    }

    for (let index = 0; index < rows.length; index += 200) {
      await table(env, 'products', 'on_conflict=company_id,code', {
        method: 'POST',
        headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows.slice(index, index + 200)),
      });
    }

    const importId = uid('imp');
    await audit(env, auth.user, 'products.bulk', 'import', importId, {
      total: incoming.length,
      inserted,
      updated,
      ignored,
      filename: clean(input.filename),
      errors,
    });
    return ok({ importId, total: incoming.length, inserted, updated, ignored, errors });
  }

  const productMatch = path.match(/^\/api\/admin\/products\/([^/]+)$/);
  if (productMatch && ['PUT', 'DELETE'].includes(req.method)) {
    const auth = await requireUser(req, env, ['EDITOR', 'ADMIN']);
    if (auth.error || !auth.user) return auth.error;
    const id = decodeURIComponent(productMatch[1]);

    if (req.method === 'DELETE') {
      const rows = await table(
        env,
        'products',
        `id=eq.${encodeURIComponent(id)}&company_id=eq.${COMPANY_ID}&select=code&limit=1`,
      ) as any[];
      if (!rows?.length) return fail('Produto não encontrado', 404, 'NOT_FOUND');
      await table(env, 'products', `id=eq.${encodeURIComponent(id)}&company_id=eq.${COMPANY_ID}`, {
        method: 'DELETE',
        headers: { prefer: 'return=minimal' },
      });
      await audit(env, auth.user, 'product.delete', 'product', id);
      return ok({ id, code: rows[0]?.code });
    }

    const input = await requestBody(req);
    const status = ['active', 'ativo'].includes(clean(input.status).toLowerCase()) ? 'active' : 'inactive';
    await table(env, 'products', `id=eq.${encodeURIComponent(id)}&company_id=eq.${COMPANY_ID}`, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({ status }),
    });
    return ok({ id, status });
  }

  return null;
}
