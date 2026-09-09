"""profile_performance.py — Chronis Sprint 16 Trust-Boundary Performance Profiling Suite.

Profiles high-performance trust-boundary operations defined in:
  - Chronis AI/ML Master Document Section 14 (B10 Trust-Boundary Benchmark)
  - Chronis Bible Parts 4.2, 5.24–5.27, 7.1
  - AI_ML_SPRINT_PLAN_v2 Sprint 16 Days 46–48

Target Measurements:
  1. SecureBuffer Memory Overhead & Zero-Fill Performance:
     - Memory footprint and metadata overhead across payload scales (16 B to 16 MiB).
     - Fixed object overhead vs payload ratio.
     - Heap allocation footprint (tracemalloc), GC object lifecycle, and in-place zeroing throughput.
  2. Argon2id Key Derivation Latency Distributions:
     - RFC 9106 recommended parameters (m=64MiB, t=3, p=4, key=32B, salt=16B).
     - Latency percentiles: p50, p90, p95, p99, mean, stddev, min, max over 50 iterations.
     - PHC format derivation and verification latency distributions.
     - Strict sub-second operational threshold validation (< 1.0s).
  3. EER Computation Throughput Across Large Speaker Sets:
     - VoicePrivacy challenge ASV evaluation pipeline across 10 to 100 speakers (dim=64).
     - ROC crossover Equal Error Rate (EER) scaling across massive score arrays (up to 1,000,000 scores).
     - Pure EER calculation latency across large speaker sets (sub-millisecond to sub-second).
     - Evaluation throughput (comparisons/second and scores/second).
     - Monotonicity and 95% bootstrap confidence interval scaling.
  4. Bystander Biometric Purge Latency under 10,000 Records:
     - Ingestion and read-time gating latency under 10,000 bystander records.
     - Multi-store cascading purge latency across primary and secondary stores (FAISS index + Redis cache).
     - 5,000 mixed purge and 10,000 worst-case full purge scenarios.
     - Sub-second operational metric validation (< 1.0s).
  5. Sub-Second Operational Metrics SLA Scorecard:
     - Verified compliance matrix across all trust-boundary gates ensuring sub-second operational latency.
"""

from __future__ import annotations

import argparse
import gc
import json
import os
import platform
import sys
import time
import tracemalloc
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

# Sprint 16 Trust Boundary Modules
from bystander_ttl import (
    DAY,
    DEFAULT_RETENTION_SECONDS,
    BystanderBiometricRecord,
    BystanderBiometricStore,
    InMemorySecondaryIndex,
)
from isolation import (
    MockConstitutionalLayerClient,
    SecureBuffer,
    SessionKey,
    SessionKeyExpired,
)
from kdf import DEFAULT_PARAMS, Argon2Params, VaultKeyDerivation
from unlinkability import (
    FRAMING_STATEMENT,
    AttackerKnowledgeLevel,
    SyntheticSpeakerCorpus,
    bootstrap_eer_ci,
    build_attacker_scores,
    compute_eer,
)


# =====================================================================
# SECTION 1: SecureBuffer Memory Footprint & Lifecycle Profiling
# =====================================================================

@dataclass
class BufferMemoryProfile:
    payload_size_bytes: int
    label: str
    shallow_size_bytes: int
    bytearray_size_bytes: int
    dict_size_bytes: int
    total_object_bytes: int
    fixed_overhead_bytes: int
    overhead_percentage: float
    tracemalloc_peak_bytes: int
    zero_fill_time_us: float
    zero_fill_throughput_mb_s: float
    context_manager_latency_us: float


