/**
 * Object Type Registry
 *
 * Every renderable object type is registered here with a codegen function.
 * The compiler never hardcodes object types — it looks them up here.
 *
 * Adding a new object type (extension point):
 *   import { registerObjectType, helpers } from './index.js';
 *   registerObjectType('my_type', {
 *     label: 'My Type',
 *     codegen(obj, ctx) { return [`my_var = MyMobject(...)`]; }
 *   });
 *
 * `ctx` provides:
 *   { sw, sh, assetsPath, assetMap, hex, safeNum, safeOpacity, safeText, vn, stageToManim }
 *
 * codegen contract:
 *   - receives the normalized object
 *   - returns an array of Python statement lines (unindented)
 *   - must NOT emit the final move_to/rotate placement lines (the scene
 *     assembler adds them uniformly for every object) — unless the entry
 *     sets `skipPlacement: true`.
 */

import { registries } from './index.js';
import {
  hex, safeNum, safeOpacity, safeText, vn, stageToManim,
  FRAME_WIDTH, FRAME_HEIGHT, FRAME_X_RADIUS, FRAME_Y_RADIUS
} from './shared.js';

/** 3D mobject types render in any scene; a project whose sceneType is
 *  'three_d' additionally gets the orbitable camera (scene registry). */
export const OBJECT_DIMENSIONALITY = {
  cube: '3d', sphere: '3d', cone: '3d', cylinder: '3d'
};

export function objectDimensionality(type) {
  return OBJECT_DIMENSIONALITY[type] || '2d';
}

/** Helpers injected into every object codegen context. */
export const objectHelpers = { hex, safeNum, safeOpacity, safeText, vn, stageToManim };

/**
 * Register an object type.
 * @param {string} type - unique object type key (e.g. 'rectangle')
 * @param {{ label: string, codegen: Function, skipPlacement?: boolean, params?: Object }} entry
 */
export function registerObjectType(type, entry) {
  if (typeof entry.codegen !== 'function') {
    throw new Error(`[object-type registry] "${type}" must provide a codegen() function`);
  }
  return registries.objects.register(type, entry);
}

/** Build the codegen context shared by all object codegen functions. */
export function makeObjectContext({ stage, assetsPath, assetMap }) {
  return {
    sw: stage.width,
    sh: stage.height,
    assetsPath: assetsPath || '',
    assetMap: assetMap || {},
    ...objectHelpers
  };
}

// ─── Built-in object types (ported from the former monolithic switch) ─────────
// Output intentionally re-uses the exact same Python emission logic as the
// legacy monolithic generator so that output for existing projects stays
// byte-compatible (regression-tested in tests/compiler.test.mjs).

function fillStrokeLines(varName, { fill, stroke, opacity, strokeWidth, hasFill, hasStroke }) {
  const lines = [];
  if (hasFill) lines.push(`${varName}.set_fill(color=${fill}, opacity=${opacity})`);
  if (hasStroke) lines.push(`${varName}.set_stroke(color=${stroke}, width=${strokeWidth})`);
  return lines;
}

registerObjectType('heart', {
  label: 'Heart',
  codegen(obj, { sw, sh, hex, safeOpacity }) {
    const n = vn(obj.id);
    const mw = (obj.width / sw * FRAME_X_RADIUS).toFixed(3);
    const mh = (obj.height / sh * FRAME_Y_RADIUS).toFixed(3);
    const fill = hex(obj.fill), stroke = hex(obj.stroke) || '"#FFFFFF"';
    const opacity = safeOpacity(obj.opacity);
    const hasFill = fill !== null;
    const lines = [
      `${n} = ParametricFunction(`,
      `    lambda t: np.array([np.sin(t)**3 * ${mw}, (13*np.cos(t)-5*np.cos(2*t)-2*np.cos(3*t)-np.cos(4*t))/15 * ${mh}, 0]),`,
      `    t_range=[0, 2*PI], color=${stroke})`
    ];
    if (hasFill) lines.push(`${n}.set_fill(color=${fill}, opacity=${opacity})`);
    return lines;
  }
});

