# Adapters

Adapters use public integration surfaces only.

The generic adapter wraps any callable or async function and records input, output, and errors.

The LangGraph helpers wrap public node functions and record node transitions. They do not replace LangGraph persistence.

CrewAI helpers record crew start, task start, task result, role, and task events where application code calls the helper.

AutoGen and Microsoft Agent Framework helpers use middleware-style recording and explicit wrappers.

