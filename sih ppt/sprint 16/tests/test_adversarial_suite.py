"""test_adversarial_suite.py — 10,000-Trial Adversarial Property Test Suite.

Sprint 16 Trust-Boundary Hardening:
Enforces Rule 4 (Zero Leakage Tolerance: 0 Unauthorized Disclosures, 0 Unauthorized Mutations).

Comprehensive Adversarial Testing Across 4 Security Domains:
  1. Domain 1 (2,500 trials): Cross-User Data Leakage & Memory Isolation
     - Cross-user bystander query isolation (no cross-tenant leakage)
     - Wearer biometric data hard rejection (WearerDataRejected)
     - Multi-store cascade purge & alternate store zero-residue verification
     - Container cross-session memory bleed prevention & buffer zeroing
  2. Domain 2 (2,500 trials): Malformed Session Keys & Fuzz Invariants
     - Corrupted, truncated, zero-length, and oversized key material
     - Fuzzed key IDs (SQLi, format strings, null bytes, unicode surrogates)
     - Forged, zero, and negative TTLs / timestamps
     - Session key lifecycle teardown & post-zero access protection
  3. Domain 3 (2,500 trials): Boundary Timestamp Manipulation & Time Travel
     - Sub-microsecond / nanosecond boundary tests on 24h SessionKey TTL
     - Sub-microsecond / nanosecond boundary tests on 30-day Bystander retention
     - Clock skew, retroactive time-travel, distant future, and IEEE 754 float fuzzing
     - Monotonic expiration invariant validation
  4. Domain 4 (2,500 trials): Concurrent Races & Multi-Threaded Stress
     - Multi-threaded concurrent read, write, and cascade purge races
     - High-concurrency IsolatedProcessingContainer in-RAM processing
     - Simultaneous SecureBuffer memoryview read vs zeroing races
     - Thread-safe state integrity & zero residual alternate store copies

Total Trials: 10,000
Rule 4 Invariant: 0 Unauthorized Disclosures, 0 Unauthorized Mutations.
"""

from __future__ import annotations

import concurrent.futures
import hashlib
import json
import math
import os
import platform
import random
import secrets
import sys
import time
import unittest
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from isolation import (
    ExecutionTarget,
    FirecrackerRuntime,
    GvisorRuntime,
    IsolatedProcessingContainer,
    LocalDevRuntime,
    MockConstitutionalLayerClient,
    SecureBuffer,
    SessionKey,
    SessionKeyExpired,
)
from bystander_ttl import (
    DAY,
    DEFAULT_RETENTION_SECONDS,
    BystanderBiometricRecord,
    BystanderBiometricStore,
    InMemorySecondaryIndex,
    WearerDataRejected,
)


@dataclass
class DomainMetrics:
    """Detailed telemetry and audit trail for an adversarial testing domain."""
    domain_id: str
    domain_name: str
    trials_allocated: int
    trials_executed: int = 0
    unauthorized_disclosures: int = 0
    unauthorized_mutations: int = 0
    invariant_violations: int = 0
    elapsed_seconds: float = 0.0
    passed: bool = False
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AdversarialSuiteReport:
    """Aggregate execution report for the 10,000-trial adversarial suite."""
    suite_name: str = "Chronis Sprint 16 Adversarial Trust-Boundary Property Suite"
    standard_reference: str = "Chronis Master Document §14, §16 & Rule 4"
    rule_4_mandate: str = "Zero Leakage Tolerance (0 Disclosures, 0 Mutations)"
    timestamp: str = ""
    environment: Dict[str, str] = field(default_factory=dict)
    total_trials: int = 10000
    total_executed: int = 0
    total_unauthorized_disclosures: int = 0
    total_unauthorized_mutations: int = 0
    total_invariant_violations: int = 0
    rule_4_compliant: bool = False
    total_elapsed_seconds: float = 0.0
    domains: Dict[str, DomainMetrics] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["domains"] = {k: asdict(v) for k, v in self.domains.items()}
        return d


# =====================================================================
# DOMAIN 1: Cross-User Data Leakage & Memory Isolation (2,500 Trials)
# =====================================================================