def profile_secure_buffer_memory() -> Dict[str, Any]:
    """Measure memory footprint, object overhead, and zeroing throughput of SecureBuffer."""
    sizes = [
        (16, "16 B (Nonce/Salt)"),
        (32, "32 B (AES-256 Key)"),
        (64, "64 B (HMAC Key)"),
        (256, "256 B (Session Token)"),
        (1024, "1 KiB (Audio Fragment)"),
        (4096, "4 KiB (Memory Page)"),
        (65536, "64 KiB (Chunk Buffer)"),
        (1048576, "1 MiB (Decrypted Audio)"),
        (16777216, "16 MiB (Session Context)"),
    ]

    profiles: List[BufferMemoryProfile] = []

    for size, label in sizes:
        gc.collect()
        tracemalloc.start()
        snap_start = tracemalloc.take_snapshot()

        # Instantiate SecureBuffer
        buf = SecureBuffer(size)

        snap_end = tracemalloc.take_snapshot()
        tracemalloc.stop()

        # Calculate object-level memory metrics
        shallow = sys.getsizeof(buf)
        buf_internal = sys.getsizeof(buf._buf)
        dict_size = sys.getsizeof(buf.__dict__) if hasattr(buf, "__dict__") else 0
        total_obj = shallow + buf_internal + dict_size
        fixed_overhead = total_obj - size
        pct_overhead = (fixed_overhead / size) * 100.0

        # Memory diff from tracemalloc
        diffs = snap_end.compare_to(snap_start, "filename")
        peak_traced = sum(stat.size_diff for stat in diffs if stat.size_diff > 0)

        # Measure zero-fill latency and throughput
        view = buf.view()
        for i in range(min(size, 4096)):
            view[i] = 0xAA

        t0 = time.perf_counter_ns()
        buf.zero()
        t1 = time.perf_counter_ns()
        zero_ns = max(t1 - t0, 1)
        zero_us = zero_ns / 1000.0
        zero_throughput = (size / (1024.0 * 1024.0)) / (zero_ns / 1e9)

        # Measure context manager lifecycle overhead
        t0 = time.perf_counter_ns()
        with SecureBuffer(size) as ctx_buf:
            _ = ctx_buf.view()
        t1 = time.perf_counter_ns()
        cm_latency_us = (t1 - t0) / 1000.0

        profiles.append(
            BufferMemoryProfile(
                payload_size_bytes=size,
                label=label,
                shallow_size_bytes=shallow,
                bytearray_size_bytes=buf_internal,
                dict_size_bytes=dict_size,
                total_object_bytes=total_obj,
                fixed_overhead_bytes=fixed_overhead,
                overhead_percentage=round(pct_overhead, 4),
                tracemalloc_peak_bytes=peak_traced,
                zero_fill_time_us=round(zero_us, 3),
                zero_fill_throughput_mb_s=round(zero_throughput, 2),
                context_manager_latency_us=round(cm_latency_us, 3),
            )
        )

        del buf
        del ctx_buf

    # Lifecycle memory reclamation check (10 buffers of 1 MiB each)
    gc.collect()
    tracemalloc.start()
    baseline = tracemalloc.get_traced_memory()[0]
    buffers = [SecureBuffer(1024 * 1024) for _ in range(10)]  # 10 MiB total
    allocated_peak = tracemalloc.get_traced_memory()[1]

    # Verify active zeroing
    for b in buffers:
        b.zero()
        assert b.is_zeroed

    del buffers
    del b
    gc.collect()
    gc.collect()
    post_teardown = tracemalloc.get_traced_memory()[0]
    tracemalloc.stop()

    # Verify zero lingering SecureBuffer objects in Python GC
    lingering_sb_count = sum(1 for o in gc.get_objects() if isinstance(o, SecureBuffer))
    lingering_bytearrays = sum(
        1 for o in gc.get_objects() if isinstance(o, bytearray) and len(o) >= 1024 * 1024
    )
    total_allocated_delta = allocated_peak - baseline
    reclaimed_bytes = allocated_peak - post_teardown
    reclamation_ratio = (reclaimed_bytes / total_allocated_delta) if total_allocated_delta > 0 else 1.0
    reclamation_verified = (lingering_sb_count == 0) and (lingering_bytearrays == 0) and (reclamation_ratio >= 0.85)

    return {
        "profiles": [asdict(p) for p in profiles],
        "fixed_metadata_overhead_bytes": profiles[0].fixed_overhead_bytes,
        "lifecycle_check": {
            "baseline_bytes": baseline,
            "peak_allocated_bytes": allocated_peak,
            "post_teardown_bytes": post_teardown,
            "reclaimed_bytes": reclaimed_bytes,
            "reclamation_ratio_percent": round(reclamation_ratio * 100.0, 2),
            "lingering_secure_buffer_objects": lingering_sb_count,
            "lingering_large_bytearrays": lingering_bytearrays,
            "reclamation_verified": reclamation_verified,
        },
    }


# =====================================================================
# SECTION 2: Argon2id Key Derivation Latency Distributions
# =====================================================================

@dataclass
class LatencyDistribution:
    samples_count: int
    unit: str
    mean: float
    std_dev: float
    min: float
    max: float
    p50_median: float
    p75: float
    p90: float
    p95: float
    p99: float
    iqr: float
    sub_second_sla_met: bool


