import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { EditorNode } from '../editor/types';
import { renderContent, styleObj } from '../editor/nodeContent';
import { cloudApi } from '../cloud/api';

export function PublicSite() {
  const [nodes, setNodes] = useState<EditorNode[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    cloudApi.publicPage('home')
      .then((response) => {
        setNodes(response.page.nodes);
        document.title = response.page.title || 'ASTERYON';
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : 'Site ainda não publicado');
      });
  }, []);

  const page = nodes.find((node) => node.type === 'page');
  if (!page) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50 p-6">
        <div className="rounded-2xl bg-white p-8 text-center shadow">
          <h1 className="text-xl font-bold">ASTERYON</h1>
          <p className="mt-2 text-sm text-zinc-500">{error || 'Carregando catálogo...'}</p>
          {error && (
            <a className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white" href="/admin">
              Abrir Editor
            </a>
          )}
        </div>
      </div>
    );
  }

  const children = page.children ?? [];
  return (
    <main style={{ minHeight: page.height, background: String(page.styles.backgroundColor || '#fff'), overflowX: 'hidden' }}>
      <div style={{ position: 'relative', width: page.width, height: page.height, maxWidth: '100%', margin: '0 auto' }}>
        {children.filter((node) => node.visible).map((node) => <NodeView key={node.id} node={node} />)}
      </div>
    </main>
  );
}

function NodeView({ node }: { node: EditorNode }) {
  const box: CSSProperties = {
    position: 'absolute',
    left: node.x,
    top: node.y,
    width: node.width,
    height: node.height,
    zIndex: node.zIndex,
    opacity: node.opacity,
    transform: `rotate(${node.rotation || 0}deg)`,
  };
  const children = node.children ?? [];

  return (
    <div style={box}>
      <div style={styleObj(node)}>
        {renderContent(node, false)}
        {children.filter((child) => child.visible).map((child) => <NodeView key={child.id} node={child} />)}
      </div>
    </div>
  );
}