def run_domain_1_cross_user_isolation(n_trials: int = 2500, seed: int = 20260908) -> DomainMetrics:
    """Execute 2,500 trials testing cross-user isolation and memory bleed prevention."""
    rng = random.Random(seed)
    metrics = DomainMetrics(
        domain_id="D1",
        domain_name="Cross-User Data Leakage & Memory Isolation",
        trials_allocated=n_trials,
    )
    t0 = time.perf_counter()

    # Partition trials across specific security invariants
    trials_query_iso = 700
    trials_wearer_rejection = 600
    trials_cascade_purge = 600
    trials_memory_bleed = 600

    assert trials_query_iso + trials_wearer_rejection + trials_cascade_purge + trials_memory_bleed == n_trials

    # -------------------------------------------------------------
    # Invariant 1.1: Cross-User Query Isolation (700 trials)
    # -------------------------------------------------------------
    store_d1 = BystanderBiometricStore()
    now = time.time()
    user_records: Dict[str, bytes] = {}

    for i in range(trials_query_iso):
        uid_a = f"d1_user_a_{i}_{rng.getrandbits(32):08x}"
        uid_b = f"d1_user_b_{i}_{rng.getrandbits(32):08x}"
        secret_a = secrets.token_bytes(32)
        secret_b = secrets.token_bytes(32)

        # Store User A
        rec_a = BystanderBiometricRecord(
            speaker_uuid=uid_a,
            embedding=secret_a,
            captured_at=now - (rng.uniform(1, 20) * DAY),
        )
        store_d1.add(rec_a)
        user_records[uid_a] = secret_a

        # Adversary attempts cross-user query: Querying uid_b must NOT return uid_a's data
        queried = store_d1.get(uid_b, now=now)
        if queried is not None:
            if queried.embedding == secret_a or queried.speaker_uuid == uid_a:
                metrics.unauthorized_disclosures += 1

        # Querying with randomized unknown UUID
        random_uuid = f"random_attacker_{rng.getrandbits(48):012x}"
        queried_rand = store_d1.get(random_uuid, now=now)
        if queried_rand is not None:
            metrics.unauthorized_disclosures += 1

        metrics.trials_executed += 1

    # -------------------------------------------------------------
    # Invariant 1.2: Wearer Biometric Hard Rejection (600 trials)
    # -------------------------------------------------------------
    for i in range(trials_wearer_rejection):
        wearer_id = f"wearer_target_{i}_{rng.getrandbits(32):08x}"
        wearer_payload = secrets.token_bytes(rng.randint(16, 64))
        rec_wearer = BystanderBiometricRecord(
            speaker_uuid=wearer_id,
            embedding=wearer_payload,
            captured_at=now - rng.uniform(0, 1000),
            is_wearer=True,
        )

        initial_count = store_d1.raw_count()
        rejected = False
        try:
            store_d1.add(rec_wearer)
        except WearerDataRejected:
            rejected = True
        except Exception:
            metrics.invariant_violations += 1

        if not rejected:
            # Unauthorized mutation: Wearer data improperly accepted into bystander store
            metrics.unauthorized_mutations += 1

        # Confirm store count did NOT change and wearer ID was NOT stored
        if store_d1.raw_count() != initial_count or wearer_id in store_d1._records:
            metrics.unauthorized_mutations += 1

        metrics.trials_executed += 1

    # -------------------------------------------------------------
    # Invariant 1.3: Multi-Store Cascade Purge & Alternate Zero-Residue (600 trials)
    # -------------------------------------------------------------
    sec_index = InMemorySecondaryIndex("faiss_vector_index_d1")
    sec_cache = InMemorySecondaryIndex("redis_feature_cache_d1")
    cascade_store = BystanderBiometricStore()
    cascade_store.register_alternate_store(sec_index)
    cascade_store.register_alternate_store(sec_cache)

    purged_expected = []
    active_expected = []

    for i in range(trials_cascade_purge):
        uid = f"cascade_user_{i}_{rng.getrandbits(32):08x}"
        emb = secrets.token_bytes(24)
        is_expired = (i % 2 == 0)
        age_days = rng.uniform(30.01, 120.0) if is_expired else rng.uniform(0.1, 29.5)
        captured = now - (age_days * DAY)

        rec = BystanderBiometricRecord(speaker_uuid=uid, embedding=emb, captured_at=captured)
        cascade_store.add(rec)
        sec_index.put(uid, emb)
        sec_cache.put(uid, emb)

        # Read-time gating check before purge: expired record MUST return None
        retrieved = cascade_store.get(uid, now=now)
        if is_expired:
            if retrieved is not None:
                # Unauthorized disclosure: read-time gating failed to block expired record
                metrics.unauthorized_disclosures += 1
            purged_expected.append(uid)
        else:
            if retrieved is None or retrieved.embedding != emb:
                # Unauthorized mutation or data loss on active record
                metrics.unauthorized_mutations += 1
            active_expected.append(uid)

        metrics.trials_executed += 1

    # Execute cascade purge
    purged_actual = cascade_store.purge_expired(now=now)

    # Verify 100% deletion across primary store and all alternate stores
    for p_uid in purged_expected:
        # Check primary store
        if cascade_store.get(p_uid, now=now) is not None:
            metrics.unauthorized_disclosures += 1
        # Check secondary stores
        if not cascade_store.verify_no_alternate_store_leakage(p_uid):
            metrics.unauthorized_disclosures += 1
        if sec_index.contains_speaker(p_uid) or sec_cache.contains_speaker(p_uid):
            metrics.unauthorized_disclosures += 1

    # Verify active records remain uncorrupted
    for a_uid in active_expected:
        if cascade_store.get(a_uid, now=now) is None:
            metrics.unauthorized_mutations += 1
        if not sec_index.contains_speaker(a_uid) or not sec_cache.contains_speaker(a_uid):
            metrics.unauthorized_mutations += 1

    # -------------------------------------------------------------
    # Invariant 1.4: Container Cross-Session Memory Bleed Prevention (600 trials)
    # -------------------------------------------------------------
    client = MockConstitutionalLayerClient()
    container = IsolatedProcessingContainer(client, preferred_runtime=LocalDevRuntime(), allow_no_isolation=True)

    previous_secret: Optional[bytes] = None
    for i in range(trials_memory_bleed):
        current_secret = secrets.token_bytes(rng.randint(32, 128))
        seen_bytes_in_session: List[bytes] = []

        def decrypt_callback(k: SessionKey, s=current_secret) -> bytes:
            return s

        def process_callback(buf: bytearray) -> bytes:
            seen_bytes_in_session.append(bytes(buf))
            # Perform simulated transform
            return hashlib.sha256(buf).digest()

        res = container.process(decrypt_callback, process_callback)

        # Invariant: Current session MUST see its own secret
        if seen_bytes_in_session[0] != current_secret:
            metrics.unauthorized_mutations += 1

        # Invariant: Current session must NEVER contain any slice of previous session's secret
        if previous_secret is not None:
            if previous_secret in seen_bytes_in_session[0]:
                metrics.unauthorized_disclosures += 1

        previous_secret = current_secret
        metrics.trials_executed += 1

    metrics.elapsed_seconds = time.perf_counter() - t0
    metrics.passed = (
        metrics.unauthorized_disclosures == 0
        and metrics.unauthorized_mutations == 0
        and metrics.invariant_violations == 0
        and metrics.trials_executed == n_trials
    )
    metrics.details = {
        "cross_user_queries_tested": trials_query_iso,
        "wearer_rejections_tested": trials_wearer_rejection,
        "cascade_purges_tested": trials_cascade_purge,
        "container_sessions_tested": trials_memory_bleed,
        "purged_alternate_records_cleared": len(purged_expected),
        "active_records_preserved": len(active_expected),
    }
    return metrics


