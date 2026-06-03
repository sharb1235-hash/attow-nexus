class NexusError(RuntimeError):
    """Base error for Nexus SDK operations."""


class NexusConnectionError(NexusError):
    """Raised when the local Attow Nexus daemon cannot be reached."""


class NexusValidationError(NexusError):
    """Raised when SDK input validation fails before a daemon request."""