registerObjectType('rectangle', {
  label: 'Rectangle',
  codegen(obj, { sw, sh, hex, safeNum, safeOpacity }) {
    const n = vn(obj.id);
    const fill = hex(obj.fill), stroke = hex(obj.stroke), opacity = safeOpacity(obj.opacity);
    const sw2 = safeNum(obj.strokeWidth, 2);
    const lines = [`${n} = Rectangle(width=${(obj.width / sw * FRAME_WIDTH).toFixed(3)}, height=${(obj.height / sh * FRAME_HEIGHT).toFixed(3)})`];
    lines.push(...fillStrokeLines(n, { fill, stroke, opacity, strokeWidth: sw2, hasFill: fill !== null, hasStroke: stroke !== null }));
    return lines;
  }
});

registerObjectType('square', {
  label: 'Square',
  codegen(obj, { sw, hex, safeNum, safeOpacity }) {
    const n = vn(obj.id);
    const scale = Math.min(obj.width, obj.height) / sw * FRAME_X_RADIUS;
    const fill = hex(obj.fill), stroke = hex(obj.stroke), opacity = safeOpacity(obj.opacity);
    const sw2 = safeNum(obj.strokeWidth, 2);
    const lines = [`${n} = Square(side_length=${scale.toFixed(3)})`];
    lines.push(...fillStrokeLines(n, { fill, stroke, opacity, strokeWidth: sw2, hasFill: fill !== null, hasStroke: stroke !== null }));
    return lines;
  }
});

registerObjectType('circle', {
  label: 'Circle',
  codegen(obj, { sw, hex, safeNum, safeOpacity }) {
    const n = vn(obj.id);
    const scale = Math.min(obj.width, obj.height) / sw * FRAME_X_RADIUS;
    const fill = hex(obj.fill), stroke = hex(obj.stroke), opacity = safeOpacity(obj.opacity);
    const sw2 = safeNum(obj.strokeWidth, 2);
    const lines = [`${n} = Circle(radius=${(scale / 2).toFixed(3)})`];
    lines.push(...fillStrokeLines(n, { fill, stroke, opacity, strokeWidth: sw2, hasFill: fill !== null, hasStroke: stroke !== null }));
    return lines;
  }
});

registerObjectType('ellipse', {
  label: 'Ellipse',
  codegen(obj, { sw, sh, hex, safeNum, safeOpacity }) {
    const n = vn(obj.id);
    const fill = hex(obj.fill), stroke = hex(obj.stroke), opacity = safeOpacity(obj.opacity);
    const sw2 = safeNum(obj.strokeWidth, 2);
    const lines = [`${n} = Ellipse(width=${(obj.width / sw * FRAME_WIDTH).toFixed(3)}, height=${(obj.height / sh * FRAME_HEIGHT).toFixed(3)})`];
    lines.push(...fillStrokeLines(n, { fill, stroke, opacity, strokeWidth: sw2, hasFill: fill !== null, hasStroke: stroke !== null }));
    return lines;
  }
});

registerObjectType('triangle', {
  label: 'Triangle',
  codegen(obj, { sw, hex, safeNum, safeOpacity }) {
    const n = vn(obj.id);
    const scale = Math.min(obj.width, obj.height) / sw * FRAME_X_RADIUS;
    const fill = hex(obj.fill), stroke = hex(obj.stroke), opacity = safeOpacity(obj.opacity);
    const sw2 = safeNum(obj.strokeWidth, 2);
    const lines = [`${n} = Triangle().scale(${scale.toFixed(3)})`];
    lines.push(...fillStrokeLines(n, { fill, stroke, opacity, strokeWidth: sw2, hasFill: fill !== null, hasStroke: stroke !== null }));
    return lines;
  }
});

registerObjectType('star', {
  label: 'Star',
  codegen(obj, { sw, hex, safeNum, safeOpacity }) {
    const n = vn(obj.id);
    const scale = Math.min(obj.width, obj.height) / sw * FRAME_X_RADIUS;
    const fill = hex(obj.fill), stroke = hex(obj.stroke), opacity = safeOpacity(obj.opacity);
    const sw2 = safeNum(obj.strokeWidth, 2);
    const arms = safeNum(obj.starArms, 5);
    const inner = safeNum(obj.innerRatio, 0.4);
    const lines = [`${n} = Star(n=${arms}, outer_radius=${(scale / 2).toFixed(3)}, inner_radius=${(scale / 2 * inner).toFixed(3)})`];
    lines.push(...fillStrokeLines(n, { fill, stroke, opacity, strokeWidth: sw2, hasFill: fill !== null, hasStroke: stroke !== null }));
    return lines;
  }
});