# =====================================================================
# DOMAIN 2: Malformed Session Keys & Fuzz Invariants (2,500 Trials)
# =====================================================================

def run_domain_2_malformed_session_keys(n_trials: int = 2500, seed: int = 20260908) -> DomainMetrics:
    """Execute 2,500 trials fuzzing session keys, buffers, and cryptographic structures."""
    rng = random.Random(seed)
    metrics = DomainMetrics(
        domain_id="D2",
        domain_name="Malformed Session Keys & Fuzz Invariants",
        trials_allocated=n_trials,
    )
    t0 = time.perf_counter()

    trials_buffer_fuzz = 700
    trials_id_fuzz = 600
    trials_ttl_fuzz = 600
    trials_replay_fuzz = 600

    assert trials_buffer_fuzz + trials_id_fuzz + trials_ttl_fuzz + trials_replay_fuzz == n_trials

    # -------------------------------------------------------------
    # Invariant 2.1: Corrupted Key Material & SecureBuffer Fuzzing (700 trials)
    # -------------------------------------------------------------
    fuzz_lengths = [0, 1, 2, 7, 15, 16, 31, 32, 33, 64, 127, 128, 512, 1024, 4096]

    for i in range(trials_buffer_fuzz):
        buf_len = fuzz_lengths[i % len(fuzz_lengths)]
        if buf_len == 0:
            raw_payload = b""
        else:
            pattern_type = i % 4
            if pattern_type == 0:
                raw_payload = secrets.token_bytes(buf_len)
            elif pattern_type == 1:
                raw_payload = b"\xff" * buf_len
            elif pattern_type == 2:
                raw_payload = b"\x00" * buf_len
            else:
                raw_payload = bytes((x % 256 for x in range(buf_len)))

        buf = SecureBuffer(raw_payload)

        # Invariant: Content matches raw payload before zeroing
        if bytes(buf.view()) != raw_payload:
            metrics.unauthorized_mutations += 1

        # Perform explicit zeroing
        buf.zero()

        # Invariant: is_zeroed must be True
        if not buf.is_zeroed:
            metrics.unauthorized_mutations += 1

        # Invariant: internal buffer is 100% 0x00
        if any(b != 0 for b in buf._buf):
            # Unauthorized mutation / failed zero-fill
            metrics.unauthorized_mutations += 1

        # Invariant: Post-zero view() access MUST raise ValueError (preventing memory disclosure)
        raised_value_error = False
        try:
            buf.view()
        except ValueError:
            raised_value_error = True
        except Exception:
            metrics.invariant_violations += 1

        if not raised_value_error:
            metrics.unauthorized_disclosures += 1

        # Type fuzzing: unsupported types must raise TypeError
        bad_type = [None, 3.1415, {"key": "val"}, [1, 2, 3]][i % 4]
        raised_type_error = False
        try:
            SecureBuffer(bad_type)  # type: ignore
        except TypeError:
            raised_type_error = True
        except Exception:
            pass

        if not raised_type_error:
            metrics.invariant_violations += 1

        metrics.trials_executed += 1

    # -------------------------------------------------------------
    # Invariant 2.2: Tampered Key Metadata & ID Fuzzing (600 trials)
    # -------------------------------------------------------------
    fuzz_ids = [
        "",  # empty
        "'; DROP TABLE sessions; --",  # SQL injection
        "' OR '1'='1' /*",
        "%s%s%x%n",  # format strings
        "{{7*7}}",  # template injection
        "\x00\x01\x02\x7f\xff",  # control bytes
        "🛡️🔑CHRONIS_EXPLOIT_TEST_🚀",  # unicode emoji
        "A" * 5000,  # buffer overflow attempt
        "../../../../etc/shadow",  # path traversal
    ]

    for i in range(trials_id_fuzz):
        fuzz_id = fuzz_ids[i % len(fuzz_ids)] + f"_{rng.getrandbits(24):06x}"
        key_material = SecureBuffer(secrets.token_bytes(32))
        issued_at = time.time() - rng.uniform(0, 3600)

        key = SessionKey(
            key_id=fuzz_id,
            material=key_material,
            issued_at=issued_at,
            ttl_seconds=24 * 3600,
        )

        # Invariant: Key is valid within 1 hour of issuance
        if key.is_expired():
            metrics.unauthorized_mutations += 1

        try:
            key.require_valid()
        except Exception:
            metrics.invariant_violations += 1

        # Clean up
        key.material.zero()
        metrics.trials_executed += 1

    # -------------------------------------------------------------
    # Invariant 2.3: Forged & Negative TTL / Tampered Timestamps (600 trials)
    # -------------------------------------------------------------
    for i in range(trials_ttl_fuzz):
        issued_at = time.time()
        # Fuzz TTL values: negative, zero, sub-microsecond, extreme
        scenario = i % 4
        if scenario == 0:
            # Negative TTL: Must expire immediately
            ttl = -rng.uniform(0.001, 86400.0)
            key = SessionKey("neg_ttl", SecureBuffer(secrets.token_bytes(32)), issued_at, ttl_seconds=ttl)
            if not key.is_expired(now=issued_at):
                metrics.unauthorized_disclosures += 1
            try:
                key.require_valid(now=issued_at)
                metrics.unauthorized_disclosures += 1  # Should have raised!
            except SessionKeyExpired:
                pass
        elif scenario == 1:
            # Zero TTL: Must expire immediately at any now > issued_at
            ttl = 0.0
            key = SessionKey("zero_ttl", SecureBuffer(secrets.token_bytes(32)), issued_at, ttl_seconds=ttl)
            test_now = issued_at + 0.000001
            if not key.is_expired(now=test_now):
                metrics.unauthorized_disclosures += 1
            try:
                key.require_valid(now=test_now)
                metrics.unauthorized_disclosures += 1
            except SessionKeyExpired:
                pass
        elif scenario == 2:
            # Expired timestamp (24h + delta)
            delta = rng.uniform(0.001, 100000.0)
            test_now = issued_at + 24 * 3600 + delta
            key = SessionKey("exp_key", SecureBuffer(secrets.token_bytes(32)), issued_at, ttl_seconds=24 * 3600)
            if not key.is_expired(now=test_now):
                metrics.unauthorized_disclosures += 1
            try:
                key.require_valid(now=test_now)
                metrics.unauthorized_disclosures += 1
            except SessionKeyExpired:
                pass
        else:
            # Distant future issued_at: clock skew test
            skewed_issued = issued_at + 100000.0
            key = SessionKey("future_key", SecureBuffer(secrets.token_bytes(32)), skewed_issued, ttl_seconds=24 * 3600)
            # Checked at current time, not expired because now < issued_at + ttl
            if key.is_expired(now=issued_at):
                metrics.unauthorized_mutations += 1

        key.material.zero()
        metrics.trials_executed += 1

    # -------------------------------------------------------------
    # Invariant 2.4: Session Key Replay & Lifecycle Teardown (600 trials)
    # -------------------------------------------------------------
    client = MockConstitutionalLayerClient()
    dev_runtime = LocalDevRuntime()
    container = IsolatedProcessingContainer(client, preferred_runtime=dev_runtime, allow_no_isolation=True)

    for i in range(trials_replay_fuzz):
        key = client.grant_session_key(purpose=f"replay_test_{i}")

        # Invariant: Fresh key is valid
        if key.is_expired():
            metrics.unauthorized_mutations += 1

        def decrypt_fn(k: SessionKey) -> bytes:
            return b"ephemeral_payload"

        res = container.process(decrypt_fn, lambda v: bytes(v))

        # Replay attempt: Ensure expired key cannot be validated
        past_time = key.issued_at + 24 * 3600 + rng.uniform(1.0, 100.0)
        if not key.is_expired(now=past_time):
            metrics.unauthorized_disclosures += 1
        try:
            key.require_valid(now=past_time)
            metrics.unauthorized_disclosures += 1
        except SessionKeyExpired:
            pass

        key.material.zero()
        metrics.trials_executed += 1

    metrics.elapsed_seconds = time.perf_counter() - t0
    metrics.passed = (
        metrics.unauthorized_disclosures == 0
        and metrics.unauthorized_mutations == 0
        and metrics.invariant_violations == 0
        and metrics.trials_executed == n_trials
    )
    metrics.details = {
        "buffer_fuzz_trials": trials_buffer_fuzz,
        "key_id_fuzz_trials": trials_id_fuzz,
        "ttl_fuzz_trials": trials_ttl_fuzz,
        "replay_fuzz_trials": trials_replay_fuzz,
    }
    return metrics


