from __future__ import annotations

import logging
from typing import Any

from nexus_ipc.client import NexusClient
from nexus_ipc.models import CommitResult
from nexus_ipc.universal import (
    UniversalAgentEvent,
    channel_for_event,
    default_thread_id,
    event_to_checkpoint_payload,
    normalize_event,
)

LOGGER = logging.getLogger(__name__)


class NexusAdapterBase:
    framework_name = "custom"
    language = "python"

    def __init__(
        self,
        client: NexusClient,
        run_id: str,
        agent_id: str,
        thread_id: str | None = None,
        durable: bool = True,
        fail_open: bool = True,
        tags: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.client = client
        self.run_id = run_id
        self.agent_id = agent_id
        self.thread_id = thread_id
        self.durable = durable
        self.fail_open = fail_open
        self.tags = [self.framework_name, *(tags or [])]
        self.metadata = dict(metadata or {})
        self._registered_threads: set[str] = set()
        self._last_commit_id_by_thread: dict[str, str] = {}

    def derive_thread_id(self, explicit_thread_id: str | None = None) -> str:
        return explicit_thread_id or self.thread_id or default_thread_id(self.run_id, self.framework_name)

    def register(self, thread_id: str | None = None) -> None:
        resolved_thread_id = self.derive_thread_id(thread_id)
        if resolved_thread_id in self._registered_threads:
            return
        self._call(
            self.client.register_agent,
            agent_id=self.agent_id,
            run_id=self.run_id,
            thread_id=resolved_thread_id,
            capabilities=[self.framework_name, "universal-events"],
            framework=self.framework_name,
            language=self.language,
            metadata={**self.metadata, "adapter": "public-surface-wrapper"},
        )
        self._registered_threads.add(resolved_thread_id)

    def publish_event(self, event: UniversalAgentEvent) -> None:
        self.register(event.thread_id)
        self._call(
            self.client.publish_delta,
            channel=channel_for_event(event),
            delta=event_to_checkpoint_payload(event),
            durable=False,
            agent_id=self.agent_id,
            run_id=self.run_id,
            thread_id=event.thread_id,
            summary=f"{self.framework_name} {event.event_type}",
            tags=[*self.tags, event.event_type],
            metadata={**self.metadata, "universal_event": "true"},
        )

    def checkpoint_event(self, event: UniversalAgentEvent) -> list[str]:
        self.register(event.thread_id)
        parents = list(event.parent_commit_ids)
        if not parents and self._last_commit_id_by_thread.get(event.thread_id):
            parents = [self._last_commit_id_by_thread[event.thread_id]]
        event.parent_commit_ids = parents
        result = self._call(
            self.client.checkpoint,
            agent_id=self.agent_id,
            run_id=self.run_id,
            thread_id=event.thread_id,
            channel=channel_for_event(event),
            state=event_to_checkpoint_payload(event),
            summary=f"{self.framework_name} {event.event_type}",
            tags=[*self.tags, event.event_type, *event.tags],
            metadata={**self.metadata, "universal_event": "true"},
            parent_commit_ids=parents,
        )
        commit_id = self._commit_id(result)
        if commit_id:
            self._last_commit_id_by_thread[event.thread_id] = commit_id
            return [commit_id]
        return parents

    def event(self, event_type: str, thread_id: str | None = None, **kwargs: Any) -> UniversalAgentEvent:
        resolved_thread_id = self.derive_thread_id(thread_id)
        parent_commit_ids = kwargs.pop("parent_commit_ids", None)
        if parent_commit_ids is None and self._last_commit_id_by_thread.get(resolved_thread_id):
            parent_commit_ids = [self._last_commit_id_by_thread[resolved_thread_id]]
        return normalize_event(
            adapter_name=self.framework_name,
            adapter_version=str(self.metadata.get("adapter_version", "0.1.0")),
            run_id=self.run_id,
            thread_id=resolved_thread_id,
            agent_id=self.agent_id,
            framework=self.framework_name,
            language=self.language,
            event_type=event_type,
            metadata={**self.metadata, **dict(kwargs.pop("metadata", {}) or {})},
            tags=[*self.tags, *list(kwargs.pop("tags", []) or [])],
            parent_commit_ids=parent_commit_ids or [],
            **kwargs,
        )

    def close(self) -> None:
        return None

    def _call(self, func: Any, *args: Any, **kwargs: Any) -> Any:
        try:
            return func(*args, **kwargs)
        except Exception as exc:
            if not self.fail_open:
                raise
            LOGGER.warning("Attow Nexus %s adapter call failed: %s", self.framework_name, exc)
            return None

    @staticmethod
    def _commit_id(result: Any) -> str | None:
        if result is None:
            return None
        if isinstance(result, CommitResult):
            return result.commit_id
        commit_id = getattr(result, "commit_id", None) or getattr(result, "id", None)
        if not commit_id and isinstance(result, dict):
            commit_id = result.get("commitId") or result.get("commit_id")
        return str(commit_id) if commit_id else None