registerObjectType('polygon', {
  label: 'Polygon',
  codegen(obj, { sw, hex, safeNum, safeOpacity }) {
    const n = vn(obj.id);
    const scale = Math.min(obj.width, obj.height) / sw * FRAME_X_RADIUS;
    const fill = hex(obj.fill), stroke = hex(obj.stroke), opacity = safeOpacity(obj.opacity);
    const sw2 = safeNum(obj.strokeWidth, 2);
    const sides = safeNum(obj.sides, 6);
    const lines = [`${n} = RegularPolygon(n=${sides}).scale(${(scale / 2).toFixed(3)})`];
    lines.push(...fillStrokeLines(n, { fill, stroke, opacity, strokeWidth: sw2, hasFill: fill !== null, hasStroke: stroke !== null }));
    return lines;
  }
});

registerObjectType('line', {
  label: 'Line',
  codegen(obj, { sw, hex, safeNum }) {
    const n = vn(obj.id);
    const half = (obj.width / 2 / sw * FRAME_WIDTH).toFixed(3);
    const color = hex(obj.stroke) || hex(obj.fill) || '"#FFFFFF"';
    const width = safeNum(obj.strokeWidth, 3);
    return [
      `${n} = Line(LEFT * ${half}, RIGHT * ${half})`,
      `${n}.set_stroke(color=${color}, width=${width})`
    ];
  }
});

registerObjectType('arrow', {
  label: 'Arrow',
  codegen(obj, { sw, hex, safeNum }) {
    const n = vn(obj.id);
    const halfLen = (obj.width / 2 / sw * FRAME_WIDTH).toFixed(3);
    const tipLen = (7 / sw * FRAME_WIDTH).toFixed(3);
    const sw2 = safeNum(obj.strokeWidth, 2);
    const color = hex(obj.fill) || '"#EF4444"';
    return [
      `${n} = Arrow(start=LEFT * ${halfLen}, end=RIGHT * ${halfLen}, color=${color}, buff=0, tip_length=${tipLen}, stroke_width=${sw2}, max_tip_length_to_length_ratio=0.15)`
    ];
  }
});

registerObjectType('text', {
  label: 'Text',
  codegen(obj, { hex, safeNum, safeText }) {
    const n = vn(obj.id);
    const fill = hex(obj.fill) || '"#FFFFFF"';
    const fontFamily = obj.fontFamily || 'Roboto';
    return [
      `# Font: ${fontFamily}`,
      `${n} = Text("${safeText(obj.content)}", font_size=${safeNum(obj.fontSize, 48)}, color=${fill}, font="${fontFamily}")`
    ];
  }
});

registerObjectType('dot', {
  label: 'Dot',
  codegen(obj, { sw, hex }) {
    const n = vn(obj.id);
    const fill = hex(obj.fill) || '"#FFFFFF"';
    return [`${n} = Dot(radius=${(obj.width / 2 / sw * FRAME_X_RADIUS).toFixed(3)}, color=${fill})`];
  }
});

registerObjectType('dot_grid', {
  label: 'Dot Grid',
  codegen(obj, { sw, hex, safeNum }) {
    const n = vn(obj.id);
    const fill = hex(obj.fill);
    const c = safeNum(obj.gridCols, 5), r = safeNum(obj.gridRows, 5);
    const sp = safeNum(obj.dotSpacing, 40) / sw * FRAME_X_RADIUS;
    const lines = [
      `${n} = VGroup(*[Dot(radius=0.06).move_to([c*${sp.toFixed(3)}-${((c - 1) * sp / 2).toFixed(3)}, r*${sp.toFixed(3)}-${((r - 1) * sp / 2).toFixed(3)}, 0]) for r in range(${r}) for c in range(${c})])`
    ];
    if (fill !== null) lines.push(`${n}.set_color(${fill})`);
    return lines;
  }
});

