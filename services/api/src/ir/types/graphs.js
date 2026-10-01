/**
 * Graph/network types — generated from scientific/registry/builtin_graphs.py.
 *
 * GENERATED FILE — do not edit by hand.  Regenerate with:
 *   python scripts/sync_schema_types.py
 */
'use strict';
const GRAPH_NETWORK = {"category": "graph", "description": "Semantic graph: nodes, edges, weights, layout. Children stay individually addressable (node:/edge: sub-targets).", "dimensionality": "2d", "key": "graph.network", "label": "Graph / Network", "properties": {"directed": {"default": false, "type": "bool"}, "edges": {"default": [], "description": "[{from, to, directed?, weight?, label?, color?}]", "type": "list"}, "layout": {"default": "circle", "enum": ["circle", "layered", "grid", "line", "shell", "manual"], "type": "str"}, "nodes": {"description": "[{id, label?, position?, color?, size?}]", "required": true, "type": "list"}, "showWeights": {"default": true, "type": "bool"}, "spacing": {"default": 1.6, "type": "float"}, "title": {"type": "str"}}};
const GRAPH_STATE_CHART = {"category": "graph", "description": "Visual state chart of a declared machine (states as rounded nodes, transitions as labeled arrows).", "dimensionality": "2d", "key": "graph.state_chart", "label": "State Chart", "properties": {"layout": {"default": "layered", "enum": ["circle", "layered", "line"], "type": "str"}, "machine": {"description": "state machine id from the state section", "required": true, "type": "str"}, "spacing": {"default": 2.2, "type": "float"}}};
const GRAPHS = [
  GRAPH_NETWORK,
  GRAPH_STATE_CHART,
];
export { GRAPHS };
export default GRAPHS;
