/**
 * Parent/Child Transform Propagation (preview side)
 *
 * The canonical object graph stores `parentId` on children. This module
 * composes each ancestor's animated delta onto its descendants, matching the
 * exporter's family VGroups (fam_* wrappers) exactly:
 *
 *   - translation: every descendant rides along (rigid shift — the same
 *     delta a VGroup.shift applies to all members)
 *   - rotation: every descendant orbits the parent's CURRENT center by the
 *     parent's rotation delta (Rotate(fam, about_point=parent center))
 *   - scale: every descendant's offset from the parent's current center and
 *     its own size scale by the parent's factors
 *
 * Levels compose top-down: after the parent's level transform is applied to
 * its whole subtree, each child's OWN delta applies to ITS subtree about the
 * child's (already transformed) position — the nesting fam_A = VGroup(A,
 * fam_B) reproduces in Manim.
 *
 * A child's own effective state (its clips / enter-exit anims) is respected:
 * the parent transforms the child's CURRENT position, so own animations and
 * parent propagation compose.
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
  if (Math.abs(deg) < 1e-12) return { x: vx, y: vy };
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad), s = Math.sin(rad);
  return { x: vx * c - vy * s, y: vx * s + vy * c };
}

/**
 * Propagate parent deltas to descendants IN the frame state.
 * Mutates `frame.objectOverrides` so the canvas renders composed transforms
 * without knowing anything about the hierarchy.
 *
 * Two states are tracked per object:
 *   - own:   base + the object's OWN overrides (clips/anims), BEFORE any
 *            ancestor contribution — a level's delta is its own only
 *   - world: the composed state after every ancestor above it applied
 *
 * This mirrors nested VGroups exactly: fam_A = VGroup(A, fam_B) — A's clip
 * transforms the whole subtree rigidly; B's own clip then transforms B's
 * subtree about B's CURRENT (already moved/rotated) position.
 *
 * @param {{objectOverrides: Object, hiddenIds: Set}} frame
 * @param {Array} objects canonical object list
 */
export function propagateParentTransforms(frame, objects) {
  const childrenOf = new Map();
  for (const o of objects) {
    if (o.parentId == null) continue;
    if (!childrenOf.has(o.parentId)) childrenOf.set(o.parentId, []);
    childrenOf.get(o.parentId).push(o);
  }
  if (childrenOf.size === 0) return;

  const own = new Map();
  const base = new Map();
  const world = new Map();
  for (const o of objects) {
    const t = effectiveTransform(o, frame.objectOverrides[o.id]);
    own.set(o.id, t);
    world.set(o.id, { ...t });
    base.set(o.id, effectiveTransform(o, null));
  }

  const descendantsOf = (id) => {
    const out = [];
    const seen = new Set([id]);
    const collect = (pid) => {
      for (const k of (childrenOf.get(pid) || [])) {
        if (seen.has(k.id)) continue;
        seen.add(k.id);
        out.push(k);
        collect(k.id);
      }
    };
    collect(id);
    return out;
  };

  const applyLevel = (obj, visited) => {
    if (visited.has(obj.id)) return;          // cycle guard (sanitized graphs)
    visited.add(obj.id);
    const kids = childrenOf.get(obj.id) || [];
    if (kids.length === 0) return;

    const e = own.get(obj.id);
    const b = base.get(obj.id);
    const dx = e.x - b.x;
    const dy = e.y - b.y;
    const dRot = e.rotation - b.rotation;
    const sx = e.scaleX, sy = e.scaleY;
    const scaled = Math.abs(sx - 1) > 1e-9 || Math.abs(sy - 1) > 1e-9;
    const needsOrbit = scaled || Math.abs(dRot) > 1e-12;
    const pivot = { x: world.get(obj.id).x, y: world.get(obj.id).y };

    for (const d of descendantsOf(obj.id)) {
      const w = world.get(d.id);
      let nx = w.x + dx;
      let ny = w.y + dy;
      if (needsOrbit) {
        // Offset from the parent's CURRENT center (post ancestors + own
        // translation), scaled + rotated rigidly about it
        let off = { x: nx - pivot.x, y: ny - pivot.y };
        off = { x: off.x * sx, y: off.y * sy };
        if (Math.abs(dRot) > 1e-12) off = rotateVec(off.x, off.y, dRot);
        nx = pivot.x + off.x;
        ny = pivot.y + off.y;
      }
      world.set(d.id, {
        x: nx, y: ny,
        rotation: w.rotation + dRot,
        scaleX: w.scaleX * sx,
        scaleY: w.scaleY * sy
      });
    }

    for (const k of kids) applyLevel(k, new Set(visited));
  };

  const visited = new Set();
  for (const o of objects) {
    if (o.parentId == null) applyLevel(o, visited);
  }

  // Publish the composed world states as canvas overrides
  for (const o of objects) {
    const w = world.get(o.id);
    const b = base.get(o.id);
    const ov = { ...(frame.objectOverrides[o.id] || {}) };
    ov.x = w.x; ov.y = w.y;
    if (w.scaleX !== 1 || w.scaleY !== 1) { ov.scaleX = w.scaleX; ov.scaleY = w.scaleY; }
    else { delete ov.scaleX; delete ov.scaleY; }
    if (Math.abs(w.rotation - b.rotation) > 1e-9) ov.rotation = w.rotation;
    else delete ov.rotation;
    frame.objectOverrides[o.id] = ov;
  }
}

export default { effectiveTransform, propagateParentTransforms };
