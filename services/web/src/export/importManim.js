/**
 * parseManimScript — tolerant legacy Manim importer (issue #33 follow-up).
 *
 * Emits the visual project model from hand-written Manim CE code: one
 * timeline object per constructed mobject, one clip per recognised animation,
 * `self.wait` advances the clock. Unknown constructs (VGroup factories,
 * helper calls, `Flash`/`Wiggle`…) are tracked as virtual variables so
 * everything else keeps its true timing. `custom`/`animate`-style one-off
 * animations still consume their run_time.
 */

import { statements, parseArgs, matchParen, num } from './parseLegacy.js';
import { KNOWN_CTORS, ENTRANCE, makeObject, applyChain, toStage } from './importShapes.js';
import { point } from './parseLegacy.js';

const EASE = ['ease_in_out_cubic', 'ease_out_bounce', 'ease_in_back', 'ease_out_back',
  'ease_in_cubic', 'ease_out_cubic', 'ease_in_out', 'there_and_back', 'rush_into',
  'rush_from', 'ease_in', 'ease_out', 'smooth', 'linear'];
const easeOf = (raw) => EASE.find((e) => String(raw || '').includes(e)) || null;

export function parseManimScriptTolerant(code, sw = 1920, sh = 1080) {
  const objects = [];
  const clips = [];
  const varMap = {};
  let bgColor = '#000000';
  let ct = 0;
  let idx = 0;
  const uid = (p) => `${p}_imported_${idx++}`;
  const reg = (name, id) => { varMap[name] = id; };
  const objOf = (name) => objects.find((o) => o.id === varMap[name]);

  const handlePlay = (inner) => {
    const rt = num(String(inner).match(/run_time\s*=\s*([\d.]+)/)?.[1], null);
    const anims = parseArgs(inner).pos.join(' ; ');
    let advanced = 0;
    for (const [ctor, make] of Object.entries(ENTRANCE)) {
      const re = new RegExp(`(?:^|[,(;]\\s*)${ctor}\\s*\\(`, 'g');
      let m;
      while ((m = re.exec(anims))) {
        const vm = /^\s*([\w.]+)/.exec(anims.slice(re.lastIndex));
        if (!vm) continue;
        const o = objOf(vm[1].split('.')[0]);
        const e = make(parseArgs(anims.slice(re.lastIndex)));
        if (o) {
          if (e.exit) { o.exitAnim = 'fade_out'; o.duration = Math.round((ct - (o.enterTime ?? ct) + (rt ?? e.dur)) * 10) / 10; }
          else { o.enterTime = Math.round(ct * 10) / 10; o.enterAnim = e.anim; o.enterAnimDur = rt ?? e.dur; }
        }
        if (!advanced) advanced = rt ?? e.dur;
      }
    }
    for (const m of anims.matchAll(/(\w+)\.animate\.([a-z_]+)/g)) {
      const o = objOf(m[1]);
      if (!advanced) advanced = rt ?? 1;
      if (!o) continue;
      const chain = anims.slice(anims.indexOf(m[0]));
      const to = point(chain);
      const base = { id: uid('clip'), sourceId: o.id, startTime: Math.round(ct * 10) / 10, duration: rt ?? 1, easing: easeOf(inner) || 'ease_in_out', params: {} };
      if (m[2] === 'move_to' && to) { const s = toStage(to.x, to.y, sw, sh); base.type = 'move'; base.params = { targetX: Math.round(s.x), targetY: Math.round(s.y) }; clips.push(base); }
      else if (m[2] === 'scale') { const f = num(chain.replace(/^[\s\S]*?scale\s*\(/, '').split(')')[0], 1) || 1; base.type = 'scale'; base.params = { targetScaleX: f, targetScaleY: f }; clips.push(base); }
      else if (m[2] === 'rotate') { base.type = 'rotate'; base.params = { targetRotation: Math.round(num(chain, 1) * 180 / Math.PI) }; clips.push(base); }
      else if (m[2] === 'set_opacity') { base.type = 'fade'; base.params = { targetOpacity: num(chain, 1) }; clips.push(base); }
    }
    for (const m of anims.matchAll(/(?:ReplacementTransform|FadeTransform|Transform)\s*\(\s*(\w+)\s*,\s*(\w+)/g)) {
      const src = objOf(m[1]);
      const tgt = objOf(m[2]);
      if (src && tgt) clips.push({ id: uid('clip'), type: 'transform', sourceId: src.id, targetId: tgt.id, startTime: Math.round(ct * 10) / 10, duration: rt ?? 1, easing: easeOf(inner) || 'ease_in_out' });
      if (!advanced) advanced = rt ?? 1;
    }
    for (const m of anims.matchAll(/Rotate\s*\(\s*(\w+)\s*,\s*angle\s*=\s*([-\d.]+)/g)) {
      const o = objOf(m[1]);
      if (o) clips.push({ id: uid('clip'), type: 'rotate', sourceId: o.id, startTime: Math.round(ct * 10) / 10, duration: rt ?? 1, easing: 'ease_in_out', params: { targetRotation: Math.round(+m[2] * 180 / Math.PI) } });
      if (!advanced) advanced = rt ?? 1;
    }
    ct += advanced || rt || 1;
  };

  for (const st of statements(code)) {
    let m;
    if ((m = /^(?:self\.camera\.)?(?:config\.)?background_color\s*=\s*["']([^"']+)["']\s*$/.exec(st))) { bgColor = m[1]; continue; }
    if (/^(def|class)\s/.test(st)) { for (const k of Object.keys(varMap)) delete varMap[k]; continue; }
    if ((m = /^self\.wait\((.*)\)$/.exec(st))) { ct += num(m[1], 1) ?? 1; continue; }
    if ((m = /^self\.add\((.*)\)$/.exec(st))) {
      for (const p of parseArgs(m[1]).pos) {
        const o = objOf(p.trim().replace(/^\*+/, ''));
        if (o && o.enterTime === null) { o.enterTime = Math.round(ct * 10) / 10; o.enterAnim = 'none'; }
      }
      continue;
    }
    if ((m = /^self\.play\((.*)\)$/.exec(st))) { handlePlay(m[1]); continue; }
    if (/^[A-Za-z_]\w*\s*\./.test(st) && !st.startsWith('self.')) {
      const o = objOf(st.split('.')[0]);
      if (o) applyChain(o, st.slice(st.indexOf('.')), sw, sh);
      continue;
    }
    if ((m = /^([A-Za-z_]\w*)\s*=\s*(.+)$/.exec(st)) && !st.startsWith('self.')) {
      const [, name, rhs] = m;
      const cm = /^(\w+)\s*\(/.exec(rhs);
      if (cm && KNOWN_CTORS.has(cm[1])) {
        const open = rhs.indexOf('(');
        const close = matchParen(rhs, open);
        const a = parseArgs(rhs.slice(open + 1, close === -1 ? undefined : close));
        const obj = {
          id: uid('obj'), name,
          ...makeObject(cm[1], a, sw, sh),
          enterTime: null, duration: null, enterAnim: 'fade_in', exitAnim: 'none',
          zOrder: objects.length
        };
        applyChain(obj, rhs.slice(close === -1 ? rhs.length : close + 1), sw, sh);
        objects.push(obj);
        reg(name, obj.id);
      } else reg(name, null);
    }
  }

  for (const o of objects) {
    if (o.enterTime === null) o.enterTime = 0;
    if (o.duration === null || o.duration >= 10) o.duration = Math.max(3, Math.round((ct + 1 - o.enterTime) * 10) / 10);
  }

  return {
    objects,
    tracks: clips.length ? [{ id: 'track_parsed', name: 'Track 1', clips }] : [],
    stage: { backgroundColor: bgColor, width: sw, height: sh }
  };
}