# =====================================================================
# DOMAIN 3: Boundary Timestamp Manipulation & Time Travel (2,500 Trials)
# =====================================================================

def run_domain_3_boundary_timestamp_manipulation(n_trials: int = 2500, seed: int = 20260908) -> DomainMetrics:
    """Execute 2,500 trials testing microsecond boundary conditions and clock manipulation."""
    rng = random.Random(seed)
    metrics = DomainMetrics(
        domain_id="D3",
        domain_name="Boundary Timestamp Manipulation & Time Travel",
        trials_allocated=n_trials,
    )
    t0 = time.perf_counter()

    trials_session_boundary = 900
    trials_bystander_boundary = 900
    trials_clock_travel = 700

    assert trials_session_boundary + trials_bystander_boundary + trials_clock_travel == n_trials

    # -------------------------------------------------------------
    # Invariant 3.1: Nanosecond Boundary on 24h SessionKey TTL (900 trials)
    # Specification: Expired strictly when now > issued_at + 86400
    # -------------------------------------------------------------
    base_issued = 1700000000.0
    ttl = 24 * 3600.0  # 86400.0s
    t_boundary = base_issued + ttl
    ulp_session = math.ulp(t_boundary)

    for i in range(trials_session_boundary):
        # Epsilon scaled by float64 ULP at 1.7e9 (~2.38e-7s), spanning 0.5us to 1.0s
        eps = ulp_session * rng.uniform(2.0, 4.0e6)
        key = SessionKey("boundary_key", SecureBuffer(secrets.token_bytes(32)), base_issued, ttl_seconds=ttl)

        mode = i % 3
        if mode == 0:
            # Just before boundary: now = t_boundary - eps -> MUST BE VALID
            now_test = t_boundary - eps
            if key.is_expired(now=now_test):
                metrics.unauthorized_mutations += 1
            try:
                key.require_valid(now=now_test)
            except Exception:
                metrics.unauthorized_mutations += 1
        elif mode == 1:
            # Exact boundary: now = t_boundary -> MUST BE VALID (since now > t_boundary is False)
            now_test = t_boundary
            if key.is_expired(now=now_test):
                metrics.unauthorized_mutations += 1
            try:
                key.require_valid(now=now_test)
            except Exception:
                metrics.unauthorized_mutations += 1
        else:
            # Just past boundary: now = t_boundary + eps -> MUST BE EXPIRED
            now_test = t_boundary + eps
            if not key.is_expired(now=now_test):
                # Unauthorized disclosure: expired key accepted
                metrics.unauthorized_disclosures += 1
            try:
                key.require_valid(now=now_test)
                # Failed to block expired key
                metrics.unauthorized_disclosures += 1
            except SessionKeyExpired:
                pass

        key.material.zero()
        metrics.trials_executed += 1

    # -------------------------------------------------------------
    # Invariant 3.2: Nanosecond Boundary on 30-Day Bystander Retention (900 trials)
    # Specification: Expired when (now - captured_at) >= 30 * 86400
    # Boundary at exactly 30 days IS expired
    # -------------------------------------------------------------
    base_captured = 1700000000.0
    retention = DEFAULT_RETENTION_SECONDS  # 2,592,000s
    t_ret_boundary = base_captured + retention
    ulp_bystander = math.ulp(t_ret_boundary)

    store_bnd = BystanderBiometricStore()

    for i in range(trials_bystander_boundary):
        eps = ulp_bystander * rng.uniform(2.0, 4.0e6)
        uid = f"bnd_user_{i}"
        rec = BystanderBiometricRecord(uid, secrets.token_bytes(16), base_captured)
        store_bnd.add(rec)

        mode = i % 3
        if mode == 0:
            # Just before boundary: now = t_ret_boundary - eps -> MUST BE ACTIVE
            now_test = t_ret_boundary - eps
            if rec.is_expired(now=now_test):
                metrics.unauthorized_mutations += 1
            res = store_bnd.get(uid, now=now_test)
            if res is None:
                metrics.unauthorized_mutations += 1
        elif mode == 1:
            # Exact boundary: now = t_ret_boundary -> MUST BE EXPIRED
            now_test = t_ret_boundary
            if not rec.is_expired(now=now_test):
                metrics.unauthorized_disclosures += 1
            res = store_bnd.get(uid, now=now_test)
            if res is not None:
                # Unauthorized disclosure at exact boundary
                metrics.unauthorized_disclosures += 1
        else:
            # Just past boundary: now = t_ret_boundary + eps -> MUST BE EXPIRED
            now_test = t_ret_boundary + eps
            if not rec.is_expired(now=now_test):
                metrics.unauthorized_disclosures += 1
            res = store_bnd.get(uid, now=now_test)
            if res is not None:
                metrics.unauthorized_disclosures += 1

        del store_bnd._records[uid]
        metrics.trials_executed += 1

    # -------------------------------------------------------------
    # Invariant 3.3: Clock Skew, Negative Time & Extreme Epochs (700 trials)
    # -------------------------------------------------------------
    for i in range(trials_clock_travel):
        issued = 1700000000.0
        key = SessionKey("clock_skew_key", SecureBuffer(secrets.token_bytes(32)), issued)

        test_scenario = i % 5
        if test_scenario == 0:
            # Retroactive time travel: clock jumped backwards (now < issued)
            skew_now = issued - rng.uniform(1.0, 100000.0)
            if key.is_expired(now=skew_now):
                metrics.unauthorized_mutations += 1
        elif test_scenario == 1:
            # Distant future: Year 3000 (now = 3.25e10)
            future_now = 3.25e10
            if not key.is_expired(now=future_now):
                metrics.unauthorized_disclosures += 1
            try:
                key.require_valid(now=future_now)
                metrics.unauthorized_disclosures += 1
            except SessionKeyExpired:
                pass
        elif test_scenario == 2:
            # Pre-epoch timestamp: issued before 1970 (issued = -1e8)
            pre_epoch_key = SessionKey("pre_epoch", SecureBuffer(secrets.token_bytes(32)), -100000000.0)
            if not pre_epoch_key.is_expired(now=issued):
                metrics.unauthorized_disclosures += 1
            pre_epoch_key.material.zero()
        elif test_scenario == 3:
            # IEEE 754 float infinity
            if not key.is_expired(now=float("inf")):
                metrics.unauthorized_disclosures += 1
            try:
                key.require_valid(now=float("inf"))
                metrics.unauthorized_disclosures += 1
            except SessionKeyExpired:
                pass
        else:
            # Monotonicity sequence test: As time increases, state never flips from expired -> valid
            t_seq = [issued + 86400.0 + (step * 10.0) for step in range(1, 10)]
            for t_step in t_seq:
                if not key.is_expired(now=t_step):
                    metrics.unauthorized_disclosures += 1

        key.material.zero()
        metrics.trials_executed += 1

    metrics.elapsed_seconds = time.perf_counter() - t0
    metrics.passed = (
        metrics.unauthorized_disclosures == 0
        and metrics.unauthorized_mutations == 0
        and metrics.invariant_violations == 0
        and metrics.trials_executed == n_trials
    )
    metrics.details = {
        "session_ttl_nanosecond_boundary_trials": trials_session_boundary,
        "bystander_retention_boundary_trials": trials_bystander_boundary,
        "clock_skew_and_epoch_trials": trials_clock_travel,
    }
    return metrics


