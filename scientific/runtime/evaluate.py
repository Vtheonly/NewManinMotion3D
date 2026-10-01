"""Safe arithmetic expression evaluator for Derived() bindings.

Executes a whitelisted AST subset — literals, names, +, -, *, /, **, unary
minus and a fixed function set — with no attribute access, subscripts or
calls into arbitrary code.  Anything else raises EvaluatorError, which
validation and the renderer surface as clear authoring errors.
"""

from __future__ import annotations

import ast
import math
from typing import Any

from ..ir.errors import IRError


class EvaluatorError(IRError):
    """Unsafe or invalid derived expression."""


FUNCTIONS = {
    "abs": abs, "min": min, "max": max, "round": round,
    "sqrt": math.sqrt, "exp": math.exp, "log": math.log,
    "sin": math.sin, "cos": math.cos, "tan": math.tan,
    "atan": math.atan, "atan2": math.atan2, "tanh": math.tanh,
}

CONSTANTS = {"pi": math.pi, "e": math.e, "tau": math.tau}

_ALLOWED_NODES = (
    ast.Expression, ast.BinOp, ast.UnaryOp, ast.Constant, ast.Name,
    ast.Call, ast.Load, ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow,
    ast.USub, ast.UAdd, ast.Mod, ast.FloorDiv,
)


def evaluate(expression: str, variables: dict[str, Any]) -> float:
    """Evaluate `expression` with `variables`; raise EvaluatorError on abuse."""
    if not isinstance(expression, str) or not expression.strip():
        raise EvaluatorError("empty derived expression")
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise EvaluatorError(f"bad expression {expression!r}: {exc.msg}") from None

    return _eval_node(tree.body, variables)


def _eval_node(node: ast.AST, variables: dict[str, Any]) -> float:
    if not isinstance(node, _ALLOWED_NODES):
        raise EvaluatorError(f"disallowed syntax {type(node).__name__!r} in expression")

    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
            return float(node.value)
        raise EvaluatorError(f"non-numeric literal {node.value!r}")

    if isinstance(node, ast.Name):
        if node.id in CONSTANTS:
            return CONSTANTS[node.id]
        if node.id in variables:
            return float(variables[node.id])
        raise EvaluatorError(f"unknown symbol {node.id!r}")

    if isinstance(node, ast.UnaryOp):
        value = _eval_node(node.operand, variables)
        if isinstance(node.op, ast.USub):
            return -value
        if isinstance(node.op, ast.UAdd):
            return value
        raise EvaluatorError("unsupported unary operator")

    if isinstance(node, ast.BinOp):
        left = _eval_node(node.left, variables)
        right = _eval_node(node.right, variables)
        try:
            if isinstance(node.op, ast.Add):
                return left + right
            if isinstance(node.op, ast.Sub):
                return left - right
            if isinstance(node.op, ast.Mult):
                return left * right
            if isinstance(node.op, ast.Div):
                return left / right
            if isinstance(node.op, ast.Pow):
                return left ** right
            if isinstance(node.op, ast.Mod):
                return left % right
            if isinstance(node.op, ast.FloorDiv):
                return left // right
        except ZeroDivisionError:
            raise EvaluatorError("division by zero in derived expression") from None
        raise EvaluatorError("unsupported binary operator")

    if isinstance(node, ast.Call):
        if not isinstance(node.func, ast.Name) or node.func.id not in FUNCTIONS:
            raise EvaluatorError("only whitelisted math functions may be called")
        if node.keywords:
            raise EvaluatorError("keyword arguments are not allowed")
        args = [_eval_node(a, variables) for a in node.args]
        try:
            return float(FUNCTIONS[node.func.id](*args))
        except (ValueError, OverflowError) as exc:
            raise EvaluatorError(f"math error: {exc}") from None

    raise EvaluatorError(f"unsupported node {type(node).__name__!r}")