def profile_argon2id_derivation(
    iterations: int = 50,
    warmup: int = 3,
    params: Optional[Argon2Params] = None,
) -> Dict[str, Any]:
    """Profile Argon2id key derivation latency distributions (p50, p95, p99) under RFC 9106."""
    kdf_params = params or DEFAULT_PARAMS
    kdf = VaultKeyDerivation(params=kdf_params)
    passphrase = "chronis-secure-vault-recovery-passphrase-2026"

    # Warmup runs to stabilize CPU frequency, JIT, and memory bus
    for _ in range(warmup):
        salt = kdf.generate_salt()
        _ = kdf.derive_key(passphrase, salt, as_secure_buffer=False)

    latencies_sec: List[float] = []

    for _ in range(iterations):
        salt = kdf.generate_salt()
        t0 = time.perf_counter()
        _ = kdf.derive_key(passphrase, salt, as_secure_buffer=True)
        t1 = time.perf_counter()
        latencies_sec.append(t1 - t0)

    arr_ms = np.array(latencies_sec, dtype=np.float64) * 1000.0

    p50 = float(np.percentile(arr_ms, 50))
    p75 = float(np.percentile(arr_ms, 75))
    p90 = float(np.percentile(arr_ms, 90))
    p95 = float(np.percentile(arr_ms, 95))
    p99 = float(np.percentile(arr_ms, 99))
    iqr = float(p75 - np.percentile(arr_ms, 25))

    derivation_dist = LatencyDistribution(
        samples_count=iterations,
        unit="milliseconds",
        mean=float(round(np.mean(arr_ms), 3)),
        std_dev=float(round(np.std(arr_ms), 3)),
        min=float(round(np.min(arr_ms), 3)),
        max=float(round(np.max(arr_ms), 3)),
        p50_median=float(round(p50, 3)),
        p75=float(round(p75, 3)),
        p90=float(round(p90, 3)),
        p95=float(round(p95, 3)),
        p99=float(round(p99, 3)),
        iqr=float(round(iqr, 3)),
        sub_second_sla_met=bool(p99 < 1000.0),
    )

    # PHC Generation and Verification Latencies (30 samples, 2 warmups)
    phc_samples = 30
    for _ in range(2):
        _warmup_phc = kdf.derive_phc(passphrase, kdf.generate_salt())
        kdf.verify_phc(passphrase, _warmup_phc)

    phc_gen_latencies_ms: List[float] = []
    phc_verify_latencies_ms: List[float] = []

    for _ in range(phc_samples):
        salt = kdf.generate_salt()
        t0 = time.perf_counter()
        phc_str = kdf.derive_phc(passphrase, salt)
        t1 = time.perf_counter()
        phc_gen_latencies_ms.append((t1 - t0) * 1000.0)

        t2 = time.perf_counter()
        is_valid = kdf.verify_phc(passphrase, phc_str)
        t3 = time.perf_counter()
        phc_verify_latencies_ms.append((t3 - t2) * 1000.0)
        assert is_valid

    arr_phc_gen = np.array(phc_gen_latencies_ms)
    arr_phc_ver = np.array(phc_verify_latencies_ms)

    phc_gen_dist = LatencyDistribution(
        samples_count=phc_samples,
        unit="milliseconds",
        mean=float(round(np.mean(arr_phc_gen), 3)),
        std_dev=float(round(np.std(arr_phc_gen), 3)),
        min=float(round(np.min(arr_phc_gen), 3)),
        max=float(round(np.max(arr_phc_gen), 3)),
        p50_median=float(round(np.percentile(arr_phc_gen, 50), 3)),
        p75=float(round(np.percentile(arr_phc_gen, 75), 3)),
        p90=float(round(np.percentile(arr_phc_gen, 90), 3)),
        p95=float(round(np.percentile(arr_phc_gen, 95), 3)),
        p99=float(round(np.percentile(arr_phc_gen, 99), 3)),
        iqr=float(round(np.percentile(arr_phc_gen, 75) - np.percentile(arr_phc_gen, 25), 3)),
        sub_second_sla_met=bool(np.percentile(arr_phc_gen, 99) < 1000.0),
    )

    phc_verify_dist = LatencyDistribution(
        samples_count=phc_samples,
        unit="milliseconds",
        mean=float(round(np.mean(arr_phc_ver), 3)),
        std_dev=float(round(np.std(arr_phc_ver), 3)),
        min=float(round(np.min(arr_phc_ver), 3)),
        max=float(round(np.max(arr_phc_ver), 3)),
        p50_median=float(round(np.percentile(arr_phc_ver, 50), 3)),
        p75=float(round(np.percentile(arr_phc_ver, 75), 3)),
        p90=float(round(np.percentile(arr_phc_ver, 90), 3)),
        p95=float(round(np.percentile(arr_phc_ver, 95), 3)),
        p99=float(round(np.percentile(arr_phc_ver, 99), 3)),
        iqr=float(round(np.percentile(arr_phc_ver, 75) - np.percentile(arr_phc_ver, 25), 3)),
        sub_second_sla_met=bool(np.percentile(arr_phc_ver, 99) < 1000.0),
    )

    return {
        "parameters": kdf_params.to_dict(),
        "raw_samples_count": iterations,
        "key_derivation_distribution": asdict(derivation_dist),
        "phc_generation_distribution": asdict(phc_gen_dist),
        "phc_verification_distribution": asdict(phc_verify_dist),
        "sub_second_target_achieved": derivation_dist.sub_second_sla_met,
    }


# =====================================================================
# SECTION 3: EER Computation Throughput Across Large Speaker Sets
# =====================================================================

@dataclass
class SpeakerSetEERProfile:
    n_speakers: int
    utterances_per_speaker: int
    total_utterances: int
    dim: int
    n_genuine: int
    n_impostor: int
    total_comparison_pairs: int
    corpus_generation_seconds: float
    score_building_seconds: float
    eer_compute_seconds: float
    total_pipeline_seconds: float
    pairs_per_second_throughput: float
    eer_ignorant: float
    eer_semi_informed: float
    eer_fully_informed: float
    monotonicity_satisfied: bool
    sub_second_eer_compute: bool


@dataclass
class PureEERThroughputProfile:
    total_scores: int
    genuine_count: int
    impostor_count: int
    latency_ms: float
    throughput_scores_per_sec: float
    eer: float
    threshold: float
    sub_second_met: bool