# =====================================================================
# DOMAIN 4: Concurrent Races & Multi-Threaded Stress (2,500 Trials)
# =====================================================================

def run_domain_4_concurrent_races(n_trials: int = 2500, seed: int = 20260908) -> DomainMetrics:
    """Execute 2,500 trials under high concurrency testing race conditions."""
    metrics = DomainMetrics(
        domain_id="D4",
        domain_name="Concurrent Races & Multi-Threaded Stress",
        trials_allocated=n_trials,
    )
    t0 = time.perf_counter()

    trials_multistore_race = 1200
    trials_container_race = 800
    trials_buffer_race = 500

    assert trials_multistore_race + trials_container_race + trials_buffer_race == n_trials

    # -------------------------------------------------------------
    # Invariant 4.1: Concurrent Multi-Store Purge & Read Racing (1,200 trials)
    # -------------------------------------------------------------
    shared_store = BystanderBiometricStore()
    shared_index = InMemorySecondaryIndex("faiss_race_idx")
    shared_cache = InMemorySecondaryIndex("redis_race_cache")
    shared_store.register_alternate_store(shared_index)
    shared_store.register_alternate_store(shared_cache)

    num_workers = 8
    ops_per_worker = trials_multistore_race // num_workers

    disclosures_race = 0
    mutations_race = 0

    def worker_multistore_race(w_id: int, count: int) -> Tuple[int, int]:
        local_disc = 0
        local_mut = 0
        rng_local = random.Random(seed + w_id)
        now = time.time()

        for i in range(count):
            uid = f"race_w{w_id}_op{i}_{rng_local.getrandbits(24):06x}"
            is_expired = (i % 2 == 0)
            age = rng_local.uniform(31.0, 100.0) if is_expired else rng_local.uniform(1.0, 25.0)
            emb = secrets.token_bytes(16)

            rec = BystanderBiometricRecord(uid, emb, now - (age * DAY))
            shared_store.add(rec)
            shared_index.put(uid, emb)
            shared_cache.put(uid, emb)

            # Concurrent Read Check
            res = shared_store.get(uid, now=now)
            if is_expired and res is not None:
                local_disc += 1
            elif not is_expired and res is None:
                local_mut += 1

            # Interleaved cascade purge
            if i % 25 == 0:
                purged_list = shared_store.purge_expired(now=now)
                for p_uid in purged_list:
                    # Verify immediate unlinking in alternate stores
                    if shared_index.contains_speaker(p_uid) or shared_cache.contains_speaker(p_uid):
                        local_disc += 1

        return local_disc, local_mut

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
        futures = [executor.submit(worker_multistore_race, w, ops_per_worker) for w in range(num_workers)]
        for f in concurrent.futures.as_completed(futures):
            d, m = f.result()
            disclosures_race += d
            mutations_race += m

    metrics.unauthorized_disclosures += disclosures_race
    metrics.unauthorized_mutations += mutations_race
    metrics.trials_executed += trials_multistore_race

    # -------------------------------------------------------------
    # Invariant 4.2: High-Concurrency IsolatedProcessingContainer Execution (800 trials)
    # -------------------------------------------------------------
    client = MockConstitutionalLayerClient()
    container = IsolatedProcessingContainer(client, preferred_runtime=LocalDevRuntime(), allow_no_isolation=True)

    container_disclosures = 0
    container_mutations = 0
    workers_container = 8
    ops_container = trials_container_race // workers_container

    def worker_container_exec(w_id: int, count: int) -> Tuple[int, int]:
        local_d = 0
        local_m = 0
        for i in range(count):
            secret = secrets.token_bytes(32)
            expected_hash = hashlib.sha256(secret).digest()

            def dec_fn(k: SessionKey, s=secret):
                return s

            def proc_fn(buf: bytearray):
                # Verify buffer content is exact
                if bytes(buf) != secret:
                    return b"corrupted"
                return hashlib.sha256(buf).digest()

            res = container.process(dec_fn, proc_fn)
            if res.output != expected_hash:
                local_m += 1

        return local_d, local_m

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers_container) as executor:
        futures = [executor.submit(worker_container_exec, w, ops_container) for w in range(workers_container)]
        for f in concurrent.futures.as_completed(futures):
            d, m = f.result()
            container_disclosures += d
            container_mutations += m

    metrics.unauthorized_disclosures += container_disclosures
    metrics.unauthorized_mutations += container_mutations
    metrics.trials_executed += trials_container_race

    # -------------------------------------------------------------
    # Invariant 4.3: Simultaneous SecureBuffer View vs Zeroing Races (500 trials)
    # -------------------------------------------------------------
    import threading

    buffer_disclosures = 0
    buffer_mutations = 0

    for i in range(trials_buffer_race):
        secret = secrets.token_bytes(64)
        buf = SecureBuffer(secret)
        observed_bytes: List[Optional[bytes]] = []

        def reader():
            try:
                view = buf.view()
                observed_bytes.append(bytes(view))
            except ValueError:
                observed_bytes.append(None)

        def zeroer():
            buf.zero()

        t1 = threading.Thread(target=reader)
        t2 = threading.Thread(target=zeroer)
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        # After both complete, buf MUST be zeroed
        if not buf.is_zeroed:
            buffer_mutations += 1

        # If bytes were observed, they must be either secret OR all 0x00 (never corrupted garbage)
        if observed_bytes and observed_bytes[0] is not None:
            raw = observed_bytes[0]
            is_secret = (raw == secret)
            is_all_zero = all(b == 0 for b in raw)
            if not (is_secret or is_all_zero):
                buffer_disclosures += 1

        metrics.trials_executed += 1

    metrics.unauthorized_disclosures += buffer_disclosures
    metrics.unauthorized_mutations += buffer_mutations

    metrics.elapsed_seconds = time.perf_counter() - t0
    metrics.passed = (
        metrics.unauthorized_disclosures == 0
        and metrics.unauthorized_mutations == 0
        and metrics.invariant_violations == 0
        and metrics.trials_executed == n_trials
    )
    metrics.details = {
        "concurrent_multistore_operations": trials_multistore_race,
        "concurrent_container_operations": trials_container_race,
        "concurrent_buffer_racing_trials": trials_buffer_race,
        "active_worker_threads": num_workers,
    }
    return metrics


