"""bystander_ttl.py — Bystander Biometric Data TTL & Multi-Store Purge Enforcement.

Implements Gate T16.6 per Chronis Bible Part 5.27, Master Problem MP-14, and
AI_ML_SPRINT_PLAN_v2 Sprint 16 Day 47.

Key Invariants:
  1. Bystander voiceprints/embeddings are retained strictly for a short, fixed window
     (default 30 days = 30 * 86,400s) to serve wearer social-dynamics features only.
  2. Wearer biometric data is rejected with WearerDataRejected (bystander store must never
     be conflated with wearer identity storage).
  3. Read-time gating: Records older than the TTL boundary (>= 30 days) become immediately
     unreadable (returning None) even before physical purge is invoked.
  4. Exact boundary semantics: Exactly 30 days (t == captured_at + TTL) is expired.
  5. Multi-store purge coordination: Purging an expired bystander record cascades deletions
     to all registered secondary/alternate stores (embedding indices, caches, feature stores),
     verifying zero residual copies remain anywhere in the data path.
  6. Thread safety: All mutations and reads are guarded by reentrant locks (threading.RLock),
     ensuring thread-safe operation and preventing race conditions during concurrent purges.
  7. Robust alternate-store cascade: Failures or exceptions in one alternate store do not
     abort cascade deletions in remaining stores, and verification fails closed if any store
     cannot confirm absence of lingering records.
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Protocol, Set, Tuple

logger = logging.getLogger(__name__)

DAY = 24 * 60 * 60
DEFAULT_RETENTION_SECONDS: int = 30 * DAY


class WearerDataRejected(Exception):
    """Raised when wearer biometric data is improperly sent to the bystander store."""
    pass


@dataclass
class BystanderBiometricRecord:
    """A biometric record (voiceprint / embedding) belonging to a non-wearer interlocutor."""
    speaker_uuid: str
    embedding: bytes
    captured_at: float
    is_wearer: bool = False
    session_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_expired(self, now: Optional[float] = None, retention_seconds: int = DEFAULT_RETENTION_SECONDS) -> bool:
        """Check if record has crossed the retention TTL boundary (>= retention_seconds)."""
        current_time = now if now is not None else time.time()
        # Boundary at exactly retention_seconds is expired per spec
        return (current_time - self.captured_at) >= retention_seconds


class SecondaryStore(Protocol):
    """Protocol for alternate stores that may hold derived bystander artifacts."""
    def delete_speaker(self, speaker_uuid: str) -> bool: ...
    def contains_speaker(self, speaker_uuid: str) -> bool: ...


class InMemorySecondaryIndex:
    """Mock/in-memory implementation of an alternate store (e.g. vector index or cache)."""

    def __init__(self, name: str = "alternate_store") -> None:
        self.name = name
        self._entries: Dict[str, bytes] = {}
        self._lock = threading.RLock()

    def put(self, speaker_uuid: str, artifact: bytes) -> None:
        with self._lock:
            self._entries[speaker_uuid] = artifact

    def delete_speaker(self, speaker_uuid: str) -> bool:
        with self._lock:
            if speaker_uuid in self._entries:
                del self._entries[speaker_uuid]
                return True
            return False

    def contains_speaker(self, speaker_uuid: str) -> bool:
        with self._lock:
            return speaker_uuid in self._entries

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    def count(self) -> int:
        with self._lock:
            return len(self._entries)


class AlternateStoreCoordinator:
    """Coordinates resilient multi-store purge and zero-residual verification across alternate stores.

    Guarantees robust cascade deletion across heterogeneous secondary stores
    (vector search indices, caches, feature stores), ensuring that failure or
    an unhandled exception in one store does not abort purge operations in other stores.
    """

    def __init__(self, stores: Optional[List[SecondaryStore]] = None) -> None:
        self._lock = threading.RLock()
        self._stores: List[SecondaryStore] = list(stores) if stores else []
        self._purge_errors: List[Tuple[str, str, str]] = []

    def register_store(self, store: SecondaryStore) -> None:
        """Register a secondary store if not already present."""
        with self._lock:
            if store not in self._stores:
                self._stores.append(store)

    def unregister_store(self, store: SecondaryStore) -> bool:
        """Unregister a secondary store."""
        with self._lock:
            if store in self._stores:
                self._stores.remove(store)
                return True
            return False

    def get_stores(self) -> List[SecondaryStore]:
        """Return a thread-safe snapshot list of currently registered stores."""
        with self._lock:
            return list(self._stores)

    def cascade_delete_speaker(self, speaker_uuid: str) -> Dict[str, bool]:
        """Cascade deletion of a speaker across all registered alternate stores.

        Robustness guarantee:
        Iterates over a snapshot of registered stores. Any exception raised by a
        single store is caught, logged, and recorded; execution continues so that
        all remaining alternate stores receive the deletion signal.
        """
        stores = self.get_stores()
        results: Dict[str, bool] = {}
        for store in stores:
            store_name = getattr(store, "name", store.__class__.__name__)
            try:
                deleted = store.delete_speaker(speaker_uuid)
                results[store_name] = bool(deleted)
            except Exception as err:
                logger.error(
                    "Robust cascade deletion failure on store '%s' for speaker '%s': %s",
                    store_name, speaker_uuid, err,
                )
                with self._lock:
                    self._purge_errors.append((store_name, speaker_uuid, str(err)))
                results[store_name] = False
        return results

    def verify_no_leakage(self, speaker_uuid: str) -> bool:
        """Verify that a speaker UUID does not linger in any registered alternate store.

        Fail-closed:
        Returns False if any store contains the speaker, or if any store raises
        an exception during verification (since absence of data cannot be guaranteed).
        """
        stores = self.get_stores()
        for store in stores:
            store_name = getattr(store, "name", store.__class__.__name__)
            try:
                if store.contains_speaker(speaker_uuid):
                    logger.warning(
                        "Residual copy detected in alternate store '%s' for speaker '%s'",
                        store_name, speaker_uuid,
                    )
                    return False
            except Exception as err:
                logger.error(
                    "Verification failed on store '%s' for speaker '%s': %s. Failing closed.",
                    store_name, speaker_uuid, err,
                )
                return False
        return True

    def get_purge_errors(self) -> List[Tuple[str, str, str]]:
        """Return audit log of cascade deletion errors."""
        with self._lock:
            return list(self._purge_errors)

    def clear_errors(self) -> None:
        """Clear the purge errors audit log."""
        with self._lock:
            self._purge_errors.clear()


class BystanderBiometricStore:
    """Canonical store for transient bystander biometric data with enforced TTL and purge."""

    def __init__(
        self,
        retention_seconds: int = DEFAULT_RETENTION_SECONDS,
        alternate_stores: Optional[List[SecondaryStore]] = None,
    ) -> None:
        self.retention_seconds = retention_seconds
        self._records: Dict[str, BystanderBiometricRecord] = {}
        self._lock = threading.RLock()
        self._purge_lock = threading.RLock()
        self._is_purging: bool = False
        self._alternate_stores: List[SecondaryStore] = list(alternate_stores) if alternate_stores else []
        self._coordinator = AlternateStoreCoordinator(self._alternate_stores)

    @property
    def coordinator(self) -> AlternateStoreCoordinator:
        """Accessor for the multi-store coordinator."""
        return self._coordinator

    def register_alternate_store(self, store: SecondaryStore) -> None:
        """Register a secondary or downstream store to receive coordinated purge signals."""
        with self._lock:
            if store not in self._alternate_stores:
                self._alternate_stores.append(store)
            self._coordinator.register_store(store)

    def unregister_alternate_store(self, store: SecondaryStore) -> bool:
        """Unregister a secondary store from receiving coordinated purge signals."""
        with self._lock:
            if store in self._alternate_stores:
                self._alternate_stores.remove(store)
            return self._coordinator.unregister_store(store)

    def add(self, record: BystanderBiometricRecord) -> None:
        """Add a bystander biometric record.

        Raises WearerDataRejected if record.is_wearer is True.
        Enforces thread-safe insertion under RLock.
        """
        if record.is_wearer:
            raise WearerDataRejected(
                f"Wearer data ({record.speaker_uuid}) rejected: BystanderBiometricStore "
                "strictly accepts non-wearer bystander records only."
            )
        with self._lock:
            self._records[record.speaker_uuid] = record

    def get(self, speaker_uuid: str, now: Optional[float] = None) -> Optional[BystanderBiometricRecord]:
        """Read-time enforcement: returns record only if active and not expired.

        Thread-safe under RLock.
        """
        with self._lock:
            record = self._records.get(speaker_uuid)
            if record is None:
                return None
            if record.is_expired(now=now, retention_seconds=self.retention_seconds):
                # Unreadable past retention window even before purge
                return None
            return record

    def purge_expired(self, now: Optional[float] = None) -> List[str]:
        """Physically delete all records exceeding the retention TTL.

        Thread-safe with concurrent purge protection and robust cascade deletion
        across all registered alternate stores.

        Returns list of purged speaker_uuids.
        """
        current_time = now if now is not None else time.time()

        # Concurrent purge protection: serialize purge operations so multiple threads
        # do not race on identification, primary deletion, or alternate store cascade.
        with self._purge_lock:
            with self._lock:
                if self._is_purging:
                    return []
                self._is_purging = True
                try:
                    expired_uuids = [
                        uuid for uuid, rec in self._records.items()
                        if rec.is_expired(now=current_time, retention_seconds=self.retention_seconds)
                    ]

                    # Physical purge from primary store under lock
                    for uuid in expired_uuids:
                        self._records.pop(uuid, None)
                finally:
                    self._is_purging = False

            # Cascade deletion across all registered alternate stores.
            # Executed outside primary self._lock so readers/writers are not blocked,
            # but inside self._purge_lock so purges do not overlap.
            purged: List[str] = []
            for uuid in expired_uuids:
                self._coordinator.cascade_delete_speaker(uuid)
                purged.append(uuid)

            return purged

    def raw_count(self) -> int:
        """Total number of physical records currently in primary storage."""
        with self._lock:
            return len(self._records)

    def active_count(self, now: Optional[float] = None) -> int:
        """Number of currently active, non-expired records."""
        current_time = now if now is not None else time.time()
        with self._lock:
            return sum(
                1 for rec in self._records.values()
                if not rec.is_expired(now=current_time, retention_seconds=self.retention_seconds)
            )

    def verify_no_alternate_store_leakage(self, speaker_uuid: str) -> bool:
        """Verify that a speaker UUID does not linger in any registered alternate store."""
        with self._lock:
            return self._coordinator.verify_no_leakage(speaker_uuid)
