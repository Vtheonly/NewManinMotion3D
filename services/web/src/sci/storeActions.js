/**
 * Suprepto editor actions — aggregation point.
 *
 * store.js:       store setup, selection, undo/redo, object actions.
 * storeSteps.js:  timeline stages/steps, expressions.
 * storeGraph.js:  graph builder (nodes/edges/weights/relayout).
 * storeSci.js:    reactive state, machines, comparisons, annotations.
 */

import { store, actions as baseActions } from './store.js'
import { actions as stepActions } from './storeSteps.js'
import { actions as graphActions } from './storeGraph.js'
import { actions as sciActions } from './storeSci.js'

export { store }
export const actions = { ...baseActions, ...stepActions, ...graphActions,
                         ...sciActions }
