"""Head/tail log budgeting so long logs fit within the comment size limit."""

HEAD_FRACTION = 0.4
MAX_LINE_CHARS = 2000


def truncate_log(text: str, budget: int) -> str:
    """Keep the first 40% and last 60% of ``budget`` characters, line-aligned.

    Failures usually appear at the end of test output, hence the tail-heavy split.
    A visible marker states how many lines were dropped.
    """
    if budget < 0:
        raise ValueError("budget must be non-negative")
    if len(text) <= budget:
        return text

    lines = [
        line if len(line) <= MAX_LINE_CHARS else line[:MAX_LINE_CHARS] + " …"
        for line in text.splitlines()
    ]
    head_budget = int(budget * HEAD_FRACTION)
    tail_budget = budget - head_budget

    head: list[str] = []
    used = 0
    for line in lines:
        cost = len(line) + 1
        if used + cost > head_budget:
            break
        head.append(line)
        used += cost

    tail: list[str] = []
    used = 0
    for line in reversed(lines[len(head) :]):
        cost = len(line) + 1
        if used + cost > tail_budget:
            break
        tail.append(line)
        used += cost
    tail.reverse()

    dropped = len(lines) - len(head) - len(tail)
    marker = f"… {dropped} lines truncated …"
    return "\n".join([*head, marker, *tail])

