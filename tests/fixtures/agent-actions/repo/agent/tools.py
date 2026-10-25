# Synthetic fixture for agent_actions_detect — never executed.
from langchain_core.tools import tool


@tool
def lookup_shipping(order_id: str) -> str:
    """Look up the shipping status of one of the caller's orders."""
    return order_id
