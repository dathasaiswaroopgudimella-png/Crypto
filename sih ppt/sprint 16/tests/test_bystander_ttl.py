import sys
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from bystander_ttl import (
    BystanderBiometricRecord,
    BystanderBiometricStore,
    InMemorySecondaryIndex,
    WearerDataRejected,
    DEFAULT_RETENTION_SECONDS,
)

DAY = 24 * 60 * 60


class TestBystanderTTL(unittest.TestCase):
    def setUp(self):
        self.now = time.time()
        self.store = BystanderBiometricStore()

    def _record(self, uuid, days_ago, is_wearer=False):
        return BystanderBiometricRecord(
            speaker_uuid=uuid,
            embedding=b"fake-voiceprint-bytes",
            captured_at=self.now - days_ago * DAY,
            is_wearer=is_wearer,
        )

    def test_record_within_window_is_active(self):
        self.store.add(self._record("bystander-1", days_ago=29))
        self.assertIsNotNone(self.store.get("bystander-1", now=self.now))

    def test_record_past_window_is_unreadable_before_purge(self):
        self.store.add(self._record("bystander-2", days_ago=31))
        # not purged yet -- still physically present in the store...
        self.assertEqual(self.store.raw_count(), 1)
        # ...but read-time enforcement must refuse to hand it back.
        self.assertIsNone(self.store.get("bystander-2", now=self.now))

    def test_purge_actually_deletes_expired_records(self):
        self.store.add(self._record("bystander-3", days_ago=45))
        self.store.add(self._record("bystander-4", days_ago=10))
        purged = self.store.purge_expired(now=self.now)
        self.assertEqual(purged, ["bystander-3"])
        self.assertEqual(self.store.raw_count(), 1)
        self.assertIsNotNone(self.store.get("bystander-4", now=self.now))

    def test_boundary_exactly_at_30_days_is_expired(self):
        record = self._record("bystander-5", days_ago=30)
        self.store.add(record)
        self.assertTrue(record.is_expired(now=self.now))

    def test_wearer_data_rejected(self):
        with self.assertRaises(WearerDataRejected):
            self.store.add(self._record("wearer-self", days_ago=1, is_wearer=True))

    def test_active_count_excludes_expired_but_unpurged(self):
        self.store.add(self._record("bystander-6", days_ago=5))
        self.store.add(self._record("bystander-7", days_ago=40))
        self.assertEqual(self.store.active_count(now=self.now), 1)
        self.assertEqual(self.store.raw_count(), 2)

    def test_default_retention_is_30_days(self):
        self.assertEqual(DEFAULT_RETENTION_SECONDS, 30 * DAY)

    def test_alternate_stores_are_purged_in_sync_with_primary(self):
        """DoD Requirement: Bystander biometric artifacts disappear at declared TTL
        and are NOT recoverable through alternate stores."""
        alt_vector_index = InMemorySecondaryIndex("faiss_vector_index")
        alt_cache = InMemorySecondaryIndex("redis_cache")

        self.store.register_alternate_store(alt_vector_index)
        self.store.register_alternate_store(alt_cache)

        # Populate primary and secondary stores
        uuid_exp = "bystander-exp"
        uuid_act = "bystander-act"

        self.store.add(self._record(uuid_exp, days_ago=35))
        self.store.add(self._record(uuid_act, days_ago=5))

        alt_vector_index.put(uuid_exp, b"vector-embedding-exp")
        alt_vector_index.put(uuid_act, b"vector-embedding-act")
        alt_cache.put(uuid_exp, b"cached-features-exp")
        alt_cache.put(uuid_act, b"cached-features-act")

        # Run coordinated purge
        purged = self.store.purge_expired(now=self.now)
        self.assertIn(uuid_exp, purged)

        # Verify primary store
        self.assertIsNone(self.store.get(uuid_exp, now=self.now))
        self.assertIsNotNone(self.store.get(uuid_act, now=self.now))

        # Verify alternate stores - zero recoverable copies
        self.assertFalse(alt_vector_index.contains_speaker(uuid_exp))
        self.assertFalse(alt_cache.contains_speaker(uuid_exp))
        self.assertTrue(self.store.verify_no_alternate_store_leakage(uuid_exp))

        # Active speaker remains intact
        self.assertTrue(alt_vector_index.contains_speaker(uuid_act))
        self.assertTrue(alt_cache.contains_speaker(uuid_act))


if __name__ == "__main__":
    unittest.main()
