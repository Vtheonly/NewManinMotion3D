# Python Scene Syntax — How to Write Code the Tools Accept

> **Audience:** anyone using **Code-Only mode** (or feeding Python files to the
> renderer directly), and maintainers extending scene detection.
> **Applies since:** v1.2.0 (issue #1, iteration 001 — PR #30).

This guide documents the exact Python syntax the toolchain recognizes. "The
tools" are:

- **Renderer worker** (`services/renderer/worker.py`) — runs Manim on your file;
- **Scene detection** (`scene_detect.py` in the renderer, `sceneDetect.js` in
  the API, `detectScenesClient` in the web editor) — finds renderable scene
  classes in your source **without ever executing it**;
- **Compiler** (`services/api/src/compiler/`) — generates code for visual
  projects and verifies generated classes before enqueueing a render.

You write **standard Manim CE code** — nothing proprietary. The only thing the
tools additionally require is that your file declares its scene classes in a
form the detector can see.

---

## 1. The one rule that matters

A class is a **renderable scene** when at least one **direct base class** is
either:

1. a **known Manim scene base** (see table below), or
2. any class whose name **ends with `Scene`** (the `*Scene` naming convention,
   for user-defined scene subclasses).

```python
from manim import *

class Intro(Scene):            # ✅ known base
    def construct(self):
        self.play(Write(Text("Hello")))

class DemoScene(MyBaseScene):  # ✅ *Scene naming convention
    def construct(self):
        ...

class NotAScene(VMobject):     # ❌ not a scene base, not *Scene
    ...
```

Everything else is ordinary Python — imports, helper functions, additional
classes are all allowed and ignored by the detector.

## 2. Recognized scene base classes

| Base class | Project scene type | Notes |
|---|---|---|
| `Scene` | `scene_2d` | standard 2D scene |
| `MovingCameraScene` | `moving_camera` | 2D + movable camera frame |
| `ThreeDScene` | `three_d` | 3D orientation controls |
| `VectorScene` | — (detected, no registry key) | detected + renderable |
| `ZoomedScene` | — (detected, no registry key) | detected + renderable |
| `SampleSpaceScene` | — (detected, no registry key) | detected + renderable |
| `LinearTransformationScene` | — (detected, no registry key) | detected + renderable |
| `manim.Scene` (dotted) | same as `Scene` | dotted paths use the last segment |
| `YourBaseScene` / any `*Scene` | `custom` | custom subclasses |

Multiple bases are fine — a class is listed once if **any** base qualifies:

```python
class Demo(Scene, ABC):   # ✅ Scene base wins; ABC is ignored
    def construct(self): ...
```

## 3. What is NOT treated as a scene

```python
class Dot3D(VMobject): ...          # ❌ mobject, never a scene
class Config: ...                   # ❌ no bases / plain object
class Color(Enum): ...              # ❌ enum base
class Middle(SceneTemplate): ...    # ❌ base doesn't end with "Scene"
```

A class with **no parenthesized bases** (`class Foo:`) is never a scene.
Detection never executes your code — mobjects, helper classes and enums are
safe to define alongside scenes.

## 4. How the renderer picks your scene

Priority order:

1. The **requested `sceneName`** — rendered if a class with that exact name
   exists in the file;
2. otherwise the **first detected scene in source order** (substitution is
   logged and reported in the job result's `sceneName` field).

```python
class First(Scene): ...   # ← rendered unless another name is requested
class Second(Scene): ...  # ← ignored until you ask for it by name
```

So: **put the scene you want rendered by default first**, or pass an explicit
`sceneName` in the render request.

## 5. Complete accepted examples

### 5.1 Standard 2D scene

```python
from manim import *

class MainScene(Scene):
    def construct(self):
        square = Square(color=BLUE)
        self.play(Create(square))
        self.play(square.animate.shift(RIGHT))
```

### 5.2 Moving-camera scene

```python
from manim import *

class ZoomDemo(MovingCameraScene):
    def construct(self):
        title = Text("Camera moves").to_edge(UP)
        box = Rectangle(width=4, height=2)
        self.add(title, box)
        # Camera syntax the tools generate for visual projects mirrors this:
        self.camera.frame.save_state()
        self.play(self.camera.frame.animate.scale(0.5).move_to(box))
```

### 5.3 3D scene

```python
from manim import *

class CubeScene(ThreeDScene):
    def construct(self):
        # Initial orientation — same API the visual editor generates:
        self.set_camera_orientation(phi=75 * DEGREES, theta=45 * DEGREES)
        cube = Cube()
        self.add(cube)
        self.begin_ambient_camera_rotation(rate=0.3)
        self.wait(2)
```

### 5.4 Custom scene classes (own base + subclass)

```python
from manim import *

class MyBaseScene(Scene):            # ✅ known base — also detected
    def setup(self):
        self.border = Rectangle(width=14, height=8).set_stroke(GREY)
        self.add(self.border)

class DemoScene(MyBaseScene):        # ✅ *Scene convention
    def construct(self):
        self.play(Write(Text("Inside a custom base")))
```

## 6. Camera syntax reference (parity with generated code)

When the **visual editor** compiles a project it emits exactly this syntax, so
matching it in Code-Only mode keeps both modes interchangeable:

| Scene type | Camera lines emitted inside `construct()` |
|---|---|
| `Scene` | `self.camera.background_color = "#RRGGBB"` |
| `MovingCameraScene` | `self.camera.frame.width = W` · `self.camera.frame.height = H` · `self.camera.frame.scale(zoom)` · `self.camera.frame.move_to([x, y, 0])` (only configured fields) |
| `ThreeDScene` | `self.set_camera_orientation(phi=…, theta=…, distance=…, zoom=…, gamma=…)` (degrees → radians converted automatically) |
| custom base | background color only — the custom base manages its own camera |

## 7. Checking your file before rendering

**In the editor:** rendering from Code-Only mode no longer requires (or sends)
a scene name — the server auto-detects the scenes in your file and reports the
name it actually rendered in the job result. A visible scene-class picker for
code mode is deferred to issue #15; the client-side helper
(`detectScenesClient` in `export/manim.js`) already mirrors the server rules
for when that lands.

**Via the API:**

```bash
# What scenes does my file contain?
curl -X POST http://localhost:3000/api/detect-scenes \
  -H 'Content-Type: application/json' \
  -d '{"codeSource": "from manim import *\nclass A(Scene):\n    def construct(self):\n        pass\n"}'
# → { "scenes": [{ "name": "A", "bases": ["Scene"], "sceneType": "scene_2d", "known": true }], ... }

# What object/animation/scene types are registered?
curl http://localhost:3000/api/capabilities
```

Render requests accept an optional `sceneName`; when omitted or unknown, rule
§4 applies and the actual name used is reported back.

## 8. Common errors and fixes

| Symptom | Cause → Fix |
|---|---|
| `No renderable scene class found … Define a class inheriting from a Manim Scene base` | No class matches rule §1 → inherit from `Scene`/`ThreeDScene`/… or rename your base to end in `Scene`. |
| Wrong scene rendered | Multiple scenes + no `sceneName` → first scene in source order wins; reorder or request the name explicitly. |
| Scene "not detected" but looks fine | Indirect inheritance where the middle base doesn't end with `Scene` (e.g. `A → B → Scene`) → rename `B` to `…Scene` or inherit `Scene` directly. |
| Syntax-error traceback in render log | The file must be valid Python; detection is skipped for unparseable source and Manim reports the error. |
| Render times out | Worker kills Manim after 10 minutes → reduce scene duration/quality (480p–4K available). |

## 9. Maintainer note — detection parity

Two implementations must stay behaviourally identical (cross-checked by
`services/api/tests/compiler.test.mjs` and
`services/renderer/tests/test_scene_detect.py`):

- `services/api/src/compiler/sceneDetect.js` — comment/string-stripping + class
  regex (API + frontend mirror);
- `services/renderer/scene_detect.py` — stdlib `ast` (authoritative fallback in
  the worker).

**Change the detection rules → update BOTH modules and BOTH test suites.**
Never make either implementation execute user code.