registerObjectType('image', {
  label: 'Image',
  codegen(obj, { sw, assetMap, assetsPath }) {
    const n = vn(obj.id);
    const asset = obj.assetId ? assetMap[obj.assetId] : null;
    const filename = asset?.filename || `${(obj.name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_')}.png`;
    const filePath = joinAssetPath(assetsPath, filename);
    return [`${n} = ImageMobject("${filePath}").scale_to_fit_width(${(obj.width / sw * FRAME_WIDTH).toFixed(3)})`];
  }
});

registerObjectType('svg_asset', {
  label: 'SVG',
  codegen(obj, { sw, assetMap, assetsPath }) {
    const n = vn(obj.id);
    const asset = obj.assetId ? assetMap[obj.assetId] : null;
    const filename = asset?.filename || `${(obj.name || 'asset').replace(/[^a-zA-Z0-9._-]/g, '_')}.svg`;
    const filePath = joinAssetPath(assetsPath, filename);
    return [`${n} = SVGMobject("${filePath}").scale_to_fit_width(${(obj.width / sw * FRAME_WIDTH).toFixed(3)})`];
  }
});

/** Asset path join that degrades to a bare filename when no server asset
 *  directory is known (client-side export). */
function joinAssetPath(assetsPath, filename) {
  return assetsPath ? `${assetsPath}/${filename}` : filename;
}

registerObjectType('latex', {
  label: 'LaTeX',
  codegen(obj, { sw, hex, safeNum }) {
    const n = vn(obj.id);
    const scale = Math.min(obj.width, obj.height) / sw * FRAME_X_RADIUS;
    const fill = hex(obj.fill) || '"#FFFFFF"';
    const texStr = (obj.latex || 'E = mc^2').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return [
      `${n} = MathTex(r"${texStr}", color=${fill})`,
      `${n}.scale(${(scale * 2).toFixed(3)})`
    ];
  }
});

registerObjectType('axes', {
  label: 'Axes',
  codegen(obj, { sw, sh }) {
    const n = vn(obj.id);
    const xr = obj.xRange || [-5, 5, 1];
    const yr = obj.yRange || [-3, 3, 1];
    return [
      `${n} = Axes(x_range=[${xr[0]}, ${xr[1]}, ${xr[2]}], y_range=[${yr[0]}, ${yr[1]}, ${yr[2]}], x_length=${(obj.width / sw * FRAME_WIDTH).toFixed(1)}, y_length=${(obj.height / sh * FRAME_HEIGHT).toFixed(1)}, tips=True)`
    ];
  }
});

/** Shared codegen for solid 3D primitives (VGroup-based mobjects).
 *  Emitted size uses the true frame mapping; the z placement comes from the
 *  object's optional `z` property (stage-relative depth, default 0).
 *  Issue #42: true non-uniform dimensions. The constructor emits a unit
 *  primitive and stretch_to_fit_width/height/depth scales it to the exact
 *  canonical width/height/depth (in frame units), so the 3D viewport, the
 *  2D layout preview and the rendered video all agree on the shape. */
function solid3dLines(n, ctor, { fill, stroke, opacity, strokeWidth, hasFill, hasStroke, size }) {
  const lines = [`${n} = ${ctor}`];
  if (size) {
    lines.push(`${n}.stretch_to_fit_width(${size.w.toFixed(4)})`);
    lines.push(`${n}.stretch_to_fit_height(${size.h.toFixed(4)})`);
    lines.push(`${n}.stretch_to_fit_depth(${size.d.toFixed(4)})`);
  }
  if (hasFill) lines.push(`${n}.set_fill(color=${fill}, opacity=${safeOpacity(opacity)})`);
  if (hasStroke) lines.push(`${n}.set_stroke(color=${stroke}, width=${safeNum(strokeWidth, 2)})`);
  return lines;
}

