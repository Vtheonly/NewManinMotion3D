FROM manimcommunity/manim:stable

WORKDIR /app

# Ensure Python output is unbuffered for real-time logging
ENV PYTHONUNBUFFERED=1

# Install into image venv as root (base image runs as non-root and cannot write to /opt/venv)
USER root
RUN pip install --no-cache-dir redis==5.0.8 manim-fonts==0.5.0

# Create fonts cache directory (use $HOME since container may not run as root)
RUN mkdir -p $HOME/.cache/manim-fonts

# Copy worker script + scene detection module (Issue #1: renderer no longer
# assumes a fixed MainScene; scene classes are detected from the source)
COPY services/renderer/worker.py /app/worker.py
COPY services/renderer/scene_detect.py /app/scene_detect.py

# Scientific runtime (issue #32): the canonical sci-ir/1 package + reference
# data fixtures, importable by any rendered scene file (PYTHONPATH) and by
# the CLI runner (python -m scientific.run …).  numpy ships with manim.
COPY scientific /app/scientific/scientific
COPY presentation/data /app/scientific/presentation/data
ENV PYTHONPATH="/app/scientific"
ENV SCIENTIFIC_DATA_ROOT="/app/scientific/presentation/data"

CMD ["python", "/app/worker.py"]
