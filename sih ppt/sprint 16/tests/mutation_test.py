"""mutation_test.py — Mutation Testing & Fault-Injection Harness for Chronis Sprint 16.

Enforces Rule H1.2 (Test-of-the-test requirement) across Sprint 16 Trust Boundaries:
  "Every release-blocking test must be demonstrated to fail if the defect it was
   created to catch is reintroduced. A test that passes even when broken behavior
   is present is 'test theater' and blocks release."

Mutation Domains Covered:
  1. Gate T16.1: Isolated Decryption Boundary (RAM lifecycle, sandbox enforcement, teardown)
  2. Gate T16.2: 24-Hour Session-Key TTL (expiration boundary, threshold bypass, inverted logic)
  3. Gate T16.3: RAM Zero-Fill Forensics (SecureBuffer wipe, zombie view guard, exception safety)
  4. Gate T16.4: Argon2id Key Derivation & Salt Validation (RFC 9106, weak salt, PHC verify)
  5. Gate T16.6: Bystander Biometric TTL & Purge (30d window, read-time gating, wearer rejection, alternate stores)
  6. Gate T16.7: SPDX / License CI Boundary Gate (copyleft block, noncommercial block, fail-closed)

Empirical Target: 100% Mutation Kill Rate (0 Mutants Survived).
"""

from __future__ import annotations

import enum
import io
import json
import sys
import time
import unittest
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

# Ensure project root is in python path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import isolation
import kdf
import bystander_ttl
import license_gate

import tests.test_isolation as t_iso
import tests.test_kdf as t_kdf
import tests.test_bystander_ttl as t_byst
import tests.test_license_gate as t_lic
import tests.test_test_of_the_test as t_tott


def _mutated_forensics_worker_no_zero(shm_name: str, secret_len: int) -> None:
    """Mutated forensics worker: skips memory zero-fill leaving secret intact."""
    pass


class MutationCategory(str, enum.Enum):
    ISOLATION = "isolation"
    SESSION_KEY_TTL = "session_key_ttl"
    ZERO_FILL = "zero_fill"
    KDF_SALT = "kdf_salt_validation"
    BYSTANDER_RETENTION = "bystander_retention"
    LICENSE_GATE = "license_gate"


@dataclass
class Mutation:
    """Definition of a deliberate defect injected into the codebase."""
    mutation_id: str
    category: MutationCategory
    gate_reference: str
    target_component: str
    description: str
    test_classes: List[Any]
    apply_fn: Callable[[], Any]
    restore_fn: Callable[[Any], None]


@dataclass
class MutationResult:
    """Outcome of running the test suite against an active mutation."""
    mutation_id: str
    category: str
    gate_reference: str
    target_component: str
    description: str
    status: str  # "KILLED" or "SURVIVED"
    killing_test: Optional[str] = None
    killer_exception: Optional[str] = None
    duration_ms: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class MutationReport:
    """Summary report of the mutation testing execution."""
    timestamp: str
    total_mutants: int
    killed_mutants: int
    survived_mutants: int
    mutation_score_pct: float
    rule_h1_2_satisfied: bool
    results: List[MutationResult]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "total_mutants": self.total_mutants,
            "killed_mutants": self.killed_mutants,
            "survived_mutants": self.survived_mutants,
            "mutation_score_pct": self.mutation_score_pct,
            "rule_h1_2_satisfied": self.rule_h1_2_satisfied,
            "results": [r.to_dict() for r in self.results],
        }


