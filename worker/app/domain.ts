import { clean } from './http';

export const uid = (prefix = 'id') => `${prefix}_${crypto.randomUUID()}`;

export const slug = (value: unknown) => clean(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

export function normalizeDepartment(value: unknown) {
  const key = slug(value);
  if (['atacado', 'atacadista', 'wholesale'].includes(key)) return 'Atacado';
  if (['distribuicao', 'distribuidor', 'distribution'].includes(key)) return 'Distribuição';
  return clean(value);
}

export function activeStatus(value: unknown, fallback = 'active') {
  const key = slug(value);
  if (['active', 'ativo', 'published', 'publicado'].includes(key)) return 'active';
  if (['inactive', 'inativo', 'archived', 'arquivado', 'draft', 'rascunho'].includes(key)) return 'inactive';
  return fallback;
}

export function postgrestLiteral(value: unknown) {
  const escaped = clean(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return encodeURIComponent(`"${escaped}"`);
}

export function hasValue(value: unknown) {
  return value !== undefined && value !== null && clean(value) !== '';
}

export function keepOr<T>(incoming: T | null | undefined, previous: T | null | undefined): T | null {
  return hasValue(incoming) ? incoming as T : previous ?? null;
}

export function marketingLayout(value: any) {
  const source = value && typeof value === 'object' ? value : {};
  const finite = (input: unknown, fallback: number) => Number.isFinite(Number(input)) ? Number(input) : fallback;
  return {
    x: Math.max(0, finite(source.x, 0)),
    y: Math.max(0, finite(source.y, 0)),
    width: Math.max(240, finite(source.width, 1440)),
    height: Math.max(140, finite(source.height, 560)),
    zIndex: Math.max(1, Math.round(finite(source.zIndex, 700))),
    visible: source.visible !== false,
  };
}
