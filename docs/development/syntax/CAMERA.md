# Camera — Configuration and Animated Ops per Scene Type

The IR's camera block mirrors the compiler scene registry from issue #1,
so visual (v3) projects and scientific (sci-ir/1) scenes share one camera
vocabulary.

## 1. Static configuration (document `camera`)

Applied by the adapter before any mobject exists:

| Scene type | Supported keys | Effect |
|---|---|---|
| `scene_2d` / `custom` | `backgroundColor` | camera background (palette token or hex) |
| `moving_camera` | `backgroundColor`, `frameWidth`, `frameHeight`, `zoom`, `centerX`, `centerY` | frame size, scale and centring |
| `three_d` | `backgroundColor`, `phi`, `theta`, `distance`, `zoom`, `gamma` | orientation (degrees, converted to radians) |

```python
scene = ScientificScene(
    "torus_poe_kinematics", scene_type="three_d",
    camera={"backgroundColor": "bg", "phi": 68, "theta": -42,
            "distance": 12.0})
```

Default background: `#101014`. Palette tokens (`bg`, `panel`, `accent`,
`ok`, `warn`, `fail`, …) resolve through the shared theme
(`domains/ui/palette.py`) and may be overridden per theme without touching
scene semantics.

## 2. Animated camera steps (timeline `camera` op)

```python
st.camera({"zoom": 1.12}, duration=2.6)          # moving camera
st.camera({"orbit": 0.18}, duration=3.2)         # 3D ambient orbit
st.camera({"theta": 35, "phi": 62}, duration=2.4)  # 3D move_camera
```

| Scene type | Properties | Behaviour |
|---|---|---|
| `moving_camera` | `zoom` / `centerX`+`centerY` | `frame.animate.scale(...)` / `move_to(...)` |
| `three_d` | `orbit` | `begin_ambient_camera_rotation(rate)` for `duration`, then stop |
| `three_d` | `phi`, `theta` | `move_camera(...)` |

## 3. Fixed HUD (camera-relative elements)

`hud.fixed` nodes are camera-independent overlays:

```python
scene.node("hud.fixed", "hud_mode",
           text="TIF cross-attention | distance-biased", corner="UL")
```

In `three_d` scenes they are registered with
`add_fixed_in_frame_mobjects`, so orbiting the camera leaves HUD text
pinned — the reference attention scene demonstrates this with both a
top-left mode line and a bottom-left parameter readout.

## 4. Frontend contract

Camera state is ordinary IR: the same blocks are editable, serializable and
round-trip through export. A camera *path* editor (keyframed moves beyond
the declarative ops above) is scoped to issue #24; the current ops are the
closed, runnable subset.
