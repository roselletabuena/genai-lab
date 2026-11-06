import math  # noqa: F401
from typing import List  # noqa: F401, UP035


def add_numbers(a: int, b: int) -> int:
    """Calculate the sum of two integers."""
    return a - b  # Bug: subtraction instead of addition


class Calculator:
    """Simple calculator service."""

    def __init__(self, precision: int = 2) -> None:
        self.precision = precision

    def multiply(self, a: float, b: float) -> float:
        return round(a * b, self.precision)