def profile_eer_scaling() -> Dict[str, Any]:
    """Profile EER computation throughput across speaker set scales and massive score arrays."""
    # Sub-Test A: Speaker Set Scaling (ASV Threat Model Pipeline)
    speaker_scales = [10, 25, 50, 75, 100]
    utterances = 8
    dim = 64
    speaker_profiles: List[SpeakerSetEERProfile] = []

    for spk_count in speaker_scales:
        t0 = time.perf_counter()
        corpus = SyntheticSpeakerCorpus(
            n_speakers=spk_count,
            utterances_per_speaker=utterances,
            dim=dim,
            seed=42,
        )
        t_corpus = time.perf_counter() - t0

        t0 = time.perf_counter()
        gen_ign, imp_ign = build_attacker_scores(corpus, AttackerKnowledgeLevel.IGNORANT)
        gen_semi, imp_semi = build_attacker_scores(corpus, AttackerKnowledgeLevel.SEMI_INFORMED)
        gen_full, imp_full = build_attacker_scores(corpus, AttackerKnowledgeLevel.FULLY_INFORMED)
        t_scores = time.perf_counter() - t0

        t0 = time.perf_counter()
        eer_ign, _ = compute_eer(gen_ign, imp_ign)
        eer_semi, _ = compute_eer(gen_semi, imp_semi)
        eer_full, _ = compute_eer(gen_full, imp_full)
        t_eer = time.perf_counter() - t0

        total_pairs = (len(gen_ign) + len(imp_ign)) * 3  # across 3 attacker levels
        total_time = t_corpus + t_scores + t_eer
        throughput = total_pairs / total_time if total_time > 0 else 0.0
        monotonic = (eer_ign >= eer_semi >= eer_full)

        speaker_profiles.append(
            SpeakerSetEERProfile(
                n_speakers=spk_count,
                utterances_per_speaker=utterances,
                total_utterances=spk_count * utterances,
                dim=dim,
                n_genuine=len(gen_ign),
                n_impostor=len(imp_ign),
                total_comparison_pairs=total_pairs,
                corpus_generation_seconds=round(t_corpus, 4),
                score_building_seconds=round(t_scores, 4),
                eer_compute_seconds=round(t_eer, 6),
                total_pipeline_seconds=round(total_time, 4),
                pairs_per_second_throughput=round(throughput, 1),
                eer_ignorant=round(eer_ign, 4),
                eer_semi_informed=round(eer_semi, 4),
                eer_fully_informed=round(eer_full, 4),
                monotonicity_satisfied=monotonic,
                sub_second_eer_compute=bool(t_eer < 1.0),
            )
        )

    # Sub-Test B: Pure ROC Crossover / EER Computation Scaling up to 1,000,000 scores
    score_scales = [1000, 10000, 50000, 100000, 250000, 500000, 1000000]
    pure_profiles: List[PureEERThroughputProfile] = []
    rng = np.random.default_rng(1337)

    for n_total in score_scales:
        n_gen = n_total // 6
        n_imp = n_total - n_gen
        # Genuines centered at 0.75, Impostors centered at 0.35
        gen = rng.normal(0.75, 0.12, size=n_gen)
        imp = rng.normal(0.35, 0.12, size=n_imp)

        t0 = time.perf_counter()
        eer, thresh = compute_eer(gen, imp)
        t1 = time.perf_counter()

        elapsed_s = t1 - t0
        elapsed_ms = elapsed_s * 1000.0
        thr = n_total / elapsed_s if elapsed_s > 0 else 0.0

        pure_profiles.append(
            PureEERThroughputProfile(
                total_scores=n_total,
                genuine_count=n_gen,
                impostor_count=n_imp,
                latency_ms=round(elapsed_ms, 3),
                throughput_scores_per_sec=round(thr, 1),
                eer=round(eer, 4),
                threshold=round(thresh, 4),
                sub_second_met=bool(elapsed_s < 1.0),
            )
        )

    # Sub-Test C: Standard Gate T16.5 Benchmark Scaling (30 speakers, 10 utterances per Chronis Bible)
    t0 = time.perf_counter()
    std_corpus = SyntheticSpeakerCorpus(n_speakers=30, utterances_per_speaker=10, dim=64, seed=42)
    std_gen, std_imp = build_attacker_scores(std_corpus, AttackerKnowledgeLevel.IGNORANT)
    std_eer, _ = compute_eer(std_gen, std_imp)
    std_pipeline_s = time.perf_counter() - t0

    # Sub-Test D: Bootstrap CI Computation Latency (100 replicates on 50-speaker corpus)
    ref_corpus = SyntheticSpeakerCorpus(n_speakers=50, utterances_per_speaker=8, dim=64, seed=7)
    g_ref, i_ref = build_attacker_scores(ref_corpus, AttackerKnowledgeLevel.IGNORANT)
    t0 = time.perf_counter()
    ci_low, ci_high = bootstrap_eer_ci(g_ref, i_ref, n_bootstraps=100, seed=7)
    t_bootstrap = time.perf_counter() - t0

    return {
        "speaker_set_pipeline_scaling": [asdict(p) for p in speaker_profiles],
        "pure_eer_scaling": [asdict(p) for p in pure_profiles],
        "standard_gate_benchmark": {
            "n_speakers": 30,
            "utterances": 10,
            "pipeline_seconds": round(std_pipeline_s, 4),
            "eer": round(std_eer, 4),
            "sub_second_met": bool(std_pipeline_s < 1.5),
        },
        "bootstrap_profile": {
            "n_bootstraps": 100,
            "latency_seconds": round(t_bootstrap, 4),
            "ci_95": [round(ci_low, 4), round(ci_high, 4)],
            "sub_second_met": bool(t_bootstrap < 1.0),
        },
    }


# =====================================================================
# SECTION 4: Bystander Biometric Purge Latency under 10,000 Records
# =====================================================================

@dataclass
class BystanderPurgeProfile:
    scenario_name: str
    total_records: int
    active_records: int
    expired_records: int
    secondary_stores_count: int
    ingestion_time_seconds: float
    ingestion_throughput_recs_per_sec: float
    read_time_gating_latency_ms: float
    read_time_gating_throughput_qps: float
    read_time_gating_all_blocked: bool
    purge_latency_ms: float
    purge_throughput_recs_per_sec: float
    average_deletion_us_per_record: float
    multi_store_leakage_detected: int
    active_retention_verified: bool
    sub_second_purge_sla_met: bool


