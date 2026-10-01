"""Pseudo-math -> LaTeX conversion (deterministic, mirrored in JS docs).

Author-friendly tokens stay readable in the IR ('tau', '.T', '@'); this
purely syntactic mapping keeps MathTex compilable.  Rules documented in
docs/development/syntax/MATHEMATICS.md.
"""

from __future__ import annotations

import re

GREEK = {
    "alpha", "beta", "gamma", "delta", "Delta", "epsilon", "zeta", "eta",
    "theta", "Theta", "iota", "kappa", "lambda", "mu", "nu", "xi", "pi",
    "rho", "sigma", "Sigma", "tau", "phi", "Phi", "chi", "psi", "omega",
}


def latexify(source: str) -> str:
    out = source
    out = out.replace("@", r"\,")
    out = re.sub(r"\.T\b", r"^{T}", out)
    out = out.replace("*", r"\cdot ")
    for name in sorted(GREEK, key=len, reverse=True):
        out = re.sub(rf"\b{name}\b", rf"\\{name} ", out)
    return out