class MutationHarness:
    """Fault injection harness managing deliberate defect lifecycle and killing verification."""

    def __init__(self) -> None:
        self.mutations: List[Mutation] = self._register_all_mutations()

    def _register_all_mutations(self) -> List[Mutation]:
        muts: List[Mutation] = []

        # =====================================================================
        # DOMAIN 1: ISOLATED DECRYPTION BOUNDARY (Gate T16.1)
        # =====================================================================
        # MUT-ISO-01: Silent fallback to unisolated runtime
        def apply_iso_01():
            orig = isolation.IsolatedProcessingContainer.__init__
            def mutated_init(self, client, execution_target=isolation.ExecutionTarget.MODE_A_CLOUD, allow_no_isolation=False, preferred_runtime=None):
                self.client = client
                self.execution_target = execution_target
                self.allow_no_isolation = allow_no_isolation
                # DEFECT: Silently fallback to LocalDevRuntime even when allow_no_isolation=False
                self._runtime = isolation.LocalDevRuntime()
            isolation.IsolatedProcessingContainer.__init__ = mutated_init
            t_iso.IsolatedProcessingContainer.__init__ = mutated_init
            t_tott.IsolatedProcessingContainer.__init__ = mutated_init
            return orig

        def restore_iso_01(orig):
            isolation.IsolatedProcessingContainer.__init__ = orig
            t_iso.IsolatedProcessingContainer.__init__ = orig
            t_tott.IsolatedProcessingContainer.__init__ = orig

        muts.append(Mutation(
            mutation_id="MUT-ISO-01",
            category=MutationCategory.ISOLATION,
            gate_reference="Gate T16.1 / Rule H1.2",
            target_component="IsolatedProcessingContainer.__init__",
            description="Silent fallback to unisolated runtime when allow_no_isolation=False",
            test_classes=[t_iso.TestRuntimeSelection, t_tott.TestOfTheTest],
            apply_fn=apply_iso_01,
            restore_fn=restore_iso_01,
        ))

        # MUT-ISO-02: Plaintext zero-fill omitted on container exception
        def apply_iso_02():
            orig = isolation.IsolatedProcessingContainer.process
            def mutated_process(self, decrypt_fn, process_fn):
                session_key = self.client.grant_session_key(purpose=f"isolated_exec_{self.execution_target.value}")
                session_key.require_valid()
                raw_decrypted = decrypt_fn(session_key)
                plaintext_buf = isolation.SecureBuffer(raw_decrypted)
                view = plaintext_buf.view()
                mutable_view = bytearray(view)
                try:
                    output = process_fn(mutable_view)
                finally:
                    # DEFECT: Teardown RAM zero-fill omitted on exception
                    pass
                return isolation.ContainerResult(
                    output=output,
                    security_boundary=self._runtime.security_boundary,
                    execution_target=self.execution_target,
                )
            isolation.IsolatedProcessingContainer.process = mutated_process
            t_iso.IsolatedProcessingContainer.process = mutated_process
            return orig

        def restore_iso_02(orig):
            isolation.IsolatedProcessingContainer.process = orig
            t_iso.IsolatedProcessingContainer.process = orig

        muts.append(Mutation(
            mutation_id="MUT-ISO-02",
            category=MutationCategory.ISOLATION,
            gate_reference="Gate T16.1 / Gate T16.3",
            target_component="IsolatedProcessingContainer.process",
            description="Teardown RAM zero-fill of mutable buffer omitted on container exception",
            test_classes=[t_iso.TestContainerProcessing],
            apply_fn=apply_iso_02,
            restore_fn=restore_iso_02,
        ))

        # MUT-ISO-03: Forensics worker omits shared memory zero-fill
        def apply_iso_03():
            orig = isolation._forensics_worker
            isolation._forensics_worker = _mutated_forensics_worker_no_zero
            t_iso.run_memory_forensics_check = isolation.run_memory_forensics_check
            return orig

        def restore_iso_03(orig):
            isolation._forensics_worker = orig
            t_iso.run_memory_forensics_check = isolation.run_memory_forensics_check

        muts.append(Mutation(
            mutation_id="MUT-ISO-03",
            category=MutationCategory.ISOLATION,
            gate_reference="Gate T16.1 / Gate T16.3",
            target_component="isolation._forensics_worker",
            description="Cross-process memory forensics worker omits shared memory zero-fill",
            test_classes=[t_iso.TestMemoryForensics],
            apply_fn=apply_iso_03,
            restore_fn=restore_iso_03,
        ))

        # MUT-ISO-04: Container process omits session_key.require_valid()
        def apply_iso_04():
            orig = isolation.IsolatedProcessingContainer.process
            def mutated_process(self, decrypt_fn, process_fn):
                session_key = self.client.grant_session_key(purpose=f"isolated_exec_{self.execution_target.value}")
                # DEFECT: session_key.require_valid() omitted!
                raw_decrypted = decrypt_fn(session_key)
                plaintext_buf = isolation.SecureBuffer(raw_decrypted)
                view = plaintext_buf.view()
                mutable_view = bytearray(view)
                try:
                    output = process_fn(mutable_view)
                finally:
                    for i in range(len(mutable_view)):
                        mutable_view[i] = 0
                    plaintext_buf.zero()
                    session_key.material.zero()
                return isolation.ContainerResult(
                    output=output,
                    security_boundary=self._runtime.security_boundary,
                    execution_target=self.execution_target,
                )
            isolation.IsolatedProcessingContainer.process = mutated_process
            t_iso.IsolatedProcessingContainer.process = mutated_process
            return orig

        def restore_iso_04(orig):
            isolation.IsolatedProcessingContainer.process = orig
            t_iso.IsolatedProcessingContainer.process = orig

        muts.append(Mutation(
            mutation_id="MUT-ISO-04",
            category=MutationCategory.ISOLATION,
            gate_reference="Gate T16.1 / Gate T16.2",
            target_component="IsolatedProcessingContainer.process",
            description="Container process omits session_key.require_valid() check",
            test_classes=[t_iso.TestContainerProcessing],
            apply_fn=apply_iso_04,
            restore_fn=restore_iso_04,
        ))

        # MUT-ISO-05: Container teardown omits plaintext_buf.zero()
        def apply_iso_05():
            orig = isolation.IsolatedProcessingContainer.process
            def mutated_process(self, decrypt_fn, process_fn):
                session_key = self.client.grant_session_key(purpose=f"isolated_exec_{self.execution_target.value}")
                session_key.require_valid()
                raw_decrypted = decrypt_fn(session_key)
                plaintext_buf = isolation.SecureBuffer(raw_decrypted)
                view = plaintext_buf.view()
                mutable_view = bytearray(view)
                try:
                    output = process_fn(mutable_view)
                finally:
                    for i in range(len(mutable_view)):
                        mutable_view[i] = 0
                    # DEFECT: plaintext_buf.zero() omitted in teardown!
                    session_key.material.zero()
                return isolation.ContainerResult(
                    output=output,
                    security_boundary=self._runtime.security_boundary,
                    execution_target=self.execution_target,
                )
            isolation.IsolatedProcessingContainer.process = mutated_process
            t_iso.IsolatedProcessingContainer.process = mutated_process
            return orig

        def restore_iso_05(orig):
            isolation.IsolatedProcessingContainer.process = orig
            t_iso.IsolatedProcessingContainer.process = orig

        muts.append(Mutation(
            mutation_id="MUT-ISO-05",
            category=MutationCategory.ISOLATION,
            gate_reference="Gate T16.1 / Gate T16.3",
            target_component="IsolatedProcessingContainer.process",
            description="Container teardown omits plaintext_buf.zero() cryptographic wipe",
            test_classes=[t_iso.TestContainerProcessing],
            apply_fn=apply_iso_05,
            restore_fn=restore_iso_05,
        ))

        # =====================================================================
        # DOMAIN 2: 24-HOUR SESSION-KEY TTL (Gate T16.2)
        # =====================================================================
        # MUT-TTL-01: SessionKey.is_expired always returns False
        def apply_ttl_01():
            orig = isolation.SessionKey.is_expired
            isolation.SessionKey.is_expired = lambda self, now=None: False
            t_iso.SessionKey.is_expired = isolation.SessionKey.is_expired
            t_tott.SessionKey.is_expired = isolation.SessionKey.is_expired
            return orig

        def restore_ttl_01(orig):
            isolation.SessionKey.is_expired = orig
            t_iso.SessionKey.is_expired = orig
            t_tott.SessionKey.is_expired = orig

        muts.append(Mutation(
            mutation_id="MUT-TTL-01",
            category=MutationCategory.SESSION_KEY_TTL,
            gate_reference="Gate T16.2 / Rule H1.2",
            target_component="SessionKey.is_expired",
            description="SessionKey.is_expired unconditionally returns False (TTL bypass)",
            test_classes=[t_iso.TestSessionKeyTTL, t_tott.TestOfTheTest],
            apply_fn=apply_ttl_01,
            restore_fn=restore_ttl_01,
        ))

        # MUT-TTL-02: SessionKey.is_expired inverted comparison (< instead of >)
        def apply_ttl_02():
            orig = isolation.SessionKey.is_expired
            def mutated_is_expired(self, now=None):
                current_time = now if now is not None else time.time()
                # DEFECT: Inverted comparison
                return current_time < (self.issued_at + self.ttl_seconds)
            isolation.SessionKey.is_expired = mutated_is_expired
            t_iso.SessionKey.is_expired = mutated_is_expired
            return orig

        def restore_ttl_02(orig):
            isolation.SessionKey.is_expired = orig
            t_iso.SessionKey.is_expired = orig

        muts.append(Mutation(
            mutation_id="MUT-TTL-02",
            category=MutationCategory.SESSION_KEY_TTL,
            gate_reference="Gate T16.2",
            target_component="SessionKey.is_expired",
            description="SessionKey.is_expired inverts comparison operator (< instead of >)",
            test_classes=[t_iso.TestSessionKeyTTL],
            apply_fn=apply_ttl_02,
            restore_fn=restore_ttl_02,
        ))

        # MUT-TTL-03: SessionKey.require_valid fails to raise SessionKeyExpired
        def apply_ttl_03():
            orig = isolation.SessionKey.require_valid
            isolation.SessionKey.require_valid = lambda self, now=None: None
            t_iso.SessionKey.require_valid = isolation.SessionKey.require_valid
            t_tott.SessionKey.require_valid = isolation.SessionKey.require_valid
            return orig

        def restore_ttl_03(orig):
            isolation.SessionKey.require_valid = orig
            t_iso.SessionKey.require_valid = orig
            t_tott.SessionKey.require_valid = orig

        muts.append(Mutation(
            mutation_id="MUT-TTL-03",
            category=MutationCategory.SESSION_KEY_TTL,
            gate_reference="Gate T16.2 / Rule H1.2",
            target_component="SessionKey.require_valid",
            description="SessionKey.require_valid fails to raise SessionKeyExpired on expired key",
            test_classes=[t_iso.TestSessionKeyTTL, t_tott.TestOfTheTest],
            apply_fn=apply_ttl_03,
            restore_fn=restore_ttl_03,
        ))

        # MUT-TTL-04: Session key TTL threshold doubled (48h instead of 24h)
        def apply_ttl_04():
            orig = isolation.SessionKey.is_expired
            def mutated_is_expired(self, now=None):
                current_time = now if now is not None else time.time()
                # DEFECT: Double TTL window
                return current_time > (self.issued_at + 2 * self.ttl_seconds)
            isolation.SessionKey.is_expired = mutated_is_expired
            t_iso.SessionKey.is_expired = mutated_is_expired
            return orig

        def restore_ttl_04(orig):
            isolation.SessionKey.is_expired = orig
            t_iso.SessionKey.is_expired = orig

        muts.append(Mutation(
            mutation_id="MUT-TTL-04",
            category=MutationCategory.SESSION_KEY_TTL,
            gate_reference="Gate T16.2",
            target_component="SessionKey.is_expired",
            description="SessionKey.is_expired doubles threshold window (48h instead of 24h)",
            test_classes=[t_iso.TestSessionKeyTTL],
            apply_fn=apply_ttl_04,
            restore_fn=restore_ttl_04,
        ))

        # =====================================================================
        # DOMAIN 3: RAM ZERO-FILL & SECURE BUFFER (Gate T16.3)
        # =====================================================================
        # MUT-ZERO-01: SecureBuffer.zero does not wipe memory bytes
        def apply_zero_01():
            orig = isolation.SecureBuffer.zero
            def mutated_zero(self):
                # DEFECT: Mark zeroed but do not overwrite memory
                self._zeroed = True
            isolation.SecureBuffer.zero = mutated_zero
            t_iso.SecureBuffer.zero = mutated_zero
            t_tott.SecureBuffer.zero = mutated_zero
            return orig

        def restore_zero_01(orig):
            isolation.SecureBuffer.zero = orig
            t_iso.SecureBuffer.zero = orig
            t_tott.SecureBuffer.zero = orig

        muts.append(Mutation(
            mutation_id="MUT-ZERO-01",
            category=MutationCategory.ZERO_FILL,
            gate_reference="Gate T16.3 / Rule H1.2",
            target_component="SecureBuffer.zero",
            description="SecureBuffer.zero() marks buffer zeroed without wiping underlying memory bytes",
            test_classes=[t_iso.TestSecureBuffer, t_tott.TestOfTheTest],
            apply_fn=apply_zero_01,
            restore_fn=restore_zero_01,
        ))

        # MUT-ZERO-02: SecureBuffer.view permits inspection after zero
        def apply_zero_02():
            orig = isolation.SecureBuffer.view
            def mutated_view(self):
                # DEFECT: Do not raise ValueError when _zeroed is True
                return memoryview(self._buf)
            isolation.SecureBuffer.view = mutated_view
            t_iso.SecureBuffer.view = mutated_view
            return orig

        def restore_zero_02(orig):
            isolation.SecureBuffer.view = orig
            t_iso.SecureBuffer.view = orig

        muts.append(Mutation(
            mutation_id="MUT-ZERO-02",
            category=MutationCategory.ZERO_FILL,
            gate_reference="Gate T16.3",
            target_component="SecureBuffer.view",
            description="SecureBuffer.view() permits memory inspection after zero() has been called",
            test_classes=[t_iso.TestSecureBuffer],
            apply_fn=apply_zero_02,
            restore_fn=restore_zero_02,
        ))

        # MUT-ZERO-03: SecureBuffer.__exit__ omits zero on exception
        def apply_zero_03():
            orig = isolation.SecureBuffer.__exit__
            def mutated_exit(self, exc_type, exc_val, exc_tb):
                # DEFECT: Only zero if no exception occurred
                if exc_type is None:
                    self.zero()
            isolation.SecureBuffer.__exit__ = mutated_exit
            t_iso.SecureBuffer.__exit__ = mutated_exit
            return orig

        def restore_zero_03(orig):
            isolation.SecureBuffer.__exit__ = orig
            t_iso.SecureBuffer.__exit__ = orig

        muts.append(Mutation(
            mutation_id="MUT-ZERO-03",
            category=MutationCategory.ZERO_FILL,
            gate_reference="Gate T16.3",
            target_component="SecureBuffer.__exit__",
            description="SecureBuffer.__exit__ skips zero-fill when an exception is raised",
            test_classes=[t_iso.TestSecureBuffer],
            apply_fn=apply_zero_03,
            restore_fn=restore_zero_03,
        ))

        # MUT-ZERO-04: SecureBuffer initialized marked zeroed
        def apply_zero_04():
            orig = isolation.SecureBuffer.__init__
            def mutated_init(self, data):
                orig(self, data)
                # DEFECT: Prematurely flag as zeroed
                self._zeroed = True
            isolation.SecureBuffer.__init__ = mutated_init
            t_iso.SecureBuffer.__init__ = mutated_init
            return orig

        def restore_zero_04(orig):
            isolation.SecureBuffer.__init__ = orig
            t_iso.SecureBuffer.__init__ = orig

        muts.append(Mutation(
            mutation_id="MUT-ZERO-04",
            category=MutationCategory.ZERO_FILL,
            gate_reference="Gate T16.3",
            target_component="SecureBuffer.__init__",
            description="SecureBuffer.__init__ prematurely sets _zeroed=True on creation",
            test_classes=[t_iso.TestSecureBuffer],
            apply_fn=apply_zero_04,
            restore_fn=restore_zero_04,
        ))

        # =====================================================================
        # DOMAIN 4: ARGON2ID KEY DERIVATION & SALT VALIDATION (Gate T16.4)
        # =====================================================================
        # MUT-KDF-01: VaultKeyDerivation.derive_key accepts weak/short salt (<16 bytes)
        def apply_kdf_01():
            orig = kdf.VaultKeyDerivation.derive_key
            def mutated_derive_key(self, passphrase, salt, as_secure_buffer=True):
                # DEFECT: Removed salt length validation check
                passphrase_bytes = passphrase.encode("utf-8") if isinstance(passphrase, str) else passphrase
                kdf_obj = kdf.Argon2id(
                    salt=salt,
                    length=self.params.key_len,
                    iterations=self.params.time_cost,
                    lanes=self.params.parallelism,
                    memory_cost=self.params.memory_cost,
                    ad=None,
                    secret=None,
                )
                raw_key = kdf_obj.derive(passphrase_bytes)
                if as_secure_buffer:
                    return isolation.SecureBuffer(raw_key)
                return raw_key
            kdf.VaultKeyDerivation.derive_key = mutated_derive_key
            t_kdf.VaultKeyDerivation.derive_key = mutated_derive_key
            t_tott.VaultKeyDerivation.derive_key = mutated_derive_key
            return orig

        def restore_kdf_01(orig):
            kdf.VaultKeyDerivation.derive_key = orig
            t_kdf.VaultKeyDerivation.derive_key = orig
            t_tott.VaultKeyDerivation.derive_key = orig

        muts.append(Mutation(
            mutation_id="MUT-KDF-01",
            category=MutationCategory.KDF_SALT,
            gate_reference="Gate T16.4 / Rule H1.2",
            target_component="VaultKeyDerivation.derive_key",
            description="VaultKeyDerivation.derive_key accepts short salt (<16 bytes) violating RFC 9106",
            test_classes=[t_kdf.TestVaultKeyDerivation, t_tott.TestOfTheTest],
            apply_fn=apply_kdf_01,
            restore_fn=restore_kdf_01,
        ))

        # MUT-KDF-02: VaultKeyDerivation.generate_salt produces weak 8-byte salt
        def apply_kdf_02():
            orig = kdf.VaultKeyDerivation.generate_salt
            kdf.VaultKeyDerivation.generate_salt = lambda self: b"12345678"
            t_kdf.VaultKeyDerivation.generate_salt = kdf.VaultKeyDerivation.generate_salt
            return orig

        def restore_kdf_02(orig):
            kdf.VaultKeyDerivation.generate_salt = orig
            t_kdf.VaultKeyDerivation.generate_salt = orig

        muts.append(Mutation(
            mutation_id="MUT-KDF-02",
            category=MutationCategory.KDF_SALT,
            gate_reference="Gate T16.4",
            target_component="VaultKeyDerivation.generate_salt",
            description="VaultKeyDerivation.generate_salt produces weak 8-byte salt (violating 16-byte minimum)",
            test_classes=[t_kdf.TestVaultKeyDerivation],
            apply_fn=apply_kdf_02,
            restore_fn=restore_kdf_02,
        ))

        # MUT-KDF-03: VaultKeyDerivation.verify_phc always returns True
        def apply_kdf_03():
            orig = kdf.VaultKeyDerivation.verify_phc
            kdf.VaultKeyDerivation.verify_phc = lambda self, passphrase, phc_string: True
            t_kdf.VaultKeyDerivation.verify_phc = kdf.VaultKeyDerivation.verify_phc
            return orig

        def restore_kdf_03(orig):
            kdf.VaultKeyDerivation.verify_phc = orig
            t_kdf.VaultKeyDerivation.verify_phc = orig

        muts.append(Mutation(
            mutation_id="MUT-KDF-03",
            category=MutationCategory.KDF_SALT,
            gate_reference="Gate T16.4",
            target_component="VaultKeyDerivation.verify_phc",
            description="VaultKeyDerivation.verify_phc always returns True (passphrase verification bypass)",
            test_classes=[t_kdf.TestVaultKeyDerivation],
            apply_fn=apply_kdf_03,
            restore_fn=restore_kdf_03,
        ))

        # MUT-KDF-04: VaultKeyDerivation.derive_key returns static constant key
        def apply_kdf_04():
            orig = kdf.VaultKeyDerivation.derive_key
            def mutated_derive(self, passphrase, salt, as_secure_buffer=True):
                if len(salt) < 16:
                    raise ValueError("Salt length must be at least 16 bytes")
                static_key = b"STATIC_MOCK_DERIVED_KEY_BYTES!!"
                if as_secure_buffer:
                    return isolation.SecureBuffer(static_key)
                return static_key
            kdf.VaultKeyDerivation.derive_key = mutated_derive
            t_kdf.VaultKeyDerivation.derive_key = mutated_derive
            return orig

        def restore_kdf_04(orig):
            kdf.VaultKeyDerivation.derive_key = orig
            t_kdf.VaultKeyDerivation.derive_key = orig

        muts.append(Mutation(
            mutation_id="MUT-KDF-04",
            category=MutationCategory.KDF_SALT,
            gate_reference="Gate T16.4",
            target_component="VaultKeyDerivation.derive_key",
            description="VaultKeyDerivation.derive_key returns fixed static key (determinism collapse)",
            test_classes=[t_kdf.TestVaultKeyDerivation],
            apply_fn=apply_kdf_04,
            restore_fn=restore_kdf_04,
        ))

        # MUT-KDF-05: Parameter validation omitted at VaultKeyDerivation initialization
        def apply_kdf_05():
            orig = kdf.VaultKeyDerivation.__init__
            def mutated_init(self, params=None):
                self.params = params or kdf.DEFAULT_PARAMS
                # DEFECT: Validation of salt_len < 16 and key_len < 16 omitted!
            kdf.VaultKeyDerivation.__init__ = mutated_init
            t_kdf.VaultKeyDerivation.__init__ = mutated_init
            return orig

        def restore_kdf_05(orig):
            kdf.VaultKeyDerivation.__init__ = orig
            t_kdf.VaultKeyDerivation.__init__ = orig

        muts.append(Mutation(
            mutation_id="MUT-KDF-05",
            category=MutationCategory.KDF_SALT,
            gate_reference="Gate T16.4",
            target_component="VaultKeyDerivation.__init__",
            description="VaultKeyDerivation.__init__ accepts short salt_len (<16 bytes) without ValueError",
            test_classes=[t_kdf.TestVaultKeyDerivation],
            apply_fn=apply_kdf_05,
            restore_fn=restore_kdf_05,
        ))

        # MUT-KDF-06: Pinned RFC 9106 memory cost downgraded below 64 MiB
        def apply_kdf_06():
            orig = kdf.DEFAULT_PARAMS
            mutated = kdf.Argon2Params(
                memory_cost=1024,  # DEFECT: 1 MiB instead of 64 MiB
                time_cost=1,
                parallelism=1,
                salt_len=16,
                key_len=32,
            )
            kdf.DEFAULT_PARAMS = mutated
            t_kdf.DEFAULT_PARAMS = mutated
            return orig

        def restore_kdf_06(orig):
            kdf.DEFAULT_PARAMS = orig
            t_kdf.DEFAULT_PARAMS = orig

        muts.append(Mutation(
            mutation_id="MUT-KDF-06",
            category=MutationCategory.KDF_SALT,
            gate_reference="Gate T16.4",
            target_component="kdf.DEFAULT_PARAMS",
            description="DEFAULT_PARAMS downgraded below RFC 9106 memory hardness (1024 KiB vs 65536 KiB)",
            test_classes=[t_kdf.TestVaultKeyDerivation],
            apply_fn=apply_kdf_06,
            restore_fn=restore_kdf_06,
        ))

        # =====================================================================
        # DOMAIN 5: BYSTANDER BIOMETRIC DATA RETENTION & TTL (Gate T16.6)
        # =====================================================================
        # MUT-BYST-01: BystanderBiometricRecord.is_expired always returns False
        def apply_byst_01():
            orig = bystander_ttl.BystanderBiometricRecord.is_expired
            bystander_ttl.BystanderBiometricRecord.is_expired = lambda self, now=None, retention_seconds=bystander_ttl.DEFAULT_RETENTION_SECONDS: False
            t_byst.BystanderBiometricRecord.is_expired = bystander_ttl.BystanderBiometricRecord.is_expired
            return orig

        def restore_byst_01(orig):
            bystander_ttl.BystanderBiometricRecord.is_expired = orig
            t_byst.BystanderBiometricRecord.is_expired = orig

        muts.append(Mutation(
            mutation_id="MUT-BYST-01",
            category=MutationCategory.BYSTANDER_RETENTION,
            gate_reference="Gate T16.6",
            target_component="BystanderBiometricRecord.is_expired",
            description="BystanderBiometricRecord.is_expired returns False (retention TTL bypass)",
            test_classes=[t_byst.TestBystanderTTL],
            apply_fn=apply_byst_01,
            restore_fn=restore_byst_01,
        ))

        # MUT-BYST-02: Boundary condition off-by-one (> instead of >= at 30 days)
        def apply_byst_02():
            orig = bystander_ttl.BystanderBiometricRecord.is_expired
            def mutated_is_expired(self, now=None, retention_seconds=bystander_ttl.DEFAULT_RETENTION_SECONDS):
                current_time = now if now is not None else time.time()
                # DEFECT: Uses > instead of >= at the 30-day boundary
                return (current_time - self.captured_at) > retention_seconds
            bystander_ttl.BystanderBiometricRecord.is_expired = mutated_is_expired
            t_byst.BystanderBiometricRecord.is_expired = mutated_is_expired
            return orig

        def restore_byst_02(orig):
            bystander_ttl.BystanderBiometricRecord.is_expired = orig
            t_byst.BystanderBiometricRecord.is_expired = orig

        muts.append(Mutation(
            mutation_id="MUT-BYST-02",
            category=MutationCategory.BYSTANDER_RETENTION,
            gate_reference="Gate T16.6",
            target_component="BystanderBiometricRecord.is_expired",
            description="BystanderBiometricRecord.is_expired uses > instead of >= at exact 30-day boundary",
            test_classes=[t_byst.TestBystanderTTL],
            apply_fn=apply_byst_02,
            restore_fn=restore_byst_02,
        ))

        # MUT-BYST-03: Read-time expiration gating omitted in BystanderBiometricStore.get
        def apply_byst_03():
            orig = bystander_ttl.BystanderBiometricStore.get
            def mutated_get(self, speaker_uuid: str, now=None):
                # DEFECT: Returns record without checking is_expired
                return self._records.get(speaker_uuid)
            bystander_ttl.BystanderBiometricStore.get = mutated_get
            t_byst.BystanderBiometricStore.get = mutated_get
            return orig

        def restore_byst_03(orig):
            bystander_ttl.BystanderBiometricStore.get = orig
            t_byst.BystanderBiometricStore.get = orig

        muts.append(Mutation(
            mutation_id="MUT-BYST-03",
            category=MutationCategory.BYSTANDER_RETENTION,
            gate_reference="Gate T16.6",
            target_component="BystanderBiometricStore.get",
            description="BystanderBiometricStore.get omits read-time TTL check (serves unpurged expired data)",
            test_classes=[t_byst.TestBystanderTTL],
            apply_fn=apply_byst_03,
            restore_fn=restore_byst_03,
        ))

        # MUT-BYST-04: Wearer data accepted into bystander store
        def apply_byst_04():
            orig = bystander_ttl.BystanderBiometricStore.add
            def mutated_add(self, record):
                # DEFECT: Do not reject wearer data
                self._records[record.speaker_uuid] = record
            bystander_ttl.BystanderBiometricStore.add = mutated_add
            t_byst.BystanderBiometricStore.add = mutated_add
            t_tott.BystanderBiometricStore.add = mutated_add
            return orig

        def restore_byst_04(orig):
            bystander_ttl.BystanderBiometricStore.add = orig
            t_byst.BystanderBiometricStore.add = orig
            t_tott.BystanderBiometricStore.add = orig

        muts.append(Mutation(
            mutation_id="MUT-BYST-04",
            category=MutationCategory.BYSTANDER_RETENTION,
            gate_reference="Gate T16.6 / Rule H1.2",
            target_component="BystanderBiometricStore.add",
            description="BystanderBiometricStore.add accepts wearer data (fails to raise WearerDataRejected)",
            test_classes=[t_byst.TestBystanderTTL, t_tott.TestOfTheTest],
            apply_fn=apply_byst_04,
            restore_fn=restore_byst_04,
        ))

        # MUT-BYST-05: Purge fails to cascade to secondary stores
        def apply_byst_05():
            orig = bystander_ttl.BystanderBiometricStore.purge_expired
            def mutated_purge(self, now=None):
                current_time = now if now is not None else time.time()
                expired_uuids = [
                    uuid for uuid, rec in self._records.items()
                    if rec.is_expired(now=current_time, retention_seconds=self.retention_seconds)
                ]
                purged = []
                for uuid in expired_uuids:
                    del self._records[uuid]
                    # DEFECT: Omit cascading deletions to self._alternate_stores!
                    purged.append(uuid)
                return purged
            bystander_ttl.BystanderBiometricStore.purge_expired = mutated_purge
            t_byst.BystanderBiometricStore.purge_expired = mutated_purge
            return orig

        def restore_byst_05(orig):
            bystander_ttl.BystanderBiometricStore.purge_expired = orig
            t_byst.BystanderBiometricStore.purge_expired = orig

        muts.append(Mutation(
            mutation_id="MUT-BYST-05",
            category=MutationCategory.BYSTANDER_RETENTION,
            gate_reference="Gate T16.6",
            target_component="BystanderBiometricStore.purge_expired",
            description="BystanderBiometricStore.purge_expired fails to cascade deletions to alternate stores",
            test_classes=[t_byst.TestBystanderTTL],
            apply_fn=apply_byst_05,
            restore_fn=restore_byst_05,
        ))

        # MUT-BYST-06: active_count reports raw record count
        def apply_byst_06():
            orig = bystander_ttl.BystanderBiometricStore.active_count
            bystander_ttl.BystanderBiometricStore.active_count = lambda self, now=None: self.raw_count()
            t_byst.BystanderBiometricStore.active_count = bystander_ttl.BystanderBiometricStore.active_count
            return orig

        def restore_byst_06(orig):
            bystander_ttl.BystanderBiometricStore.active_count = orig
            t_byst.BystanderBiometricStore.active_count = orig

        muts.append(Mutation(
            mutation_id="MUT-BYST-06",
            category=MutationCategory.BYSTANDER_RETENTION,
            gate_reference="Gate T16.6",
            target_component="BystanderBiometricStore.active_count",
            description="BystanderBiometricStore.active_count reports raw record count instead of active",
            test_classes=[t_byst.TestBystanderTTL],
            apply_fn=apply_byst_06,
            restore_fn=restore_byst_06,
        ))

        # MUT-BYST-07: DEFAULT_RETENTION_SECONDS altered to 90 days
        def apply_byst_07():
            orig = bystander_ttl.DEFAULT_RETENTION_SECONDS
            bystander_ttl.DEFAULT_RETENTION_SECONDS = 90 * 24 * 3600
            t_byst.DEFAULT_RETENTION_SECONDS = 90 * 24 * 3600
            return orig

        def restore_byst_07(orig):
            bystander_ttl.DEFAULT_RETENTION_SECONDS = orig
            t_byst.DEFAULT_RETENTION_SECONDS = orig

        muts.append(Mutation(
            mutation_id="MUT-BYST-07",
            category=MutationCategory.BYSTANDER_RETENTION,
            gate_reference="Gate T16.6",
            target_component="bystander_ttl.DEFAULT_RETENTION_SECONDS",
            description="DEFAULT_RETENTION_SECONDS altered to 90 days (violating 30-day requirement)",
            test_classes=[t_byst.TestBystanderTTL],
            apply_fn=apply_byst_07,
            restore_fn=restore_byst_07,
        ))

        # =====================================================================
        # DOMAIN 6: SPDX LICENSE CI GATE (Gate T16.7)
        # =====================================================================
        # MUT-LIC-01: Strong copyleft (GPL) treated as permissive
        def apply_lic_01():
            orig = license_gate.categorize_license
            def mutated_categorize(license_str: str):
                cleaned = (license_str or "").strip()
                if "GPL" in cleaned.upper():
                    # DEFECT: Strong copyleft treated as permissive
                    return "permissive", False
                return orig(license_str)
            license_gate.categorize_license = mutated_categorize
            t_lic.categorize_license = mutated_categorize
            t_tott.categorize_license = mutated_categorize
            return orig

        def restore_lic_01(orig):
            license_gate.categorize_license = orig
            t_lic.categorize_license = orig
            t_tott.categorize_license = orig

        muts.append(Mutation(
            mutation_id="MUT-LIC-01",
            category=MutationCategory.LICENSE_GATE,
            gate_reference="Gate T16.7 / Rule H1.2",
            target_component="license_gate.categorize_license",
            description="categorize_license permits strong copyleft (GPL-3.0) as permissive",
            test_classes=[t_lic.TestLicenseGate, t_tott.TestOfTheTest],
            apply_fn=apply_lic_01,
            restore_fn=restore_lic_01,
        ))

        # MUT-LIC-02: Non-commercial restriction treated as non-blocking
        def apply_lic_02():
            orig = license_gate.categorize_license
            def mutated_categorize(license_str: str):
                cleaned = (license_str or "").strip()
                if "audEERING-NC" in cleaned or "NC" in cleaned:
                    # DEFECT: Non-commercial restriction treated as non-blocking
                    return "noncommercial_restricted", False
                return orig(license_str)
            license_gate.categorize_license = mutated_categorize
            t_lic.categorize_license = mutated_categorize
            return orig

        def restore_lic_02(orig):
            license_gate.categorize_license = orig
            t_lic.categorize_license = orig

        muts.append(Mutation(
            mutation_id="MUT-LIC-02",
            category=MutationCategory.LICENSE_GATE,
            gate_reference="Gate T16.7",
            target_component="license_gate.categorize_license",
            description="categorize_license treats audEERING-NC non-commercial license as non-blocking",
            test_classes=[t_lic.TestLicenseGate],
            apply_fn=apply_lic_02,
            restore_fn=restore_lic_02,
        ))

        # MUT-LIC-03: Unknown license fails open instead of closed
        def apply_lic_03():
            orig = license_gate.categorize_license
            def mutated_categorize(license_str: str):
                category, is_blocking = orig(license_str)
                if category == "unknown_unverified":
                    # DEFECT: Fail open on unknown license
                    return category, False
                return category, is_blocking
            license_gate.categorize_license = mutated_categorize
            t_lic.categorize_license = mutated_categorize
            return orig

        def restore_lic_03(orig):
            license_gate.categorize_license = orig
            t_lic.categorize_license = orig

        muts.append(Mutation(
            mutation_id="MUT-LIC-03",
            category=MutationCategory.LICENSE_GATE,
            gate_reference="Gate T16.7",
            target_component="license_gate.categorize_license",
            description="categorize_license fails open on unknown licenses (is_blocking=False)",
            test_classes=[t_lic.TestLicenseGate],
            apply_fn=apply_lic_03,
            restore_fn=restore_lic_03,
        ))

        # MUT-LIC-04: check_manifest suppresses blocking violations
        def apply_lic_04():
            orig = license_gate.check_manifest
            def mutated_check(manifest):
                res = orig(manifest)
                # DEFECT: Always pass
                return license_gate.LicenseCheckResult(
                    passed=True,
                    violations=res.violations,
                    clean_packages=res.clean_packages,
                    warnings=res.warnings,
                )
            license_gate.check_manifest = mutated_check
            t_lic.check_manifest = mutated_check
            t_tott.check_manifest = mutated_check
            return orig

        def restore_lic_04(orig):
            license_gate.check_manifest = orig
            t_lic.check_manifest = orig
            t_tott.check_manifest = orig

        muts.append(Mutation(
            mutation_id="MUT-LIC-04",
            category=MutationCategory.LICENSE_GATE,
            gate_reference="Gate T16.7",
            target_component="license_gate.check_manifest",
            description="check_manifest ignores blocking violations and marks build as passed",
            test_classes=[t_lic.TestLicenseGate],
            apply_fn=apply_lic_04,
            restore_fn=restore_lic_04,
        ))

        # MUT-LIC-05: Permissive allowlist corrupted (rejects MIT as blocking)
        def apply_lic_05():
            orig = license_gate.categorize_license
            def mutated_categorize(license_str: str):
                if (license_str or "").strip() == "MIT":
                    return "unknown_unverified", True
                return orig(license_str)
            license_gate.categorize_license = mutated_categorize
            t_lic.categorize_license = mutated_categorize
            return orig

        def restore_lic_05(orig):
            license_gate.categorize_license = orig
            t_lic.categorize_license = orig

        muts.append(Mutation(
            mutation_id="MUT-LIC-05",
            category=MutationCategory.LICENSE_GATE,
            gate_reference="Gate T16.7",
            target_component="license_gate.categorize_license",
            description="categorize_license rejects permissive MIT license as blocking violation",
            test_classes=[t_lic.TestLicenseGate],
            apply_fn=apply_lic_05,
            restore_fn=restore_lic_05,
        ))

        return muts

    def execute_mutation(self, mutation: Mutation) -> MutationResult:
        """Inject a single mutation, run targeted test suite, capture killing result, and restore state."""
        start_time = time.perf_counter()
        token = mutation.apply_fn()
        try:
            # Build and run fresh test suite instance
            loader = unittest.TestLoader()
            suite = unittest.TestSuite()
            for tc in mutation.test_classes:
                suite.addTests(loader.loadTestsFromTestCase(tc))

            stream = io.StringIO()
            runner = unittest.TextTestRunner(stream=stream, verbosity=0)
            test_result = runner.run(suite)
            duration_ms = (time.perf_counter() - start_time) * 1000

            if not test_result.wasSuccessful():
                killer = None
                exc_msg = None
                if test_result.failures:
                    killer = test_result.failures[0][0].id()
                    exc_msg = test_result.failures[0][1].strip().splitlines()[-1]
                elif test_result.errors:
                    killer = test_result.errors[0][0].id()
                    exc_msg = test_result.errors[0][1].strip().splitlines()[-1]

                return MutationResult(
                    mutation_id=mutation.mutation_id,
                    category=mutation.category.value,
                    gate_reference=mutation.gate_reference,
                    target_component=mutation.target_component,
                    description=mutation.description,
                    status="KILLED",
                    killing_test=killer,
                    killer_exception=exc_msg,
                    duration_ms=duration_ms,
                )
            else:
                return MutationResult(
                    mutation_id=mutation.mutation_id,
                    category=mutation.category.value,
                    gate_reference=mutation.gate_reference,
                    target_component=mutation.target_component,
                    description=mutation.description,
                    status="SURVIVED",
                    duration_ms=duration_ms,
                )
        finally:
            mutation.restore_fn(token)

    def run_all(self) -> MutationReport:
        """Execute all registered mutations and produce comprehensive verification report."""
        results: List[MutationResult] = []
        for mut in self.mutations:
            res = self.execute_mutation(mut)
            results.append(res)

        total = len(results)
        killed = sum(1 for r in results if r.status == "KILLED")
        survived = sum(1 for r in results if r.status == "SURVIVED")
        score_pct = (killed / total) * 100.0 if total > 0 else 0.0
        rule_satisfied = (survived == 0) and (total > 0)

        return MutationReport(
            timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            total_mutants=total,
            killed_mutants=killed,
            survived_mutants=survived,
            mutation_score_pct=score_pct,
            rule_h1_2_satisfied=rule_satisfied,
            results=results,
        )

    def run_category(self, category: MutationCategory) -> List[MutationResult]:
        """Execute all mutations for a specific category."""
        results: List[MutationResult] = []
        for mut in self.mutations:
            if mut.category == category:
                results.append(self.execute_mutation(mut))
        return results