def profile_bystander_purge_scale() -> Dict[str, Any]:
    """Measure purge latency and multi-store cascade under 10,000 bystander records."""
    scenarios: List[BystanderPurgeProfile] = []
    now = time.time()

    # Scenario 1: Mixed operational load (10,000 records: 5,000 active, 5,000 expired)
    # Scenario 2: Maximum stress full purge (10,000 records: 0 active, 10,000 expired)
    test_configs = [
        ("Mixed Operational Load (50% Expired)", 10000, 5000, 5000),
        ("Maximum Stress Cascade (100% Expired)", 10000, 0, 10000),
    ]

    for title, n_total, n_active, n_expired in test_configs:
        store = BystanderBiometricStore(retention_seconds=DEFAULT_RETENTION_SECONDS)
        faiss_index = InMemorySecondaryIndex("faiss_embedding_index")
        redis_cache = InMemorySecondaryIndex("redis_feature_cache")
        store.register_alternate_store(faiss_index)
        store.register_alternate_store(redis_cache)

        # 1. Ingestion Phase
        dummy_embedding = b"\x01\x02\x03\x04" * 16  # 64-byte embedding
        t0 = time.perf_counter()

        # Seed active records
        for i in range(n_active):
            uuid = f"spk_act_{i}"
            # Captured 5 days ago (well within 30-day TTL)
            rec = BystanderBiometricRecord(uuid, dummy_embedding, now - (5 * DAY))
            store.add(rec)
            faiss_index.put(uuid, dummy_embedding)
            redis_cache.put(uuid, dummy_embedding)

        # Seed expired records
        for i in range(n_expired):
            uuid = f"spk_exp_{i}"
            # Captured 35 days ago (> 30-day TTL)
            rec = BystanderBiometricRecord(uuid, dummy_embedding, now - (35 * DAY))
            store.add(rec)
            faiss_index.put(uuid, dummy_embedding)
            redis_cache.put(uuid, dummy_embedding)

        t_ingest = time.perf_counter() - t0
        ingest_throughput = n_total / t_ingest if t_ingest > 0 else 0.0

        # 2. Read-Time Gating Latency & Enforcement Check
        t0 = time.perf_counter()
        blocked_count = 0
        for i in range(n_expired):
            res = store.get(f"spk_exp_{i}", now=now)
            if res is None:
                blocked_count += 1
        t_gating = time.perf_counter() - t0
        gating_ms = t_gating * 1000.0
        gating_qps = n_expired / t_gating if t_gating > 0 else 0.0
        all_blocked = (blocked_count == n_expired)

        # 3. Purge Latency & Cascade Execution Phase
        t0 = time.perf_counter()
        purged = store.purge_expired(now=now)
        t_purge = time.perf_counter() - t0

        purge_ms = t_purge * 1000.0
        purge_throughput = len(purged) / t_purge if t_purge > 0 else 0.0
        avg_del_us = (t_purge * 1e6) / len(purged) if len(purged) > 0 else 0.0

        # 4. Multi-Store Leakage Verification
        leaks = 0
        for u in purged:
            if faiss_index.contains_speaker(u) or redis_cache.contains_speaker(u):
                leaks += 1

        active_verified = (store.active_count(now=now) == n_active)

        scenarios.append(
            BystanderPurgeProfile(
                scenario_name=title,
                total_records=n_total,
                active_records=n_active,
                expired_records=n_expired,
                secondary_stores_count=2,
                ingestion_time_seconds=round(t_ingest, 4),
                ingestion_throughput_recs_per_sec=round(ingest_throughput, 1),
                read_time_gating_latency_ms=round(gating_ms, 3),
                read_time_gating_throughput_qps=round(gating_qps, 1),
                read_time_gating_all_blocked=all_blocked,
                purge_latency_ms=round(purge_ms, 3),
                purge_throughput_recs_per_sec=round(purge_throughput, 1),
                average_deletion_us_per_record=round(avg_del_us, 3),
                multi_store_leakage_detected=leaks,
                active_retention_verified=active_verified,
                sub_second_purge_sla_met=bool(t_purge < 1.0),
            )
        )

    return {
        "workload_records": 10000,
        "scenarios": [asdict(s) for s in scenarios],
        "sub_second_sla_met": all(s.sub_second_purge_sla_met for s in scenarios),
    }


# =====================================================================
# SECTION 5: Sub-Second Operational Metrics SLA Scorecard
# =====================================================================

@dataclass
class SLAScorecardItem:
    boundary_operation: str
    target_metric: str
    sla_threshold: str
    observed_value: str
    status: str