# =====================================================================
# MASTER ADVERSARIAL TEST RUNNER (10,000 Trials Aggregate)
# =====================================================================

def run_adversarial_suite(seed: int = 20260908) -> AdversarialSuiteReport:
    """Execute complete 10,000-trial adversarial property test suite."""
    report = AdversarialSuiteReport(
        timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        environment={
            "platform": platform.platform(),
            "python_version": sys.version.split()[0],
            "architecture": platform.machine(),
        },
    )

    print("=" * 80, flush=True)
    print("      CHRONIS SPRINT 16: 10,000-TRIAL ADVERSARIAL PROPERTY TEST SUITE      ", flush=True)
    print("      RULE 4 MANDATE: ZERO UNAUTHORIZED DISCLOSURES / MUTATIONS            ", flush=True)
    print("=" * 80, flush=True)

    t_start = time.perf_counter()

    # Domain 1
    print("\n[+] Executing Domain 1: Cross-User Data Leakage & Memory Isolation (2,500 trials)...", flush=True)
    d1 = run_domain_1_cross_user_isolation(n_trials=2500, seed=seed)
    report.domains["D1"] = d1
    print(f"    -> D1 Completed in {d1.elapsed_seconds:.3f}s: Disclosures={d1.unauthorized_disclosures}, Mutations={d1.unauthorized_mutations} ({'PASS' if d1.passed else 'FAIL'})", flush=True)

    # Domain 2
    print("\n[+] Executing Domain 2: Malformed Session Keys & Fuzz Invariants (2,500 trials)...", flush=True)
    d2 = run_domain_2_malformed_session_keys(n_trials=2500, seed=seed + 1)
    report.domains["D2"] = d2
    print(f"    -> D2 Completed in {d2.elapsed_seconds:.3f}s: Disclosures={d2.unauthorized_disclosures}, Mutations={d2.unauthorized_mutations} ({'PASS' if d2.passed else 'FAIL'})", flush=True)

    # Domain 3
    print("\n[+] Executing Domain 3: Boundary Timestamp Manipulation & Time Travel (2,500 trials)...", flush=True)
    d3 = run_domain_3_boundary_timestamp_manipulation(n_trials=2500, seed=seed + 2)
    report.domains["D3"] = d3
    print(f"    -> D3 Completed in {d3.elapsed_seconds:.3f}s: Disclosures={d3.unauthorized_disclosures}, Mutations={d3.unauthorized_mutations} ({'PASS' if d3.passed else 'FAIL'})", flush=True)

    # Domain 4
    print("\n[+] Executing Domain 4: Concurrent Races & Multi-Threaded Stress (2,500 trials)...", flush=True)
    d4 = run_domain_4_concurrent_races(n_trials=2500, seed=seed + 3)
    report.domains["D4"] = d4
    print(f"    -> D4 Completed in {d4.elapsed_seconds:.3f}s: Disclosures={d4.unauthorized_disclosures}, Mutations={d4.unauthorized_mutations} ({'PASS' if d4.passed else 'FAIL'})", flush=True)

    t_total = time.perf_counter() - t_start

    # Aggregate metrics
    report.total_executed = sum(d.trials_executed for d in report.domains.values())
    report.total_unauthorized_disclosures = sum(d.unauthorized_disclosures for d in report.domains.values())
    report.total_unauthorized_mutations = sum(d.unauthorized_mutations for d in report.domains.values())
    report.total_invariant_violations = sum(d.invariant_violations for d in report.domains.values())
    report.total_elapsed_seconds = t_total
    report.rule_4_compliant = (
        report.total_unauthorized_disclosures == 0
        and report.total_unauthorized_mutations == 0
        and report.total_invariant_violations == 0
        and report.total_executed == 10000
    )

    # Save JSON artifact
    json_path = Path(__file__).resolve().parents[1] / "sprint16_adversarial_report.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report.to_dict(), f, indent=2)

    print("\n" + "=" * 80, flush=True)
    print("                    ADVERSARIAL SUITE EXECUTION SUMMARY                    ", flush=True)
    print("=" * 80, flush=True)
    print(f" Total Trials Executed:       {report.total_executed:,} / {report.total_trials:,}", flush=True)
    print(f" Unauthorized Disclosures:   {report.total_unauthorized_disclosures} (Rule 4 Mandate: 0)", flush=True)
    print(f" Unauthorized Mutations:     {report.total_unauthorized_mutations} (Rule 4 Mandate: 0)", flush=True)
    print(f" Invariant Violations:       {report.total_invariant_violations}", flush=True)
    print(f" Total Execution Time:       {report.total_elapsed_seconds:.3f} seconds", flush=True)
    print(f" Throughput:                 {report.total_executed / report.total_elapsed_seconds:,.0f} trials/second", flush=True)
    print(f" Rule 4 Compliance Status:   {'VERIFIED - 100% COMPLIANT' if report.rule_4_compliant else 'FAILED'}", flush=True)
    print(f" Report Artifact Saved:      {json_path.name}", flush=True)
    print("=" * 80, flush=True)

    return report