# =============================================================================
# UNITTEST INTEGRATION (Enforces Rule H1.2 in standard test runs)
# =============================================================================

class TestMutationVerification(unittest.TestCase):
    """Test case enforcing Rule H1.2 defect reintroduction across all Trust Boundaries."""

    @classmethod
    def setUpClass(cls):
        cls.harness = MutationHarness()

    def test_gate_t16_1_isolation_mutations_killed(self):
        """Verify 100% of Isolation Boundary mutations are killed."""
        results = self.harness.run_category(MutationCategory.ISOLATION)
        self.assertGreater(len(results), 0)
        survived = [r for r in results if r.status != "KILLED"]
        self.assertEqual(
            len(survived), 0,
            f"Rule H1.2 violation: {len(survived)} isolation mutant(s) survived: {[s.mutation_id for s in survived]}"
        )

    def test_gate_t16_2_session_key_ttl_mutations_killed(self):
        """Verify 100% of Session Key TTL mutations are killed."""
        results = self.harness.run_category(MutationCategory.SESSION_KEY_TTL)
        self.assertGreater(len(results), 0)
        survived = [r for r in results if r.status != "KILLED"]
        self.assertEqual(
            len(survived), 0,
            f"Rule H1.2 violation: {len(survived)} session key TTL mutant(s) survived: {[s.mutation_id for s in survived]}"
        )

    def test_gate_t16_3_ram_zero_fill_mutations_killed(self):
        """Verify 100% of RAM Zero-Fill mutations are killed."""
        results = self.harness.run_category(MutationCategory.ZERO_FILL)
        self.assertGreater(len(results), 0)
        survived = [r for r in results if r.status != "KILLED"]
        self.assertEqual(
            len(survived), 0,
            f"Rule H1.2 violation: {len(survived)} zero-fill mutant(s) survived: {[s.mutation_id for s in survived]}"
        )

    def test_gate_t16_4_kdf_salt_validation_mutations_killed(self):
        """Verify 100% of Argon2id KDF & salt validation mutations are killed."""
        results = self.harness.run_category(MutationCategory.KDF_SALT)
        self.assertGreater(len(results), 0)
        survived = [r for r in results if r.status != "KILLED"]
        self.assertEqual(
            len(survived), 0,
            f"Rule H1.2 violation: {len(survived)} KDF mutant(s) survived: {[s.mutation_id for s in survived]}"
        )

    def test_gate_t16_6_bystander_retention_mutations_killed(self):
        """Verify 100% of Bystander Biometric TTL & Purge mutations are killed."""
        results = self.harness.run_category(MutationCategory.BYSTANDER_RETENTION)
        self.assertGreater(len(results), 0)
        survived = [r for r in results if r.status != "KILLED"]
        self.assertEqual(
            len(survived), 0,
            f"Rule H1.2 violation: {len(survived)} bystander retention mutant(s) survived: {[s.mutation_id for s in survived]}"
        )

    def test_gate_t16_7_license_gate_mutations_killed(self):
        """Verify 100% of SPDX License Gate mutations are killed."""
        results = self.harness.run_category(MutationCategory.LICENSE_GATE)
        self.assertGreater(len(results), 0)
        survived = [r for r in results if r.status != "KILLED"]
        self.assertEqual(
            len(survived), 0,
            f"Rule H1.2 violation: {len(survived)} license gate mutant(s) survived: {[s.mutation_id for s in survived]}"
        )

    def test_rule_h1_2_comprehensive_matrix_zero_survivors(self):
        """Verify complete 31-mutant matrix achieves exactly 100% kill rate."""
        report = self.harness.run_all()
        self.assertEqual(report.survived_mutants, 0, f"{report.survived_mutants} mutants survived!")
        self.assertEqual(report.mutation_score_pct, 100.0)
        self.assertTrue(report.rule_h1_2_satisfied)