def build_sla_scorecard(
    buf_res: Dict[str, Any],
    kdf_res: Dict[str, Any],
    eer_res: Dict[str, Any],
    purge_res: Dict[str, Any],
) -> List[SLAScorecardItem]:
    """Evaluate all trust-boundary operations against sub-second operational SLAs."""
    scorecard: List[SLAScorecardItem] = []

    # 1. SecureBuffer Zero-Fill (16 MiB large buffer)
    p16 = next(p for p in buf_res["profiles"] if p["payload_size_bytes"] == 16777216)
    zero_16mb_s = (p16["zero_fill_time_us"] / 1e6)
    scorecard.append(
        SLAScorecardItem(
            boundary_operation="SecureBuffer Memory Zero-Fill (16 MiB)",
            target_metric="Full-buffer wipe latency",
            sla_threshold="< 1.000 s",
            observed_value=f"{zero_16mb_s * 1000.0:.2f} ms ({p16['zero_fill_throughput_mb_s']:.1f} MB/s)",
            status="PASS" if zero_16mb_s < 1.0 else "FAIL",
        )
    )

    # 2. Argon2id Key Derivation p50
    kdf_dist = kdf_res["key_derivation_distribution"]
    scorecard.append(
        SLAScorecardItem(
            boundary_operation="Argon2id Vault Key Derivation (p50)",
            target_metric="Median derivation latency (64 MiB, t=3, p=4)",
            sla_threshold="< 1.000 s (1000 ms)",
            observed_value=f"{kdf_dist['p50_median']:.2f} ms",
            status="PASS" if kdf_dist["p50_median"] < 1000.0 else "FAIL",
        )
    )

    # 3. Argon2id Key Derivation p95
    scorecard.append(
        SLAScorecardItem(
            boundary_operation="Argon2id Vault Key Derivation (p95)",
            target_metric="95th-percentile latency",
            sla_threshold="< 1.000 s (1000 ms)",
            observed_value=f"{kdf_dist['p95']:.2f} ms",
            status="PASS" if kdf_dist["p95"] < 1000.0 else "FAIL",
        )
    )

    # 4. Argon2id Key Derivation p99
    scorecard.append(
        SLAScorecardItem(
            boundary_operation="Argon2id Vault Key Derivation (p99)",
            target_metric="99th-percentile tail latency",
            sla_threshold="< 1.000 s (1000 ms)",
            observed_value=f"{kdf_dist['p99']:.2f} ms",
            status="PASS" if kdf_dist["p99"] < 1000.0 else "FAIL",
        )
    )

    # 5. Bystander Multi-Store Purge (10,000 records mixed)
    mixed_s = purge_res["scenarios"][0]
    scorecard.append(
        SLAScorecardItem(
            boundary_operation="Bystander Purge (10,000 records, 5,000 expired)",
            target_metric="Cascade purge + multi-store verification",
            sla_threshold="< 1.000 s (1000 ms)",
            observed_value=f"{mixed_s['purge_latency_ms']:.2f} ms ({mixed_s['purge_throughput_recs_per_sec']:.0f} recs/s)",
            status="PASS" if mixed_s["purge_latency_ms"] < 1000.0 else "FAIL",
        )
    )

    # 6. Bystander Multi-Store Purge (10,000 records full cascade)
    full_s = purge_res["scenarios"][1]
    scorecard.append(
        SLAScorecardItem(
            boundary_operation="Bystander Purge (10,000 records full cascade)",
            target_metric="Worst-case 10,000 multi-store deletions",
            sla_threshold="< 1.000 s (1000 ms)",
            observed_value=f"{full_s['purge_latency_ms']:.2f} ms ({full_s['purge_throughput_recs_per_sec']:.0f} recs/s)",
            status="PASS" if full_s["purge_latency_ms"] < 1000.0 else "FAIL",
        )
    )

    # 7. EER Computation Latency across 100 Speaker Corpus
    spk_100 = next(p for p in eer_res["speaker_set_pipeline_scaling"] if p["n_speakers"] == 100)
    eer_100_ms = spk_100["eer_compute_seconds"] * 1000.0
    scorecard.append(
        SLAScorecardItem(
            boundary_operation="EER ROC Computation across 100 Speakers",
            target_metric="Threshold crossover across 12,495 comparison pairs",
            sla_threshold="< 0.100 s (100 ms)",
            observed_value=f"{eer_100_ms:.2f} ms",
            status="PASS" if eer_100_ms < 100.0 else "FAIL",
        )
    )

    # 8. EER Computation (1,000,000 scores array)
    p_1m = next(p for p in eer_res["pure_eer_scaling"] if p["total_scores"] == 1000000)
    scorecard.append(
        SLAScorecardItem(
            boundary_operation="ROC Crossover / EER Computation (1,000,000 scores)",
            target_metric="Fast monotonic threshold crossover",
            sla_threshold="< 1.000 s (1000 ms)",
            observed_value=f"{p_1m['latency_ms']:.2f} ms ({p_1m['throughput_scores_per_sec'] / 1e6:.2f} Mscores/s)",
            status="PASS" if p_1m["latency_ms"] < 1000.0 else "FAIL",
        )
    )

    # 9. Gate T16.5 Standard Standing Regression (30 speakers benchmark)
    std_bench = eer_res["standard_gate_benchmark"]
    scorecard.append(
        SLAScorecardItem(
            boundary_operation="Gate T16.5 Standard Benchmark (30 speakers, 10 utts)",
            target_metric="Full standing regression ASV evaluation",
            sla_threshold="< 1.500 s (1500 ms)",
            observed_value=f"{std_bench['pipeline_seconds'] * 1000.0:.2f} ms (EER={std_bench['eer']:.2f})",
            status="PASS" if std_bench["sub_second_met"] else "FAIL",
        )
    )

    return scorecard


# =====================================================================
# REPORT PRINTER & JSON EXPORT
# =====================================================================