# =====================================================================
# UNITTEST INTEGRATION
# =====================================================================

class TestAdversarialSuite(unittest.TestCase):
    """Unittest wrapper exposing each domain as an individual test fixture."""
    _domain_results: Dict[str, DomainMetrics] = {}

    def test_domain_1_cross_user_isolation(self):
        """Domain 1: 2,500 trials testing cross-user isolation and memory bleed."""
        metrics = run_domain_1_cross_user_isolation(n_trials=2500)
        self.__class__._domain_results["D1"] = metrics
        self.assertEqual(metrics.unauthorized_disclosures, 0, "Disclosures detected in Domain 1")
        self.assertEqual(metrics.unauthorized_mutations, 0, "Mutations detected in Domain 1")
        self.assertEqual(metrics.invariant_violations, 0, "Invariant violations in Domain 1")
        self.assertTrue(metrics.passed)

    def test_domain_2_malformed_session_keys(self):
        """Domain 2: 2,500 trials fuzzing session keys and secure buffers."""
        metrics = run_domain_2_malformed_session_keys(n_trials=2500)
        self.__class__._domain_results["D2"] = metrics
        self.assertEqual(metrics.unauthorized_disclosures, 0, "Disclosures detected in Domain 2")
        self.assertEqual(metrics.unauthorized_mutations, 0, "Mutations detected in Domain 2")
        self.assertEqual(metrics.invariant_violations, 0, "Invariant violations in Domain 2")
        self.assertTrue(metrics.passed)

    def test_domain_3_boundary_timestamp_manipulation(self):
        """Domain 3: 2,500 trials testing microsecond boundaries and clock skew."""
        metrics = run_domain_3_boundary_timestamp_manipulation(n_trials=2500)
        self.__class__._domain_results["D3"] = metrics
        self.assertEqual(metrics.unauthorized_disclosures, 0, "Disclosures detected in Domain 3")
        self.assertEqual(metrics.unauthorized_mutations, 0, "Mutations detected in Domain 3")
        self.assertEqual(metrics.invariant_violations, 0, "Invariant violations in Domain 3")
        self.assertTrue(metrics.passed)

    def test_domain_4_concurrent_races(self):
        """Domain 4: 2,500 trials testing concurrent multi-store races and container execution."""
        metrics = run_domain_4_concurrent_races(n_trials=2500)
        self.__class__._domain_results["D4"] = metrics
        self.assertEqual(metrics.unauthorized_disclosures, 0, "Disclosures detected in Domain 4")
        self.assertEqual(metrics.unauthorized_mutations, 0, "Mutations detected in Domain 4")
        self.assertEqual(metrics.invariant_violations, 0, "Invariant violations in Domain 4")
        self.assertTrue(metrics.passed)

    def test_rule_4_zero_leakage_master_verification(self):
        """Rule 4: Master invariant verifying exactly 0 disclosures and 0 mutations across all domains."""
        # Check if all 4 domains have already run in this test session
        if len(self.__class__._domain_results) == 4:
            total_trials = sum(m.trials_executed for m in self.__class__._domain_results.values())
            total_disclosures = sum(m.unauthorized_disclosures for m in self.__class__._domain_results.values())
            total_mutations = sum(m.unauthorized_mutations for m in self.__class__._domain_results.values())
        else:
            report = run_adversarial_suite()
            total_trials = report.total_executed
            total_disclosures = report.total_unauthorized_disclosures
            total_mutations = report.total_unauthorized_mutations

        self.assertEqual(total_trials, 10000, f"Expected 10,000 trials, got {total_trials}")
        self.assertEqual(total_disclosures, 0, "Rule 4 violation: unauthorized disclosure detected")
        self.assertEqual(total_mutations, 0, "Rule 4 violation: unauthorized mutation detected")


if __name__ == "__main__":
    report = run_adversarial_suite()
    if not report.rule_4_compliant:
        sys.exit(1)
    sys.exit(0)