# =============================================================================
# CLI EXECUTION & REPORTING
# =============================================================================

def print_text_table(report: MutationReport) -> None:
    print("\n" + "=" * 105)
    print("           CHRONIS AI/ML SPRINT 16 — MUTATION TESTING SUITE (RULE H1.2)")
    print("=" * 105)
    header = f"{'ID':<12} | {'GATE':<12} | {'DOMAIN':<22} | {'STATUS':<9} | {'KILLER TEST':<40}"
    print(header)
    print("-" * 105)

    for r in report.results:
        killer_short = r.killing_test.split(".")[-1] if r.killing_test else "NONE"
        status_str = f"[{r.status}]"
        print(f"{r.mutation_id:<12} | {r.gate_reference.split('/')[0].strip():<12} | {r.category:<22} | {status_str:<9} | {killer_short:<40}")
        if r.status == "KILLED":
            print(f"   Details: {r.description}")
            print(f"   Caught:  {r.killer_exception}")
        else:
            print(f"   SURVIVED DEFECT: {r.description}")

    print("-" * 105)
    print(
        f"TOTAL MUTANTS: {report.total_mutants:2d}  |  "
        f"KILLED: {report.killed_mutants:2d}  |  "
        f"SURVIVED: {report.survived_mutants:2d}  |  "
        f"MUTATION SCORE: {report.mutation_score_pct:.2f}%  |  "
        f"RULE H1.2: {'SATISFIED' if report.rule_h1_2_satisfied else 'FAILED'}"
    )
    print("=" * 105 + "\n")


def main() -> int:
    harness = MutationHarness()
    report = harness.run_all()
    print_text_table(report)

    # Save artifact report
    report_file = PROJECT_ROOT / "sprint16_mutation_report.json"
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(report.to_dict(), f, indent=2)
    print(f"Saved machine-readable mutation report to: {report_file}")

    return 0 if report.rule_h1_2_satisfied else 1


if __name__ == "__main__":
    sys.exit(main())