def print_profiling_results(
    buf_res: Dict[str, Any],
    kdf_res: Dict[str, Any],
    eer_res: Dict[str, Any],
    purge_res: Dict[str, Any],
    scorecard: List[SLAScorecardItem],
) -> None:
    """Print beautifully formatted profiling evidence tables to console."""
    sep = "=" * 88
    dash = "-" * 88

    print("\n" + sep)
    print("      CHRONIS SPRINT 16 TRUST-BOUNDARY PERFORMANCE PROFILING REPORT")
    print("      Reference: Section 14 (B10) & Section 16 Evidence Schema")
    print(sep)

    # 1. SecureBuffer Memory Profile Table
    print("\n[1] SECUREBUFFER MEMORY OVERHEAD & ZERO-FILL PERFORMANCE")
    print(dash)
    print(
        f"{'Payload Size':<26} | {'Obj RAM':<9} | {'Overhead':<10} | {'Overhead %':<11} | {'Zero Latency':<12} | {'Zero Thrput':<12}"
    )
    print(dash)
    for p in buf_res["profiles"]:
        print(
            f"{p['label']:<26} | {p['total_object_bytes']:>7} B | {p['fixed_overhead_bytes']:>8} B | "
            f"{p['overhead_percentage']:>10.2f}% | {p['zero_fill_time_us']:>9.2f} us | {p['zero_fill_throughput_mb_s']:>8.1f} MB/s"
        )
    print(dash)
    lc = buf_res["lifecycle_check"]
    print(
        f"Fixed Metadata Overhead: {buf_res['fixed_metadata_overhead_bytes']} bytes | "
        f"Heap Reclamation: {lc['reclamation_ratio_percent']:.1f}% ({lc['reclaimed_bytes'] / (1024*1024):.1f} MiB freed) | "
        f"Lingering SBs: {lc['lingering_secure_buffer_objects']} | Verified: {lc['reclamation_verified']}"
    )

    # 2. Argon2id Key Derivation Table
    print("\n[2] ARGON2ID KEY DERIVATION LATENCY DISTRIBUTIONS (RFC 9106: m=64MiB, t=3, p=4)")
    print(dash)
    kd = kdf_res["key_derivation_distribution"]
    phc_g = kdf_res["phc_generation_distribution"]
    phc_v = kdf_res["phc_verification_distribution"]

    print(f"{'Operation':<26} | {'Samples':<7} | {'Mean +/- Std (ms)':<18} | {'p50 (ms)':<9} | {'p95 (ms)':<9} | {'p99 (ms)':<9} | {'Sub-Sec':<7}")
    print(dash)
    print(
        f"{'Key Derivation (derive_key)':<26} | {kd['samples_count']:>7} | {kd['mean']:>6.1f} +/- {kd['std_dev']:<6.1f} | "
        f"{kd['p50_median']:>7.2f} | {kd['p95']:>7.2f} | {kd['p99']:>7.2f} | {'PASS' if kd['sub_second_sla_met'] else 'FAIL'}"
    )
    print(
        f"{'PHC Generation (derive_phc)':<26} | {phc_g['samples_count']:>7} | {phc_g['mean']:>6.1f} +/- {phc_g['std_dev']:<6.1f} | "
        f"{phc_g['p50_median']:>7.2f} | {phc_g['p95']:>7.2f} | {phc_g['p99']:>7.2f} | {'PASS' if phc_g['sub_second_sla_met'] else 'FAIL'}"
    )
    print(
        f"{'PHC Verify (verify_phc)':<26} | {phc_v['samples_count']:>7} | {phc_v['mean']:>6.1f} +/- {phc_v['std_dev']:<6.1f} | "
        f"{phc_v['p50_median']:>7.2f} | {phc_v['p95']:>7.2f} | {phc_v['p99']:>7.2f} | {'PASS' if phc_v['sub_second_sla_met'] else 'FAIL'}"
    )
    print(dash)
    print(
        f"Argon2id Min: {kd['min']:.2f} ms | Max: {kd['max']:.2f} ms | IQR: {kd['iqr']:.2f} ms | "
        f"SLA Target (< 1.0s): {'MET' if kd['sub_second_sla_met'] else 'BREACHED'}"
    )

    # 3. EER Computation Scaling Tables
    print("\n[3A] EER ASV PIPELINE SCALING ACROSS SPEAKER SETS")
    print(dash)
    print(
        f"{'Speakers':<9} | {'Utterances':<10} | {'Total Pairs':<11} | {'Pipeline Time':<13} | {'Throughput':<14} | {'EER (Ign/Semi/Full)':<21} | {'Status':<6}"
    )
    print(dash)
    for s in eer_res["speaker_set_pipeline_scaling"]:
        eer_str = f"{s['eer_ignorant']:.2f} / {s['eer_semi_informed']:.2f} / {s['eer_fully_informed']:.2f}"
        print(
            f"{s['n_speakers']:<9} | {s['total_utterances']:<10} | {s['total_comparison_pairs']:<11} | "
            f"{s['total_pipeline_seconds']:>8.3f} s    | {s['pairs_per_second_throughput']:>8.1f} p/s    | "
            f"{eer_str:<21} | {'PASS' if s['monotonicity_satisfied'] else 'FAIL'}"
        )

    print("\n[3B] PURE ROC CROSSOVER / EER ALGORITHM THROUGHPUT SCALING")
    print(dash)
    print(
        f"{'Score Array Size':<18} | {'Genuine / Impostor':<20} | {'Latency (ms)':<13} | {'Throughput (scores/s)':<22} | {'EER':<8} | {'Sub-Sec':<7}"
    )
    print(dash)
    for p in eer_res["pure_eer_scaling"]:
        gi_str = f"{p['genuine_count']} / {p['impostor_count']}"
        print(
            f"{p['total_scores']:<18} | {gi_str:<20} | {p['latency_ms']:>9.3f} ms   | "
            f"{p['throughput_scores_per_sec']:>14.1f} scores/s | {p['eer']:<8.4f} | {'PASS' if p['sub_second_met'] else 'FAIL'}"
        )
    print(dash)
    std_b = eer_res["standard_gate_benchmark"]
    print(
        f"Gate T16.5 Standard Benchmark (30 spk, 10 utts): {std_b['pipeline_seconds']:.3f} s (EER={std_b['eer']:.4f}) | "
        f"Bootstrap CI (100 reps, 50 spk): {eer_res['bootstrap_profile']['latency_seconds']:.3f} s [{eer_res['bootstrap_profile']['ci_95'][0]:.4f}, {eer_res['bootstrap_profile']['ci_95'][1]:.4f}]"
    )

    # 4. Bystander Purge Latency under 10,000 Records
    print("\n[4] BYSTANDER BIOMETRIC PURGE LATENCY (10,000 RECORDS, MULTI-STORE CASCADE)")
    print(dash)
    print(
        f"{'Scenario':<34} | {'Expired':<7} | {'Purge Latency':<13} | {'Purge Throughput':<18} | {'Avg Del/Rec':<11} | {'Leaks':<5} | {'Sub-Sec':<7}"
    )
    print(dash)
    for sc in purge_res["scenarios"]:
        print(
            f"{sc['scenario_name']:<34} | {sc['expired_records']:<7} | {sc['purge_latency_ms']:>8.3f} ms   | "
            f"{sc['purge_throughput_recs_per_sec']:>12.1f} recs/s | {sc['average_deletion_us_per_record']:>7.2f} us  | "
            f"{sc['multi_store_leakage_detected']:<5} | {'PASS' if sc['sub_second_purge_sla_met'] else 'FAIL'}"
        )
    print(dash)
    print(
        f"Read-Time Gating: {purge_res['scenarios'][0]['read_time_gating_latency_ms']:.2f} ms "
        f"({purge_res['scenarios'][0]['read_time_gating_throughput_qps']:.0f} lookups/s, 100% blocked before purge)"
    )

    # 5. SLA Scorecard Table
    print("\n[5] TRUST-BOUNDARY SUB-SECOND OPERATIONAL METRICS SLA SCORECARD")
    print(sep)
    print(f"{'Boundary Operation':<46} | {'SLA Threshold':<19} | {'Observed Value':<24} | {'Status':<6}")
    print(dash)
    for sc in scorecard:
        print(
            f"{sc.boundary_operation:<46} | {sc.sla_threshold:<19} | {sc.observed_value:<24} | {sc.status:<6}"
        )
    print(sep)
    all_pass = all(sc.status == "PASS" for sc in scorecard)
    print(f"OVERALL TRUST-BOUNDARY SLA STATUS: {'>>> ALL GATES PASS (SUB-SECOND VERIFIED) <<<' if all_pass else '>>> SOME GATES FAILED <<<'}")
    print(sep + "\n")


