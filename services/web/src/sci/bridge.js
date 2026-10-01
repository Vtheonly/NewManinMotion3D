/**
 * Bridge between the persistence store (project JSON) and the Suprepto
 * editor store (issue #29). The visual/code projects keep their model in
 * `store.project`; scientific projects keep the sci-ir/1 document in
 * `project.sciDocument` and edit it through the sci store + actions.
 */

import { store as projectStore } from '../store/project.js';
import { store as sciStore, actions as sciActions } from './store.js';
import { toDict, fromDict } from './document.js';

export function isSciMode() {
  return projectStore.project.editorMode === 'scientific';
}

/** Push the edited document into the project (before save/export/render). */
export function syncSciToProject() {
  if (!isSciMode()) return null;
  const doc = toDict(sciStore.document);
  projectStore.project.sciDocument = doc;
  projectStore.project.name = projectStore.project.name || sciStore.document.id;
  return doc;
}

/** The current scientific document (synced first). */
export function sciDocument() {
  return syncSciToProject();
}

/** Load project.sciDocument into the editor when entering scientific mode. */
export function enterScientificMode() {
  const raw = projectStore.project.sciDocument;
  if (raw && raw.schema === 'sci-ir/1' && Array.isArray(raw.objects)) {
    sciActions.loadDict(raw);
  } else {
    const id = (projectStore.project.name || 'scene')
      .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'scene';
    sciActions.newDocument(id, projectStore.project.name || 'My Scene');
    // Seed the scene type chosen in the new-project dialog (scene_2d /
    // moving_camera / three_d / custom share one vocabulary — issue #1).
    const st = projectStore.project.sceneType;
    if (st && sciStore.document.sceneType !== st) sciStore.document.sceneType = st;
  }
}
