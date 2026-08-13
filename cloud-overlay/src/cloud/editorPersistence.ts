import type { EditorNode } from '../editor/types';
import { cloudApi, isCloudRuntime } from './api';

export async function saveEditorDraft(nodes: EditorNode[]) {
  if (!isCloudRuntime()) return null;
  const current = await cloudApi.getDraft('home');
  return cloudApi.saveDraft(nodes, current.page.revision, 'home');
}

export async function publishEditorDraft(nodes: EditorNode[]) {
  if (!isCloudRuntime()) return null;
  await saveEditorDraft(nodes);
  return cloudApi.publish('home');
}