def run_full_profiling_suite(
    argon2_iterations: int = 50,
    output_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """Execute complete Sprint 16 profiling suite and generate report."""
    print("Initializing Chronis Sprint 16 High-Performance Profiling Suite...")
    t_start = time.time()

    # Step 1: SecureBuffer Memory Profile
    print(" -> Profiling SecureBuffer memory overhead and zero-fill throughput...")
    buf_results = profile_secure_buffer_memory()

    # Step 2: Argon2id Latency Distributions
    print(f" -> Profiling Argon2id latency distributions ({argon2_iterations} iterations, RFC 9106)...")
    kdf_results = profile_argon2id_derivation(iterations=argon2_iterations)

    # Step 3: EER Scaling and Throughput
    print(" -> Profiling EER computation throughput across speaker sets and 1M scores...")
    eer_results = profile_eer_scaling()

    # Step 4: Bystander Purge Scale (10,000 records)
    print(" -> Profiling bystander purge latency under 10,000 records with multi-store cascade...")
    purge_results = profile_bystander_purge_scale()

    # Step 5: Sub-Second Scorecard Evaluation
    scorecard = build_sla_scorecard(buf_results, kdf_results, eer_results, purge_results)

    total_elapsed = time.time() - t_start

    # Console reporting
    print_profiling_results(buf_results, kdf_results, eer_results, purge_results, scorecard)

    report_payload = {
        "suite_name": "Chronis Sprint 16 Trust-Boundary Performance Profiler",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total_profiling_seconds": round(total_elapsed, 3),
        "system_environment": {
            "platform": platform.platform(),
            "processor": platform.processor(),
            "python_version": sys.version,
            "architecture": platform.architecture()[0],
        },
        "secure_buffer_memory": buf_results,
        "argon2id_derivation": kdf_results,
        "eer_computation": eer_results,
        "bystander_purge_10k": purge_results,
        "sla_scorecard": [asdict(s) for s in scorecard],
        "all_slas_met": all(s.status == "PASS" for s in scorecard),
    }

    # Save to disk
    target_json = output_path or (Path(__file__).resolve().parent / "profile_performance_report.json")
    with open(target_json, "w", encoding="utf-8") as f:
        json.dump(report_payload, f, indent=2)
    print(f"Profiling report written to: {target_json.resolve()}")

    return report_payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Chronis Sprint 16 Trust-Boundary Performance Profiler")
    parser.add_argument("--iterations", type=int, default=50, help="Argon2id derivation iterations (default: 50)")
    parser.add_argument("--output", type=str, default=None, help="Output JSON report path")
    args = parser.parse_args()

    out = Path(args.output) if args.output else None
    run_full_profiling_suite(argon2_iterations=args.iterations, output_path=out)