/** Canonical 3D dimensions in frame units (matches web engine stage3d.js).
 *  Semantics = world bounding-box extents of the UNROTATED primitive
 *  (Manim cone/cylinder axis = +z, base in the xy plane):
 *    cube:     x=width, y=height, z=depth (defaults to width)
 *    sphere:   x=width, y=height, z=width  (circular xz footprint)
 *    cone/cyl: x=width, y=width (base), z=height (the axis) — new objects
 *              carry rotationX=-90 so the axis stands upright and the
 *              on-screen vertical extent equals the canonical height,
 *              matching the 2D layout preview and the 3D viewport. */
function solid3dSize(obj, sw, sh) {
  const w = (obj.width || 1) / sw * FRAME_WIDTH;
  const h = (obj.height || 1) / sh * FRAME_HEIGHT;
  if (obj.type === 'cube') {
    const dPx = obj.depth != null ? (Number(obj.depth) || 1) : obj.width;
    return { w, h, d: dPx / sw * FRAME_WIDTH };
  }
  if (obj.type === 'cone' || obj.type === 'cylinder') {
    return { w, h: w, d: h };
  }
  return { w, h, d: w };   // sphere
}

registerObjectType('cube', {
  label: 'Cube',
  codegen(obj, ctx) {
    const n = vn(obj.id);
    const { hex, safeNum, safeOpacity, sw } = ctx;
    const fill = hex(obj.fill), stroke = hex(obj.stroke), opacity = safeOpacity(obj.opacity);
    const sw2 = safeNum(obj.strokeWidth, 2);
    return solid3dLines(n, `Cube(side_length=1.0, fill_opacity=${safeOpacity(opacity)})`,
      { fill, stroke, opacity, strokeWidth: sw2, hasFill: fill !== null, hasStroke: stroke !== null, size: solid3dSize(obj, sw, ctx.sh) });
  }
});

registerObjectType('sphere', {
  label: 'Sphere',
  codegen(obj, ctx) {
    const n = vn(obj.id);
    const { hex, safeNum, safeOpacity, sw } = ctx;
    const fill = hex(obj.fill), stroke = hex(obj.stroke), opacity = safeOpacity(obj.opacity);
    const sw2 = safeNum(obj.strokeWidth, 2);
    const res = safeNum(obj.resolution, 24);
    return solid3dLines(n, `Sphere(radius=1.0, resolution=(${res}, ${res}), fill_opacity=${safeOpacity(opacity)})`,
      { fill, stroke, opacity, strokeWidth: sw2, hasFill: fill !== null, hasStroke: stroke !== null, size: solid3dSize(obj, sw, ctx.sh) });
  }
});

registerObjectType('cone', {
  label: 'Cone',
  codegen(obj, ctx) {
    const n = vn(obj.id);
    const { hex, safeNum, safeOpacity, sw, sh } = ctx;
    const fill = hex(obj.fill), stroke = hex(obj.stroke), opacity = safeOpacity(obj.opacity);
    const sw2 = safeNum(obj.strokeWidth, 2);
    return solid3dLines(n, `Cone(base_radius=1.0, height=1.0, fill_opacity=${safeOpacity(opacity)})`,
      { fill, stroke, opacity, strokeWidth: sw2, hasFill: fill !== null, hasStroke: stroke !== null, size: solid3dSize(obj, sw, sh) });
  }
});

registerObjectType('cylinder', {
  label: 'Cylinder',
  codegen(obj, ctx) {
    const n = vn(obj.id);
    const { hex, safeNum, safeOpacity, sw, sh } = ctx;
    const fill = hex(obj.fill), stroke = hex(obj.stroke), opacity = safeOpacity(obj.opacity);
    const sw2 = safeNum(obj.strokeWidth, 2);
    const res = safeNum(obj.resolution, 24);
    return solid3dLines(n, `Cylinder(radius=1.0, height=1.0, resolution=(${res}, ${res}), fill_opacity=${safeOpacity(opacity)})`,
      { fill, stroke, opacity, strokeWidth: sw2, hasFill: fill !== null, hasStroke: stroke !== null, size: solid3dSize(obj, sw, sh) });
  }
});

/**
 * Fallback for unknown types — never crashes codegen; emits a comment plus a
 * neutral placeholder so partially-extended projects still compile.
 */
export function unknownObjectLines(obj) {
  const n = vn(obj.id);
  return [`${n} = Circle(radius=0.5)  # unknown type: ${obj.type}`];
}
