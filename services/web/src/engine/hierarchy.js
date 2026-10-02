/**
 * Parent/Child Transform Propagation (preview side)
 *
 * The canonical object graph stores `parentId` on children. When a parent's
 * EFFECTIVE transform (base + clip overrides + enter/exit anims) differs from
 * its base, the delta propagates to every descendant:
 *
 *   - translation: children ride along (rigid shift)
 *   - rotation:    children orbit the parent's effective center by the same
 *                  angle (canvas degrees, clockwise-positive)
 *   - scale:       children's offset from the parent center and their own
 *                  size scale by the same factors
 *
 * Children keep their own effective state (their own clips/anims apply on
 * top) — exactly like a Manim VGroup wrapper animated about the parent
 * center, which is what the exporter emits (codegen family VGroups).
 */

/**
 * Effective transform of an object given its overrides
 * (same field semantics as blending.applyOverrides).
 */
export function effectiveTransform(obj, overrides) {
  const o = overrides || {};
  return {
    x: o.x !== undefined ? o.x : (obj.x || 0),
    y: o.y !== undefined ? o.y : (obj.y || 0),
    rotation: o.rotation !== undefined ? o.rotation : (obj.rotation || 0),
    scaleX: o.scaleX !== undefined ? o.scaleX : 1,
    scaleY: o.scaleY !== undefined ? o.scaleY : 1
  };
}

/** Rotate a 2D vector by deg degrees (clockwise-positive, canvas y-down). */
function rotateVec(vx, vy, deg) {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad), s = Math.sin(rad);
  return { x: vx * c - vy * s, y: vx * s + vy * c };
}

/**
 * Propagate parent deltas to descendants IN the frame state.
 * Mutates `frame.objectOverrides` so the canvas renders composed transforms
 * without knowing anything about the hierarchy.
 *
 * @param {{objectOverrides: Object, hiddenIds: Set}} frame
 * @param {Array} objects canonical object list
 */
export function propagateParentTransforms(frame, objects) {
  const byId = new Map(objects.map(o => [o.id, o]));
  const childrenOf = new Map();
  for (const o of objects) {
    if (o.parentId == null) continue;
    if (!childrenOf.has(o.parentId)) childrenOf.set(o.parentId, []);
    childrenOf.get(o.parentId).push(o);
  }

  const eff = new Map();
  for (const o of objects) {
    eff.set(o.id, effectiveTransform(o, frame.objectOverrides[o.id]));
  }

  const base = new Map();
  for (const o of objects) {
    base.set(o.id, effectiveTransform(o, null));
  }

  // Top-down walk from roots (cycle-immune: sanitized graphs only reach here,
  // and a malformed cycle simply stops recursing at the visited guard).
  const visited = new Set();
  const walk = (obj) => {
    if (visited.has(obj.id)) return;
    visited.add(obj.id);
    const kids = childrenOf.get(obj.id) || [];
    if (kids.length > 0) {
      const e = eff.get(obj.id);
      const b = base.get(obj.id);
      const dRot = e.rotation - b.rotation;
      const pivot = { x: e.x, y: e.y };

      for (const child of kids) {
        const ce = eff.get(child.id);
        const cb = base.get(child.id);
        // Child's own offset from the parent's (effective) pivot
        let off = { x: ce.x - pivot.x, y: ce.y - pivot.y };
        // Undo the child's own carried parent-deltas? No — offsets are
        // absolute; parent scale/rotation compose onto the child position:
        off = { x: off.x * e.scaleX, y: off.y * e.scaleY };
        if (Math.abs(dRot) > 1e-9) off = rotateVec(off.x, off.y, dRot);
        const nx = pivot.x + off.x;
        const ny = pivot.y + off.y;
        const nsx = ce.scaleX * e.scaleX;
        const nsy = ce.scaleY * e.scaleY;
        const nrot = ce.rotation + dRot;

        const ov = { ...(frame.objectOverrides[child.id] || {}) };
        ov.x = nx; ov.y = ny;
        if (nsx !== 1 || nsy !== 1) { ov.scaleX = nsx; ov.scaleY = nsy; }
        else { delete ov.scaleX; delete ov.scaleY; }
        if (nrot !== (child.rotation || 0)) ov.rotation = nrot;
        else delete ov.rotation;
        frame.objectOverrides[child.id] = ov;
        eff.set(child.id, { x: nx, y: ny, rotation: nrot, scaleX: nsx, scaleY: nsy });
        walk(child);
      }
    }
    for (const child of kids) walk(child);
  };
  for (const o of objects) {
    if (o.parentId == null || !byId.has(o.parentId)) walk(o);
  }
}

export default { effectiveTransform, propagateParentTransforms };
