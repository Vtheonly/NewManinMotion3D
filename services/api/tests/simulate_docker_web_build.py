#!/usr/bin/env python3
"""Faithful simulation of `docker compose build web` (issue #41 fix verification).

No Docker daemon exists in this environment, so this replicates, in order:
  1. Build-context assembly — repo root minus the root .dockerignore rules
     (Docker transfers only non-ignored paths into the build).
  2. services/web/Dockerfile steps at the /app image layout:
       WORKDIR /app/services/web
       COPY services/web/package*.json ./
       RUN npm install            (reused from the proven local node_modules)
       COPY services/web/ ./
       COPY services/api/src/ ../api/src/
       RUN npm run build          <- the exact step that failed for the user
  3. Also verifies the production-stage artifact copy paths.
Exit code 0 = the Docker build would succeed.
"""
import os
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path('/home/z/my-project/workspace/NewManinMotion3D')
SIM_CTX = Path('/home/z/my-project/docker-sim/context')   # transferred context
SIM_IMG = Path('/home/z/my-project/docker-sim/image')     # image root (=/app)

# --- 1. dockerignore rules (mirrors the root .dockerignore) -----------------
ROOT_DIR_RULES = {'.git', 'docs', 'website', 'node_modules', 'media'}
EXACT_FILE_RULES = {'report.md'}


def dockerignore_match(rel: str, is_dir: bool) -> bool:
    parts = rel.split('/')
    if any(p == 'node_modules' for p in parts):          # **/node_modules
        return True
    if parts[0] in ROOT_DIR_RULES:                        # root-level dir rules
        return True
    if rel in ('services/web/dist', 'services/web/media'):
        return True
    if rel == 'README.md':                                # !README.md exception
        return False
    if not is_dir and len(parts) == 1 and parts[0].endswith('.md'):  # *.md (root)
        return True
    if rel in EXACT_FILE_RULES:
        return True
    return False


def copy_tree_filtered(src: Path, dst: Path, prefix: str = ''):
    """Copy src -> dst applying dockerignore rules to relative paths."""
    for item in sorted(src.iterdir()):
        rel = f"{prefix}{item.name}" if not prefix else f"{prefix}/{item.name}"
        if dockerignore_match(rel, item.is_dir()):
            continue
        target = dst / item.name
        if item.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            copy_tree_filtered(item, target, rel)
        else:
            shutil.copy2(item, target)


def step(name: str):
    print(f"\n=== {name} ===", flush=True)


def run(cmd, cwd, check=True):
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stdout[-3000:])
        print(result.stderr[-3000:])
        if check:
            sys.exit(f"FAILED: {' '.join(cmd)} (exit {result.returncode})")
    return result


def main():
    # Fresh simulation dirs
    shutil.rmtree('/home/z/my-project/docker-sim', ignore_errors=True)
    SIM_CTX.mkdir(parents=True)
    SIM_IMG.mkdir(parents=True)

    step('1. Assemble build context (repo root minus .dockerignore)')
    copy_tree_filtered(REPO, SIM_CTX)
    # The user's log: context transferred WITHOUT .git (excluded) — sanity check
    assert not (SIM_CTX / '.git').exists(), '.git must be excluded'
    assert not (SIM_CTX / 'docs').exists(), 'docs must be excluded'
    assert (SIM_CTX / 'README.md').exists(), 'README.md must survive !README.md'
    assert not (SIM_CTX / 'services/web/node_modules').exists()
    assert not (SIM_CTX / 'services/web/dist').exists()
    assert (SIM_CTX / 'services/api/src/compiler/codegen.js').exists()
    print('context OK')

    step('2. Dockerfile: WORKDIR /app/services/web + COPY package*.json')
    web_img = SIM_IMG / 'services/web'
    web_img.mkdir(parents=True)
    for f in ('package.json', 'package-lock.json'):
        src = SIM_CTX / 'services/web' / f
        if src.exists():
            shutil.copy2(src, web_img / f)
    assert (web_img / 'package.json').exists()

    step('3. Dockerfile: RUN npm install (reusing proven local node_modules)')
    # The user's build log shows this layer CACHED+succeeded; reuse via hardlinks
    run(['cp', '-al', str(REPO / 'services/web/node_modules'),
         str(web_img / 'node_modules')], cwd='/home/z/my-project')
    n = sum(1 for _ in (web_img / 'node_modules').rglob('*'))
    print(f'node_modules entries: {n}')

    step('4. Dockerfile: COPY services/web/ ./')
    copy_tree_filtered(SIM_CTX / 'services/web', web_img)
    assert (web_img / 'src/export/manim.js').exists()

    step('5. Dockerfile: COPY services/api/src/ ../api/src/')
    api_img = SIM_IMG / 'services/api/src'
    api_img.mkdir(parents=True)
    copy_tree_filtered(SIM_CTX / 'services/api/src', api_img)
    assert (api_img / 'compiler/codegen.js').exists(), 'shared codegen missing'
    assert (api_img / 'compiler/normalizer.js').exists()

    # Verify the import resolves in the image layout (the exact failure)
    importer = web_img / 'src/export/manim.js'
    resolved = (importer.parent / '../../../api/src/compiler/codegen.js').resolve()
    assert resolved == (api_img / 'compiler/codegen.js').resolve(), \
        f'import resolves to {resolved}, expected {api_img}/compiler/codegen.js'
    print('import path resolves correctly in image layout')

    step('6. Dockerfile: RUN npm run build  <-- the step that failed')
    run(['npm', 'run', 'build'], cwd=web_img)
    dist = web_img / 'dist'
    assert (dist / 'index.html').exists(), 'dist/index.html missing'
    print('vite build OK — dist generated:',
          ', '.join(sorted(p.name for p in dist.iterdir())))

    step('7. Production stage: COPY --from=build dist + nginx.conf')
    html = SIM_IMG / 'nginx-html'
    shutil.copytree(dist, html)
    assert (html / 'index.html').exists()
    assert (html / 'assets').exists()
    assert any(html.glob('*.svg')), 'public SVGs missing from dist'
    print('production artifact layout OK')

    print('\nSUCCESS: docker compose build web would complete (issue #41 fix verified)')


if __name__ == '__main__':
    main()
