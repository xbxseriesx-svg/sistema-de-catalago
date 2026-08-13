export function uid(): string {
  return `n_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function snapTo(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

export function getResponsiveRect(node: import('./types').EditorNode, device: import('./types').DeviceType) {
  const r = node.responsive?.[device];
  if (r) {
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }
  if (node.type === 'page') {
    if (device === 'tablet') return { x: 0, y: 0, width: 834, height: Math.max(node.height, 1112) };
    if (device === 'mobile') return { x: 0, y: 0, width: 390, height: Math.max(node.height, 1400) };
  }
  return { x: node.x, y: node.y, width: node.width, height: node.height };
}

export function responsivePatch(node: import('./types').EditorNode, device: import('./types').DeviceType, patch: Partial<{ x: number; y: number; width: number; height: number }>) {
  if (device === 'desktop') return patch;
  const current = getResponsiveRect(node, device);
  return {
    responsive: {
      ...(node.responsive || {}),
      [device]: { ...current, ...patch },
    },
  };
}

export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}
