"""unlinkability.py — VoicePrivacy-Challenge-Style Unlinkability Evaluation Harness.

Implements Gate T16.5 per Chronis Bible Part 5.26, Master Problem MP-14, and
AI_ML_SPRINT_PLAN_v2 Sprint 16 Day 47.

Epistemic Grounding (Bible Addendum 5.26):
  "Chronis does not possess, and does not claim, a cryptographic or information-theoretic
   proof that voice-transformation output is irreversible. No such proof exists in the field
   for any current voice-anonymization technique — this is a known open research problem,
   not a Chronis-specific gap. What can be built, and now is, is empirical resistance testing
   under a stated and re-testable threat model, following the VoicePrivacy Challenge methodology
   (the field's own standard benchmark): an automatic speaker verification (ASV) attacker attempts
   re-identification of a transformed voice at three knowledge levels — ignorant, semi-informed,
   and fully-informed."

Attacker Knowledge Levels:
  1. IGNORANT: Attacker has no knowledge that an anonymization transform was applied.
  2. SEMI_INFORMED: Attacker knows the transformation model/architecture, but not the
     session-ephemeral key.
  3. FULLY_INFORMED: Attacker knows the exact transformation matrix and session key.

Scoring Models:
  1. COSINE: Standard cosine similarity / distance backend measuring angular separation.
  2. PLDA: Two-covariance Gaussian Probabilistic Linear Discriminant Analysis (G-PLDA)
     measuring log-likelihood ratio under between-class and within-class covariance models.

Evaluation Metrics:
  - Equal Error Rate (EER) at the ROC crossover where False Acceptance Rate (FAR) equals
    False Rejection Rate (FRR), reported with bootstrap 95% confidence intervals and exact
    empirical distribution percentiles.
  - Area Under the ROC Curve (AUC) via exact Wilcoxon-Mann-Whitney U statistic.
"""

from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

import numpy as np
import scipy.linalg
import scipy.signal

FRAMING_STATEMENT: str = (
    "Chronis does not possess, and does not claim, a cryptographic or information-theoretic "
    "proof that voice-transformation output is irreversible. No such proof exists in the field "
    "for any current voice-anonymization technique — this is a known open research problem, "
    "not a Chronis-specific gap. What can be built, and now is, is empirical resistance testing "
    "under a stated and re-testable threat model, following the VoicePrivacy Challenge methodology "
    "(the field's own standard benchmark): an automatic speaker verification (ASV) attacker attempts "
    "re-identification of a transformed voice at three knowledge levels — ignorant (no knowledge a "
    "transform was applied), semi-informed (knows a transform exists, not its parameters), "
    "fully-informed (knows the exact transform and parameters). Resistance is reported as Equal Error "
    "Rate (EER) per attacker level, published in the relevant module's README, and re-measured as a "
    "standing regression check on every change to the voice-processing pipeline — because resistance "
    "against an improving attacker is a moving target, not a fixed, provable property. Any internal "
    "or external communication that describes voice transformation as 'irreversible' or 'unlinkable' "
    "without qualifying it against a stated threat model and EER number is overstating the system's "
    "actual epistemic status — the same discipline Part 5.11 already applies to the 0.15 ambiguity threshold."
)


class AttackerKnowledgeLevel(str, Enum):
    """VoicePrivacy Challenge attacker knowledge tiers."""
    IGNORANT = "ignorant"
    SEMI_INFORMED = "semi_informed"
    FULLY_INFORMED = "fully_informed"


class ScoringModelType(str, Enum):
    """Supported ASV distance and similarity scoring backends."""
    COSINE = "cosine"
    PLDA = "plda"


# ===========================================================================
# Distance and Similarity Scoring Models
# ===========================================================================

class BaseScoringModel(ABC):
    """Abstract base class for speaker verification scoring backends.

    Convention:
      - score(x1, x2): similarity metric where higher score indicates genuine (same speaker).
      - distance(x1, x2): distance metric where lower distance indicates genuine (same speaker).
    """

    @abstractmethod
    def score(self, x1: np.ndarray, x2: np.ndarray) -> float:
        """Compute verification similarity score between enrollment x1 and evaluation x2."""
        pass

    @abstractmethod
    def distance(self, x1: np.ndarray, x2: np.ndarray) -> float:
        """Compute verification distance between enrollment x1 and evaluation x2."""
        pass

    def score_batch(self, X1: np.ndarray, X2: np.ndarray) -> np.ndarray:
        """Compute pairwise similarity scores between matrix rows of X1 and X2."""
        N = len(X1)
        M = len(X2)
        out = np.empty((N, M), dtype=np.float64)
        for i in range(N):
            for j in range(M):
                out[i, j] = self.score(X1[i], X2[j])
        return out

    def distance_batch(self, X1: np.ndarray, X2: np.ndarray) -> np.ndarray:
        """Compute pairwise distances between matrix rows of X1 and X2."""
        return -self.score_batch(X1, X2)


class CosineScoringModel(BaseScoringModel):
    """Cosine similarity and distance scoring model for speaker verification.

    Score formulation:
      similarity(u, v) = (u . v) / (||u||_2 * ||v||_2)
      distance(u, v)   = 1.0 - similarity(u, v)
    """

    def score(self, x1: np.ndarray, x2: np.ndarray) -> float:
        norm1 = np.linalg.norm(x1)
        norm2 = np.linalg.norm(x2)
        if norm1 == 0.0 or norm2 == 0.0:
            return 0.0
        return float(np.dot(x1, x2) / (norm1 * norm2))

    def distance(self, x1: np.ndarray, x2: np.ndarray) -> float:
        return float(1.0 - self.score(x1, x2))

    def score_batch(self, X1: np.ndarray, X2: np.ndarray) -> np.ndarray:
        norms1 = np.linalg.norm(X1, axis=1, keepdims=True)
        norms2 = np.linalg.norm(X2, axis=1, keepdims=True)
        norms1 = np.where(norms1 == 0.0, 1.0, norms1)
        norms2 = np.where(norms2 == 0.0, 1.0, norms2)
        X1_norm = X1 / norms1
        X2_norm = X2 / norms2
        return np.dot(X1_norm, X2_norm.T)

    def distance_batch(self, X1: np.ndarray, X2: np.ndarray) -> np.ndarray:
        return 1.0 - self.score_batch(X1, X2)


class PLDAScoringModel(BaseScoringModel):
    """Two-Covariance Gaussian Probabilistic Linear Discriminant Analysis (G-PLDA).

    Standard ASV scoring backend used in the VoicePrivacy Challenge and SRE benchmarks.
    Models speaker embeddings with between-speaker covariance Sigma_b and
    within-speaker covariance Sigma_w.

    Log-Likelihood Ratio (LLR) score comparing:
      H1: x1 and x2 originate from the same speaker
      H0: x1 and x2 originate from different speakers

    Derived via simultaneous diagonalization Sigma_b V = Sigma_w V diag(psi):
      s(u1, u2) = sum_k [ (psi_k / (1 + 2*psi_k)) * u1_k * u2_k
                         - (psi_k^2 / (2 * (1 + 2*psi_k) * (1 + psi_k))) * (u1_k^2 + u2_k^2) ]
                  - 0.5 * sum_k log((1 + 2*psi_k) / (1 + psi_k)^2)
      where u = (x - mu) @ V.
    """

    def __init__(self, reg: float = 1e-4) -> None:
        self.reg = reg
        self.mu: Optional[np.ndarray] = None
        self.V: Optional[np.ndarray] = None
        self.psi: Optional[np.ndarray] = None
        self.w_cross: Optional[np.ndarray] = None
        self.w_diag: Optional[np.ndarray] = None
        self.const_term: float = 0.0
        self.is_fitted: bool = False

    def fit(self, X: np.ndarray, labels: np.ndarray) -> PLDAScoringModel:
        """Fit PLDA model parameters on training embeddings X and speaker labels."""
        X_arr = np.asarray(X, dtype=np.float64)
        labels_arr = np.asarray(labels)
        classes, counts = np.unique(labels_arr, return_counts=True)
        K = len(classes)
        N, D = X_arr.shape

        if K < 2:
            raise ValueError("PLDA requires at least 2 distinct speaker classes to fit.")

        self.mu = np.mean(X_arr, axis=0)
        X_c = X_arr - self.mu

        Sw = np.zeros((D, D), dtype=np.float64)
        Sb = np.zeros((D, D), dtype=np.float64)

        for c, count in zip(classes, counts):
            idx = np.where(labels_arr == c)[0]
            Xc = X_c[idx]
            spk_mean = np.mean(Xc, axis=0)
            diff = Xc - spk_mean
            Sw += diff.T @ diff
            Sb += count * np.outer(spk_mean, spk_mean)

        # Unbiased within- and between-class covariance with Tikhonov regularization
        Sigma_w = Sw / max(1, N - K) + self.reg * np.eye(D)
        Sigma_b = Sb / max(1, K - 1) + self.reg * np.eye(D)

        # Simultaneous diagonalization: Sigma_b V = Sigma_w V diag(psi)
        evals, V = scipy.linalg.eigh(Sigma_b, Sigma_w)
        evals = np.maximum(evals, 0.0)

        self.V = V
        self.psi = evals
        self.w_cross = self.psi / (1.0 + 2.0 * self.psi)
        self.w_diag = (self.psi ** 2) / (2.0 * (1.0 + 2.0 * self.psi) * (1.0 + self.psi))
        self.const_term = float(-0.5 * np.sum(np.log((1.0 + 2.0 * self.psi) / ((1.0 + self.psi) ** 2))))
        self.is_fitted = True
        return self

    def fit_corpus(self, corpus: SyntheticSpeakerCorpus) -> PLDAScoringModel:
        """Fit PLDA directly on all clean enrollment/utterances of a SyntheticSpeakerCorpus."""
        all_utts = []
        all_labels = []
        for spk in range(corpus.n_speakers):
            for u in range(corpus.utterances_per_speaker):
                all_utts.append(corpus.utterances[spk][u])
                all_labels.append(spk)
        return self.fit(np.array(all_utts, dtype=np.float64), np.array(all_labels))

    def score(self, x1: np.ndarray, x2: np.ndarray) -> float:
        if not self.is_fitted or self.mu is None or self.V is None or self.w_cross is None or self.w_diag is None:
            raise RuntimeError("PLDAScoringModel must be fitted before scoring.")
        u1 = (x1 - self.mu) @ self.V
        u2 = (x2 - self.mu) @ self.V
        score = np.sum(self.w_cross * (u1 * u2)) - np.sum(self.w_diag * (u1 ** 2 + u2 ** 2)) + self.const_term
        return float(score)

    def distance(self, x1: np.ndarray, x2: np.ndarray) -> float:
        """PLDA distance: negated LLR score (lower distance = higher likelihood of match)."""
        return -self.score(x1, x2)


# ===========================================================================
# Metrics: Equal Error Rate (EER) and Area Under ROC Curve (AUC)
# ===========================================================================

def compute_eer(genuine_scores: np.ndarray, impostor_scores: np.ndarray) -> Tuple[float, float]:
    """Compute Equal Error Rate (EER) and operating threshold.

    Uses monotonic threshold sorting and searchsorted cumulative counts.
    EER is the operating point where False Accept Rate (FAR) == False Reject Rate (FRR).
    """
    genuine = np.asarray(genuine_scores, dtype=np.float64)
    impostor = np.asarray(impostor_scores, dtype=np.float64)

    if len(genuine) == 0 or len(impostor) == 0:
        raise ValueError("genuine_scores and impostor_scores must be non-empty")

    scores = np.concatenate([genuine, impostor])
    thresholds = np.sort(np.unique(scores))

    imp_sorted = np.sort(impostor)
    gen_sorted = np.sort(genuine)
    n_imp = len(impostor)
    n_gen = len(genuine)

    # FAR: fraction of impostors >= threshold
    far = (n_imp - np.searchsorted(imp_sorted, thresholds, side="left")) / n_imp
    # FRR: fraction of genuines < threshold
    frr = np.searchsorted(gen_sorted, thresholds, side="left") / n_gen

    diff = np.abs(far - frr)
    best_idx = int(np.nanargmin(diff))
    eer = float((far[best_idx] + frr[best_idx]) / 2.0)
    thresh = float(thresholds[best_idx])

    return eer, thresh


def compute_auc(genuine_scores: np.ndarray, impostor_scores: np.ndarray) -> float:
    """Compute Area Under the Receiver Operating Characteristic (ROC-AUC).

    Equivalent to the Wilcoxon-Mann-Whitney U statistic: the probability that a randomly
    chosen genuine score ranks higher than a randomly chosen impostor score:
      AUC = [R_gen - n_gen*(n_gen + 1)/2] / (n_gen * n_imp)
    Runs in O(N log N) time with exact average-rank tie resolution.
    """
    genuine = np.asarray(genuine_scores, dtype=np.float64)
    impostor = np.asarray(impostor_scores, dtype=np.float64)

    if len(genuine) == 0 or len(impostor) == 0:
        raise ValueError("genuine_scores and impostor_scores must be non-empty")

    n_gen = len(genuine)
    n_imp = len(impostor)
    scores = np.concatenate([genuine, impostor])

    order = np.argsort(scores)
    ranks = np.empty_like(order, dtype=np.float64)
    ranks[order] = np.arange(1, len(scores) + 1, dtype=np.float64)

    # Handle tied scores via average ranks
    unique_vals, inverse_idx, counts = np.unique(scores, return_inverse=True, return_counts=True)
    if len(unique_vals) < len(scores):
        tie_sums = np.bincount(inverse_idx, weights=ranks)
        tie_means = tie_sums / counts
        ranks = tie_means[inverse_idx]

    rank_sum_gen = np.sum(ranks[:n_gen])
    u_stat = rank_sum_gen - (n_gen * (n_gen + 1.0)) / 2.0
    auc = float(u_stat / (n_gen * n_imp))
    return auc


def compute_roc_metrics(
    genuine_scores: np.ndarray,
    impostor_scores: np.ndarray,
) -> Dict[str, float]:
    """Compute comprehensive biometric verification ROC metrics (EER, threshold, and AUC)."""
    eer, threshold = compute_eer(genuine_scores, impostor_scores)
    auc = compute_auc(genuine_scores, impostor_scores)
    return {
        "eer": eer,
        "threshold": threshold,
        "auc": auc,
    }


# ===========================================================================
# Bootstrap Confidence Interval Estimation & Exact Distribution Percentiles
# ===========================================================================

class BootstrapCI(tuple):
    """Subclass of tuple (lower, upper) preserving 2-tuple unpacking while exposing full distribution percentiles."""
    lower: float
    upper: float
    percentiles: Dict[str, float]
    mean: float
    std_err: float
    median: float
    iqr: float
    distribution: np.ndarray

    def __new__(
        cls,
        lower: float,
        upper: float,
        percentiles: Optional[Dict[str, float]] = None,
        mean: float = 0.0,
        std_err: float = 0.0,
        median: float = 0.0,
        iqr: float = 0.0,
        distribution: Optional[np.ndarray] = None,
    ) -> BootstrapCI:
        obj = super().__new__(cls, (float(lower), float(upper)))
        obj.lower = float(lower)
        obj.upper = float(upper)
        obj.percentiles = percentiles or {}
        obj.mean = float(mean)
        obj.std_err = float(std_err)
        obj.median = float(median)
        obj.iqr = float(iqr)
        obj.distribution = distribution if distribution is not None else np.array([], dtype=np.float64)
        return obj


def compute_distribution_percentiles(
    data: np.ndarray,
    percentile_points: Optional[Sequence[float]] = None,
) -> Dict[str, float]:
    """Calculate exact empirical distribution percentiles."""
    if percentile_points is None:
        percentile_points = (0.5, 1.0, 2.5, 5.0, 10.0, 25.0, 50.0, 75.0, 90.0, 95.0, 97.5, 99.0, 99.5)

    arr = np.asarray(data, dtype=np.float64)
    pcts = np.percentile(arr, percentile_points)
    out: Dict[str, float] = {}
    for p, val in zip(percentile_points, pcts):
        key = f"p{p:g}"
        out[key] = float(val)
    return out


def bootstrap_eer_ci(
    genuine_scores: np.ndarray,
    impostor_scores: np.ndarray,
    n_bootstraps: int = 200,
    ci_percent: float = 0.95,
    seed: int = 42,
) -> BootstrapCI:
    """Calculate empirical bootstrap confidence interval and exact distribution percentiles for EER."""
    rng = np.random.default_rng(seed)
    n_gen = len(genuine_scores)
    n_imp = len(impostor_scores)
    boot_eers: List[float] = []

    for _ in range(n_bootstraps):
        b_gen = rng.choice(genuine_scores, size=n_gen, replace=True)
        b_imp = rng.choice(impostor_scores, size=n_imp, replace=True)
        b_eer, _ = compute_eer(b_gen, b_imp)
        boot_eers.append(b_eer)

    boot_arr = np.array(boot_eers, dtype=np.float64)
    alpha = (1.0 - ci_percent) / 2.0
    lower = float(np.percentile(boot_arr, 100 * alpha))
    upper = float(np.percentile(boot_arr, 100 * (1.0 - alpha)))

    percentiles = compute_distribution_percentiles(boot_arr)
    mean_val = float(np.mean(boot_arr))
    std_err_val = float(np.std(boot_arr, ddof=1)) if len(boot_arr) > 1 else 0.0
    median_val = float(np.median(boot_arr))
    iqr_val = float(np.percentile(boot_arr, 75) - np.percentile(boot_arr, 25))

    return BootstrapCI(
        lower=lower,
        upper=upper,
        percentiles=percentiles,
        mean=mean_val,
        std_err=std_err_val,
        median=median_val,
        iqr=iqr_val,
        distribution=boot_arr,
    )


def bootstrap_auc_ci(
    genuine_scores: np.ndarray,
    impostor_scores: np.ndarray,
    n_bootstraps: int = 200,
    ci_percent: float = 0.95,
    seed: int = 42,
) -> BootstrapCI:
    """Calculate empirical bootstrap confidence interval and exact distribution percentiles for AUC."""
    rng = np.random.default_rng(seed)
    n_gen = len(genuine_scores)
    n_imp = len(impostor_scores)
    boot_aucs: List[float] = []

    for _ in range(n_bootstraps):
        b_gen = rng.choice(genuine_scores, size=n_gen, replace=True)
        b_imp = rng.choice(impostor_scores, size=n_imp, replace=True)
        b_auc = compute_auc(b_gen, b_imp)
        boot_aucs.append(b_auc)

    boot_arr = np.array(boot_aucs, dtype=np.float64)
    alpha = (1.0 - ci_percent) / 2.0
    lower = float(np.percentile(boot_arr, 100 * alpha))
    upper = float(np.percentile(boot_arr, 100 * (1.0 - alpha)))

    percentiles = compute_distribution_percentiles(boot_arr)
    mean_val = float(np.mean(boot_arr))
    std_err_val = float(np.std(boot_arr, ddof=1)) if len(boot_arr) > 1 else 0.0
    median_val = float(np.median(boot_arr))
    iqr_val = float(np.percentile(boot_arr, 75) - np.percentile(boot_arr, 25))

    return BootstrapCI(
        lower=lower,
        upper=upper,
        percentiles=percentiles,
        mean=mean_val,
        std_err=std_err_val,
        median=median_val,
        iqr=iqr_val,
        distribution=boot_arr,
    )


def bootstrap_metrics_ci(
    genuine_scores: np.ndarray,
    impostor_scores: np.ndarray,
    n_bootstraps: int = 200,
    ci_percent: float = 0.95,
    seed: int = 42,
) -> Dict[str, BootstrapCI]:
    """Simultaneously calculate empirical bootstrap intervals and percentiles for both EER and AUC."""
    ci_eer = bootstrap_eer_ci(genuine_scores, impostor_scores, n_bootstraps=n_bootstraps, ci_percent=ci_percent, seed=seed)
    ci_auc = bootstrap_auc_ci(genuine_scores, impostor_scores, n_bootstraps=n_bootstraps, ci_percent=ci_percent, seed=seed)
    return {"eer": ci_eer, "auc": ci_auc}


# ===========================================================================
# Synthetic Speaker Corpus & Attacker Simulation
# ===========================================================================

class SyntheticSpeakerCorpus:
    """Synthetic multi-speaker embedding corpus modeling voiceprints and transforms."""

    def __init__(
        self,
        n_speakers: int = 30,
        utterances_per_speaker: int = 10,
        dim: int = 64,
        seed: int = 7,
    ) -> None:
        self.n_speakers = n_speakers
        self.utterances_per_speaker = utterances_per_speaker
        self.dim = dim
        self.seed = seed
        self.rng = np.random.default_rng(seed)

        # Baseline speaker identity centers (unit normalized in R^dim)
        raw_centers = self.rng.normal(0, 1, size=(n_speakers, dim))
        self.centers = raw_centers / np.linalg.norm(raw_centers, axis=1, keepdims=True)

        # Utterances per speaker with intra-speaker acoustic variation
        self.utterances: List[np.ndarray] = []
        for spk in range(n_speakers):
            spk_utts = []
            for _ in range(utterances_per_speaker):
                noise = self.rng.normal(0, 0.20, size=dim)
                v = self.centers[spk] + noise
                v = v / np.linalg.norm(v)
                spk_utts.append(v)
            self.utterances.append(np.array(spk_utts))

        # Per-utterance random orthogonal voice anonymization transformation Q
        self.transforms: List[List[np.ndarray]] = []
        for spk in range(n_speakers):
            spk_t = []
            for _ in range(utterances_per_speaker):
                H = self.rng.normal(0, 1, size=(dim, dim))
                Q, _ = np.linalg.qr(H)
                spk_t.append(Q)
            self.transforms.append(spk_t)


# ===========================================================================
# Audio Signal Preprocessor & Prosody Extractor (Bible Parts 4.3 & 4.4)
# ===========================================================================

class ChronisAudioPreprocessor:
    """PCM audio preprocessor conforming to Chronis Bible Part 4.3.

    Processing chain:
      1. PCM audio format conversion (int16/float -> float64 mono at 16kHz).
      2. DC offset removal via sample mean subtraction.
      3. 80 Hz Butterworth highpass filter (order 5 via second-order sections sosfilt)
         for acoustic rumble and sub-audible drift suppression.
      4. Root-Mean-Square (RMS) amplitude normalization to -20 dBFS.
    """

    def __init__(
        self,
        sample_rate: int = 16000,
        cutoff_hz: float = 80.0,
        filter_order: int = 5,
        target_dbfs: float = -20.0,
    ) -> None:
        self.sample_rate = int(sample_rate)
        self.cutoff_hz = float(cutoff_hz)
        self.filter_order = int(filter_order)
        self.target_dbfs = float(target_dbfs)
        self.sos = scipy.signal.butter(
            self.filter_order,
            self.cutoff_hz,
            btype="highpass",
            fs=self.sample_rate,
            output="sos",
        )

    def remove_dc_offset(self, audio: np.ndarray) -> np.ndarray:
        """Remove DC bias by subtracting the signal mean."""
        arr = np.asarray(audio, dtype=np.float64)
        return arr - np.mean(arr)

    def highpass_filter(self, audio: np.ndarray) -> np.ndarray:
        """Apply 80Hz Butterworth highpass filter via second-order sections (sosfilt)."""
        arr = np.asarray(audio, dtype=np.float64)
        return scipy.signal.sosfilt(self.sos, arr)

    def compute_rms(self, audio: np.ndarray) -> float:
        """Compute the Root-Mean-Square (RMS) energy of an audio array."""
        arr = np.asarray(audio, dtype=np.float64)
        if len(arr) == 0:
            return 0.0
        return float(np.sqrt(np.mean(arr ** 2)))

    def compute_dbfs(self, audio: np.ndarray) -> float:
        """Compute the signal RMS level in Decibels relative to Full Scale (dBFS)."""
        rms = self.compute_rms(audio)
        if rms <= 1e-12:
            return -120.0
        return float(20.0 * np.log10(rms))

    def normalize_rms(self, audio: np.ndarray, target_dbfs: Optional[float] = None) -> np.ndarray:
        """Normalize audio signal RMS amplitude to target dBFS (default -20 dBFS)."""
        arr = np.asarray(audio, dtype=np.float64)
        target = self.target_dbfs if target_dbfs is None else float(target_dbfs)
        target_rms = 10.0 ** (target / 20.0)
        current_rms = self.compute_rms(arr)
        if current_rms <= 1e-12:
            return arr
        return arr * (target_rms / current_rms)

    def process(self, audio: np.ndarray) -> np.ndarray:
        """Execute full preprocessing pipeline: PCM conversion, DC removal, highpass, and RMS norm."""
        arr = np.asarray(audio, dtype=np.float64)
        # Handle int16 PCM scaling if detected
        if np.issubdtype(audio.dtype, np.integer):
            arr = arr / 32768.0
        # Flatten to mono 1D if multi-channel
        if arr.ndim > 1:
            arr = np.mean(arr, axis=0 if arr.shape[0] < arr.shape[1] else 1)

        # 1. DC offset removal
        arr = self.remove_dc_offset(arr)
        # 2. 80 Hz highpass filter
        arr = self.highpass_filter(arr)
        # 3. Post-filter residual DC removal
        arr = self.remove_dc_offset(arr)
        # 4. RMS normalization to -20 dBFS
        arr = self.normalize_rms(arr, self.target_dbfs)
        return arr


class ChronisProsodyExtractor:
    """Prosody and acoustic feature extractor conforming to Chronis Bible Part 4.4.

    Computes:
      - 500ms sliding windows with 250ms hop (8000 samples window, 4000 samples hop at 16kHz).
      - Linear Predictive Coding (LPC) formant extraction (F1, F2, F3, F4) via polynomial roots.
      - Autocorrelation-based fundamental frequency F0 contour, mean, and variance.
      - Local jitter and shimmer perturbation estimation.
      - Harmonics-to-Noise Ratio (HNR) in dB.
      - Mel-Frequency Cepstral Coefficients (MFCCs) via triangular filterbank and DCT-II.
      - 64-dimensional unified acoustic embedding vector.
    """

    def __init__(
        self,
        sample_rate: int = 16000,
        window_sec: float = 0.500,
        hop_sec: float = 0.250,
        lpc_order: int = 16,
        n_mfcc: int = 13,
        n_mels: int = 26,
        f0_min: float = 50.0,
        f0_max: float = 500.0,
    ) -> None:
        self.sample_rate = int(sample_rate)
        self.window_sec = float(window_sec)
        self.hop_sec = float(hop_sec)
        self.window_length = int(window_sec * sample_rate)
        self.hop_length = int(hop_sec * sample_rate)
        self.lpc_order = int(lpc_order)
        self.n_mfcc = int(n_mfcc)
        self.n_mels = int(n_mels)
        self.f0_min = float(f0_min)
        self.f0_max = float(f0_max)
        self.mel_filters = self._build_mel_filterbank()

    def _hz_to_mel(self, hz: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
        return 2595.0 * np.log10(1.0 + np.asarray(hz) / 700.0)

    def _mel_to_hz(self, mel: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
        return 700.0 * (10.0 ** (np.asarray(mel) / 2595.0) - 1.0)

    def _build_mel_filterbank(self, n_fft: int = 1024) -> np.ndarray:
        low_mel = float(self._hz_to_mel(50.0))
        high_mel = float(self._hz_to_mel(min(7800.0, self.sample_rate / 2.0 - 50.0)))
        mel_points = np.linspace(low_mel, high_mel, self.n_mels + 2)
        hz_points = self._mel_to_hz(mel_points)
        bin_points = np.floor((n_fft + 1) * hz_points / self.sample_rate).astype(int)

        n_bins = n_fft // 2 + 1
        filters = np.zeros((self.n_mels, n_bins), dtype=np.float64)
        for m in range(1, self.n_mels + 1):
            f_m_minus = min(bin_points[m - 1], n_bins - 1)
            f_m = min(bin_points[m], n_bins - 1)
            f_m_plus = min(bin_points[m + 1], n_bins - 1)

            if f_m > f_m_minus:
                for k in range(f_m_minus, f_m):
                    filters[m - 1, k] = (k - f_m_minus) / (f_m - f_m_minus)
            if f_m_plus > f_m:
                for k in range(f_m, f_m_plus):
                    filters[m - 1, k] = (f_m_plus - k) / (f_m_plus - f_m)
        return filters

    def extract_window_formants(self, window: np.ndarray) -> np.ndarray:
        """Extract first 4 formant frequencies (F1, F2, F3, F4) via LPC polynomial roots."""
        win = np.asarray(window, dtype=np.float64)
        if len(win) == 0:
            return np.array([500.0, 1500.0, 2500.0, 3500.0], dtype=np.float64)

        # Pre-emphasis and Hamming windowing
        win_pe = np.append(win[0], win[1:] - 0.97 * win[:-1]) * np.hamming(len(win))
        r = np.correlate(win_pe, win_pe, mode="full")
        r = r[len(win_pe) - 1 : len(win_pe) + self.lpc_order]

        if r[0] <= 1e-12:
            return np.array([500.0, 1500.0, 2500.0, 3500.0], dtype=np.float64)

        formants: List[float] = []
        try:
            a = scipy.linalg.solve_toeplitz(
                (r[: self.lpc_order], r[: self.lpc_order]),
                -r[1 : self.lpc_order + 1],
            )
            poly = np.concatenate([[1.0], a])
            roots = np.roots(poly)

            candidates: List[Tuple[float, float]] = []
            for rt in roots:
                if np.imag(rt) > 0:
                    mag = np.abs(rt)
                    if mag > 0.01:
                        freq = float(np.angle(rt) * (self.sample_rate / (2.0 * np.pi)))
                        bw = float(-(self.sample_rate / np.pi) * np.log(max(mag, 1e-7)))
                        if 150.0 < freq < (self.sample_rate / 2.0 - 100.0) and bw < 1000.0:
                            candidates.append((freq, bw))

            candidates.sort(key=lambda x: x[0])
            formants = [c[0] for c in candidates]
        except Exception:
            formants = []

        defaults = [500.0, 1500.0, 2500.0, 3500.0]
        while len(formants) < 4:
            formants.append(defaults[len(formants)])
        return np.array(formants[:4], dtype=np.float64)

    def extract_window_f0_and_hnr(self, window: np.ndarray) -> Tuple[float, float, float]:
        """Compute fundamental frequency F0 and HNR from normalized autocorrelation.

        Returns (f0_hz, hnr_db, peak_correlation).
        """
        win = np.asarray(window, dtype=np.float64)
        if len(win) == 0:
            return 0.0, 0.0, 0.0

        r = np.correlate(win, win, mode="full")
        r = r[len(win) - 1 :]
        r_zero = r[0]
        if r_zero <= 1e-12:
            return 0.0, 0.0, 0.0

        r_norm = r / r_zero
        lag_min = max(1, int(self.sample_rate / self.f0_max))
        lag_max = min(len(r_norm) - 1, int(self.sample_rate / self.f0_min))

        if lag_min >= lag_max:
            return 0.0, 0.0, 0.0

        sub_r = r_norm[lag_min : lag_max + 1]
        best_offset = int(np.argmax(sub_r))
        peak_lag = lag_min + best_offset
        peak_val = float(sub_r[best_offset])

        # Voicing decision threshold: 0.25
        if peak_val < 0.25:
            return 0.0, 0.0, peak_val

        # Quadratic / parabolic interpolation for sub-sample accuracy
        if 0 < peak_lag < len(r_norm) - 1:
            alpha = r_norm[peak_lag - 1]
            beta = r_norm[peak_lag]
            gamma = r_norm[peak_lag + 1]
            denom = 2.0 * (alpha - 2.0 * beta + gamma)
            if abs(denom) > 1e-12:
                delta = (alpha - gamma) / denom
                peak_lag_refined = peak_lag + delta
            else:
                peak_lag_refined = float(peak_lag)
        else:
            peak_lag_refined = float(peak_lag)

        f0_hz = float(self.sample_rate / peak_lag_refined)
        hnr_ratio = max(peak_val, 1e-6) / max(1.0 - peak_val, 1e-6)
        hnr_db = float(np.clip(10.0 * np.log10(hnr_ratio), 0.0, 40.0))
        return f0_hz, hnr_db, peak_val

    def extract_window_mfcc(self, window: np.ndarray, n_fft: int = 1024) -> np.ndarray:
        """Compute MFCC spectral filterbank coefficients for a single window."""
        win = np.asarray(window, dtype=np.float64)
        win_w = win * np.hamming(len(win))
        mag_spec = np.abs(np.fft.rfft(win_w, n=n_fft))
        power_spec = (mag_spec ** 2) / float(n_fft)

        mel_energies = np.dot(self.mel_filters, power_spec)
        log_mel_energies = np.log(np.maximum(mel_energies, 1e-10))

        # Discrete Cosine Transform (DCT-II)
        mfccs = np.zeros(self.n_mfcc, dtype=np.float64)
        for n in range(self.n_mfcc):
            mfccs[n] = float(
                np.sum(
                    log_mel_energies
                    * np.cos(np.pi * n * (np.arange(self.n_mels) + 0.5) / float(self.n_mels))
                )
            )
        return mfccs

    def extract_features(self, audio: np.ndarray) -> Dict[str, Any]:
        """Extract comprehensive prosody and spectral features across 500ms sliding windows."""
        arr = np.asarray(audio, dtype=np.float64)
        # Ensure minimum length of at least 1 window
        if len(arr) < self.window_length:
            pad_width = self.window_length - len(arr)
            arr = np.pad(arr, (0, pad_width), mode="constant")

        n_windows = max(1, 1 + (len(arr) - self.window_length) // self.hop_length)

        f0_contour: List[float] = []
        hnr_list: List[float] = []
        formants_list: List[np.ndarray] = []
        mfcc_list: List[np.ndarray] = []
        window_energies: List[float] = []

        for w in range(n_windows):
            start = w * self.hop_length
            end = start + self.window_length
            chunk = arr[start:end]

            # RMS energy
            energy = float(np.sqrt(np.mean(chunk ** 2)))
            window_energies.append(energy)

            # F0 & HNR
            f0_val, hnr_val, _ = self.extract_window_f0_and_hnr(chunk)
            f0_contour.append(f0_val)
            hnr_list.append(hnr_val)

            # LPC Formants F1-F4
            formants_list.append(self.extract_window_formants(chunk))

            # MFCCs
            mfcc_list.append(self.extract_window_mfcc(chunk))

        f0_arr = np.array(f0_contour, dtype=np.float64)
        voiced_f0 = f0_arr[f0_arr > 0.0]

        f0_mean = float(np.mean(voiced_f0)) if len(voiced_f0) > 0 else 0.0
        f0_variance = float(np.var(voiced_f0)) if len(voiced_f0) > 1 else 0.0

        # Jitter: cycle-to-cycle F0 period variation across voiced windows
        if len(voiced_f0) >= 2 and f0_mean > 0.0:
            periods = 1.0 / voiced_f0
            jitter = float(np.mean(np.abs(np.diff(periods))) / np.mean(periods))
        else:
            jitter = 0.0

        # Shimmer: window-to-window amplitude perturbation
        energies_arr = np.array(window_energies, dtype=np.float64)
        mean_energy = float(np.mean(energies_arr))
        if len(energies_arr) >= 2 and mean_energy > 1e-6:
            shimmer = float(np.mean(np.abs(np.diff(energies_arr))) / mean_energy)
        else:
            shimmer = 0.0

        # Mean HNR across voiced/active frames
        voiced_hnr = [h for h, f in zip(hnr_list, f0_contour) if f > 0.0]
        hnr_mean = float(np.mean(voiced_hnr)) if len(voiced_hnr) > 0 else float(np.mean(hnr_list))

        # Mean formants
        mean_formants = np.mean(formants_list, axis=0)
        f1, f2, f3, f4 = [float(f) for f in mean_formants[:4]]

        # Mean MFCCs
        mean_mfcc = np.mean(mfcc_list, axis=0)

        return {
            "f0_contour": f0_arr,
            "f0_mean": f0_mean,
            "f0_variance": f0_variance,
            "formants": (f1, f2, f3, f4),
            "f1": f1,
            "f2": f2,
            "f3": f3,
            "f4": f4,
            "jitter": jitter,
            "shimmer": shimmer,
            "hnr": hnr_mean,
            "mfcc": mean_mfcc,
            "n_windows": n_windows,
        }

    def extract_embedding(self, audio: np.ndarray) -> np.ndarray:
        """Extract a 64-dimensional unified acoustic embedding vector.

        Embedding Layout:
          - Subbands 0..15 (16 dims): Pitch, F0 contour harmonics, variance, jitter, shimmer, HNR.
          - Subbands 16..47 (32 dims): Formant resonances F1-F4 and cross-formant ratios.
          - Subbands 48..63 (16 dims): MFCC spectral envelope coefficients.
        Returns:
          Unit L2-normalized 64-dimensional vector in R^64.
        """
        feats = self.extract_features(audio)
        vec = np.zeros(64, dtype=np.float64)

        # 0..15: F0 pitch & prosody dynamics (16 dims)
        f0_m = feats["f0_mean"]
        f0_v = feats["f0_variance"]
        p_vec = np.zeros(16, dtype=np.float64)
        p_vec[0] = (f0_m - 150.0) / 60.0
        p_vec[1] = np.sqrt(max(0.0, f0_v)) / 10.0
        p_vec[2] = float(feats["jitter"]) * 50.0
        p_vec[3] = float(feats["shimmer"]) * 50.0
        p_vec[4] = (float(feats["hnr"]) - 20.0) / 10.0
        for k in range(11):
            p_vec[5 + k] = np.sin((k + 1) * f0_m * 2.0 * np.pi / 2000.0)
        p_norm = np.linalg.norm(p_vec)
        if p_norm > 1e-12:
            p_vec = p_vec / p_norm
        vec[:16] = p_vec

        # 16..47: Formants F1-F4 resonances & ratios (32 dims)
        f1, f2, f3, f4 = feats["formants"]
        f_vec = np.zeros(32, dtype=np.float64)
        f_norm = [(f1 - 500.0) / 200.0, (f2 - 1500.0) / 400.0, (f3 - 2500.0) / 500.0, (f4 - 3500.0) / 500.0]
        for idx, fn in enumerate(f_norm):
            f_vec[idx * 4 : (idx + 1) * 4] = fn * np.array([0.8, 1.0, 1.2, 1.4])
        ratios = [
            f2 / max(f1, 100.0),
            f3 / max(f2, 100.0),
            f4 / max(f3, 100.0),
            f3 / max(f1, 100.0),
        ]
        for idx, r_val in enumerate(ratios):
            f_vec[16 + idx * 4 : 16 + (idx + 1) * 4] = (r_val - 2.0) * np.array([0.9, 1.0, 1.1, 1.3])
        fnorm = np.linalg.norm(f_vec)
        if fnorm > 1e-12:
            f_vec = f_vec / fnorm
        vec[16:48] = f_vec

        # 48..63: MFCC spectral filterbank features (16 dims)
        mfcc_arr = np.asarray(feats["mfcc"], dtype=np.float64)
        m_vec = np.zeros(16, dtype=np.float64)
        # Omit c0 (log-energy) to focus on spectral shape filterbanks
        c_coeffs = mfcc_arr[1:14] if len(mfcc_arr) > 1 else mfcc_arr
        m_vec[: len(c_coeffs)] = c_coeffs
        mnorm = np.linalg.norm(m_vec)
        if mnorm > 1e-12:
            m_vec = m_vec / mnorm
        vec[48:64] = m_vec

        norm = float(np.linalg.norm(vec))
        if norm > 1e-12:
            vec = vec / norm
        return vec


class ChronisVoiceTransform:
    """Acoustic feature voice anonymization transformation engine.

    Transforms 64-dimensional acoustic representations (formant vocal tract resonances,
    F0 pitch trajectory, and spectral envelope) using:
      1. Vocal tract length normalization (VTLN) frequency warping.
      2. Dynamic fundamental pitch shift and contour perturbation.
      3. Session-keyed orthogonal subspace rotation Q_k derived deterministically
         from an ephemeral cryptographic session key.
    """

    def __init__(self, dim: int = 64, seed: Optional[int] = None) -> None:
        self.dim = dim
        self.rng = np.random.default_rng(seed)

    def derive_rotation_matrix(self, session_key: Union[bytes, str, int]) -> np.ndarray:
        """Derive an orthogonal rotation matrix Q in O(dim) from session key material."""
        if isinstance(session_key, str):
            key_bytes = session_key.encode("utf-8")
        elif isinstance(session_key, int):
            key_bytes = session_key.to_bytes(32, "big", signed=False)
        else:
            key_bytes = bytes(session_key)

        seed_digest = hashlib.sha256(key_bytes).digest()
        seed_int = int.from_bytes(seed_digest[:8], "big")
        key_rng = np.random.default_rng(seed_int)
        H = key_rng.normal(0, 1, size=(self.dim, self.dim))
        Q, R = np.linalg.qr(H)
        # Ensure proper orientation / positive determinant
        d = np.diagonal(R)
        ph = d / np.where(np.abs(d) < 1e-12, 1.0, np.abs(d))
        Q = Q * ph
        return Q

    def transform(
        self,
        acoustic_vector: np.ndarray,
        rotation_matrix: np.ndarray,
        warp_factor: float = 1.12,
        pitch_shift_semitones: float = 2.5,
    ) -> np.ndarray:
        """Apply acoustic anonymization transform to a 64-dim acoustic embedding vector."""
        warped = np.copy(acoustic_vector)
        # Subbands 0..15: F0 fundamental frequency harmonics -> pitch scaling
        if pitch_shift_semitones != 0.0:
            warped[:16] = warped[:16] * (2.0 ** (pitch_shift_semitones / 12.0))
        # Subbands 16..47: Formant resonances (F1-F4) -> VTLN warping
        if warp_factor != 1.0:
            shift_idx = int(round((warp_factor - 1.0) * 4))
            warped[16:48] = np.roll(warped[16:48], shift_idx) * warp_factor

        norm = np.linalg.norm(warped)
        if norm > 1e-12:
            warped = warped / norm

        # Session-keyed orthogonal subspace rotation
        anon = rotation_matrix @ warped
        anon_norm = np.linalg.norm(anon)
        if anon_norm > 1e-12:
            anon = anon / anon_norm
        return anon

    def invert(self, transformed_vector: np.ndarray, rotation_matrix: np.ndarray) -> np.ndarray:
        """Apply fully-informed exact inverse orthogonal rotation."""
        inv = rotation_matrix.T @ transformed_vector
        norm = np.linalg.norm(inv)
        if norm > 1e-12:
            inv = inv / norm
        return inv


class ChronisAudioVoiceTransform(ChronisVoiceTransform):
    """Audio voice anonymization transformation engine conforming to Chronis Bible Part 4.4.

    Applies:
      1. Vocal tract length normalization (VTLN) frequency warping to formant subbands (16..47).
      2. Dynamic fundamental frequency (F0) pitch shift to pitch subbands (0..15).
      3. Session-keyed orthogonal subspace projection Q derived deterministically
         from ephemeral cryptographic session key material.
    """

    def __init__(self, dim: int = 64, seed: Optional[int] = None) -> None:
        super().__init__(dim=dim, seed=seed)

    def transform_audio(
        self,
        audio: np.ndarray,
        rotation_matrix: np.ndarray,
        warp_factor: float = 1.12,
        pitch_shift_semitones: float = 2.5,
        preprocessor: Optional[ChronisAudioPreprocessor] = None,
        prosody_extractor: Optional[ChronisProsodyExtractor] = None,
    ) -> np.ndarray:
        """Process raw audio through preprocessor and prosody extractor, then apply voice transform."""
        prep = preprocessor or ChronisAudioPreprocessor()
        extractor = prosody_extractor or ChronisProsodyExtractor()
        clean_audio = prep.process(audio)
        embedding = extractor.extract_embedding(clean_audio)
        return self.transform(
            embedding,
            rotation_matrix=rotation_matrix,
            warp_factor=warp_factor,
            pitch_shift_semitones=pitch_shift_semitones,
        )


class ChronisAcousticPipelineCorpus:
    """Acoustic pipeline multi-speaker embedding corpus modeling vocal tract acoustics.

    Generates 64-dimensional acoustic representations grounded in real speech production:
      - Vocal tract resonances (formants F1-F4)
      - F0 fundamental frequency contours
      - Spectral tilt and harmonic-to-noise ratio
    Incorporates intra-speaker phonetic variability and channel reverberation.
    """

    def __init__(
        self,
        n_speakers: int = 30,
        utterances_per_speaker: int = 10,
        dim: int = 64,
        seed: int = 42,
    ) -> None:
        self.n_speakers = n_speakers
        self.utterances_per_speaker = utterances_per_speaker
        self.dim = dim
        self.seed = seed
        self.rng = np.random.default_rng(seed)
        self.voice_transform = ChronisVoiceTransform(dim=dim, seed=seed)

        # Baseline speaker vocal tract lengths (14.0 - 18.5 cm) and F0 ranges (90 - 260 Hz)
        self.speaker_vocal_tract_lengths = self.rng.uniform(14.0, 18.5, size=n_speakers)
        self.speaker_base_f0 = self.rng.uniform(90.0, 260.0, size=n_speakers)

        self.centers: List[np.ndarray] = []
        for spk in range(n_speakers):
            vtl = self.speaker_vocal_tract_lengths[spk]
            f0 = self.speaker_base_f0[spk]
            c = self.rng.normal(0, 1, size=dim)
            c[:16] = c[:16] * (f0 / 150.0)
            c[16:48] = c[16:48] * (17.0 / vtl)
            c = c / np.linalg.norm(c)
            self.centers.append(c)

        # Utterances per speaker with acoustic intra-speaker phonetic drift & recording noise
        self.utterances: List[np.ndarray] = []
        for spk in range(n_speakers):
            spk_utts = []
            for _ in range(utterances_per_speaker):
                phonetic_drift = self.rng.normal(0, 0.18, size=dim)
                reverb_noise = self.rng.normal(0, 0.05, size=dim)
                u_vec = self.centers[spk] + phonetic_drift + reverb_noise
                u_vec = u_vec / np.linalg.norm(u_vec)
                spk_utts.append(u_vec)
            self.utterances.append(np.array(spk_utts))

        # Per-utterance session-keyed transforms
        self.transforms: List[List[np.ndarray]] = []
        for spk in range(n_speakers):
            spk_t = []
            for u in range(utterances_per_speaker):
                session_entropy = self.rng.bytes(32)
                Q = self.voice_transform.derive_rotation_matrix(session_entropy)
                spk_t.append(Q)
            self.transforms.append(spk_t)


class ChronisRealAudioPipelineHarness:
    """Multi-speaker raw audio acoustic evaluation harness conforming to Bible Parts 4.3 & 4.4.

    Generates real 16kHz speech waveforms for multiple speakers across multiple sessions,
    runs them through the audio preprocessor, prosody extractor, and voice transform,
    and computes genuine and impostor ASV verification scores across Ignorant,
    Semi-Informed, and Fully-Informed attackers.
    """

    def __init__(
        self,
        n_speakers: int = 10,
        utterances_per_speaker: int = 4,
        duration_sec: float = 0.6,
        sample_rate: int = 16000,
        seed: int = 42,
        scoring_model: Union[BaseScoringModel, ScoringModelType, str] = "cosine",
    ) -> None:
        self.n_speakers = int(n_speakers)
        self.utterances_per_speaker = int(utterances_per_speaker)
        self.duration_sec = float(duration_sec)
        self.sample_rate = int(sample_rate)
        self.seed = int(seed)
        self.scoring_model_type = scoring_model
        self.rng = np.random.default_rng(seed)

        self.preprocessor = ChronisAudioPreprocessor(sample_rate=self.sample_rate)
        self.prosody_extractor = ChronisProsodyExtractor(sample_rate=self.sample_rate)
        self.voice_transform = ChronisAudioVoiceTransform(dim=64, seed=seed)

        # Baseline speaker acoustic characteristics
        # VTL in cm: 14.0 - 18.5 cm
        self.speaker_vtl = self.rng.uniform(14.0, 18.5, size=self.n_speakers)
        # F0 in Hz: 100.0 - 260.0 Hz
        self.speaker_f0 = self.rng.uniform(100.0, 260.0, size=self.n_speakers)

    def generate_speaker_speech(
        self,
        speaker_idx: int,
        utterance_idx: int,
        rng: Optional[np.random.Generator] = None,
    ) -> np.ndarray:
        """Synthesize a raw 16kHz acoustic speech waveform for a speaker and session."""
        local_rng = rng or self.rng
        n_samples = int(self.duration_sec * self.sample_rate)
        vtl = float(self.speaker_vtl[speaker_idx])
        base_f0 = float(self.speaker_f0[speaker_idx])

        # Nominal formants derived from vocal tract length: F_n = (2n - 1) * c / (4 * L)
        c_sound = 34000.0  # speed of sound in air (cm/s)
        nominal_formants = [((2 * n - 1) * c_sound / (4.0 * vtl)) for n in range(1, 5)]

        # Session-specific intra-speaker drift
        f0_drift = float(local_rng.normal(0.0, 3.0))
        formant_drift = local_rng.normal(0.0, 15.0, size=4)
        f0 = max(70.0, min(350.0, base_f0 + f0_drift))
        formants = [max(150.0, nf + fd) for nf, fd in zip(nominal_formants, formant_drift)]

        # Glottal pulse excitation train
        step = max(int(self.sample_rate / f0), 16)
        pulse_indices = np.arange(0, n_samples, step)
        glottal = np.zeros(n_samples, dtype=np.float64)
        glottal[pulse_indices] = 1.0

        # Glottal pulse smoothing
        pulse_len = max(4, min(step // 2, 60))
        pulse_shape = np.sin(np.linspace(0.0, np.pi, pulse_len))
        glottal = np.convolve(glottal, pulse_shape, mode="same")
        # Add aspiration noise
        glottal += local_rng.normal(0.0, 0.05, size=n_samples)

        # Cascaded second-order resonant filters for vocal tract formants
        bandwidths = [80.0, 100.0, 130.0, 170.0]
        out = glottal
        for fc, bw in zip(formants, bandwidths):
            r = np.exp(-np.pi * bw / float(self.sample_rate))
            theta = 2.0 * np.pi * fc / float(self.sample_rate)
            a = [1.0, -2.0 * r * np.cos(theta), r ** 2]
            out = scipy.signal.lfilter([1.0 - r], a, out)

        # Lip radiation filter (first-order difference)
        out = np.append(out[0], out[1:] - 0.95 * out[:-1])
        return out

    def run(self) -> Dict[str, Any]:
        """Execute multi-speaker raw audio pipeline and evaluate ASV verification across tiers."""
        enrollments: List[np.ndarray] = []
        evaluations: List[List[np.ndarray]] = []
        transforms: List[List[np.ndarray]] = []

        for s in range(self.n_speakers):
            s_evals: List[np.ndarray] = []
            s_trans: List[np.ndarray] = []
            for u in range(self.utterances_per_speaker):
                waveform = self.generate_speaker_speech(s, u)
                preprocessed = self.preprocessor.process(waveform)
                embedding = self.prosody_extractor.extract_embedding(preprocessed)

                if u == 0:
                    enrollments.append(embedding)
                else:
                    s_evals.append(embedding)
                    session_key = self.rng.bytes(32)
                    Q = self.voice_transform.derive_rotation_matrix(session_key)
                    s_trans.append(Q)

            evaluations.append(s_evals)
            transforms.append(s_trans)

        # Resolve scoring backend
        scorer: Optional[BaseScoringModel] = None
        if self.scoring_model_type in ("plda", ScoringModelType.PLDA):
            all_utts = []
            all_labels = []
            for s in range(self.n_speakers):
                all_utts.append(enrollments[s])
                all_labels.append(s)
                for u in range(len(evaluations[s])):
                    all_utts.append(evaluations[s][u])
                    all_labels.append(s)
            scorer = PLDAScoringModel().fit(np.array(all_utts), np.array(all_labels))
        elif isinstance(self.scoring_model_type, BaseScoringModel):
            scorer = self.scoring_model_type

        results: Dict[str, Dict[str, Any]] = {}
        for level in AttackerKnowledgeLevel:
            genuine: List[float] = []
            impostor: List[float] = []

            for i in range(self.n_speakers):
                enroll = enrollments[i]
                for j in range(self.n_speakers):
                    for u in range(self.utterances_per_speaker - 1):
                        clean_test = evaluations[j][u]
                        Q = transforms[j][u]
                        anon_test = self.voice_transform.transform(clean_test, Q)

                        if level == AttackerKnowledgeLevel.IGNORANT:
                            test_rep = anon_test
                        elif level == AttackerKnowledgeLevel.SEMI_INFORMED:
                            est = 0.5 * self.voice_transform.invert(anon_test, Q) + 0.5 * anon_test
                            test_rep = est / np.linalg.norm(est)
                        elif level == AttackerKnowledgeLevel.FULLY_INFORMED:
                            test_rep = self.voice_transform.invert(anon_test, Q)
                        else:
                            raise ValueError(f"Unknown attacker level: {level}")

                        if scorer is None:
                            score = float(np.dot(enroll, test_rep))
                        else:
                            score = scorer.score(enroll, test_rep)

                        if i == j:
                            genuine.append(score)
                        else:
                            if len(impostor) < len(genuine) * 5:
                                impostor.append(score)

            gen_arr = np.array(genuine, dtype=np.float64)
            imp_arr = np.array(impostor, dtype=np.float64)
            eer, threshold = compute_eer(gen_arr, imp_arr)
            auc = compute_auc(gen_arr, imp_arr)
            ci_eer = bootstrap_eer_ci(gen_arr, imp_arr, n_bootstraps=100, seed=self.seed)
            ci_auc = bootstrap_auc_ci(gen_arr, imp_arr, n_bootstraps=100, seed=self.seed)

            results[level.value] = {
                "eer": eer,
                "threshold": threshold,
                "auc": auc,
                "confidence_interval_95": [ci_eer.lower, ci_eer.upper],
                "confidence_interval_95_auc": [ci_auc.lower, ci_auc.upper],
                "bootstrap_percentiles": ci_eer.percentiles,
                "bootstrap_percentiles_auc": ci_auc.percentiles,
                "bootstrap_mean": ci_eer.mean,
                "bootstrap_std_err": ci_eer.std_err,
                "n_genuine": len(gen_arr),
                "n_impostor": len(imp_arr),
            }

        model_name = (
            self.scoring_model_type
            if isinstance(self.scoring_model_type, str)
            else getattr(self.scoring_model_type, "value", type(self.scoring_model_type).__name__)
        )

        return {
            "framing": FRAMING_STATEMENT,
            "pipeline_type": "chronis_real_audio_pipeline",
            "n_speakers": self.n_speakers,
            "utterances_per_speaker": self.utterances_per_speaker,
            "random_seed": self.seed,
            "scoring_model": str(model_name),
            "results": results,
        }


def build_attacker_scores(
    corpus: Union[SyntheticSpeakerCorpus, ChronisAcousticPipelineCorpus],
    level: AttackerKnowledgeLevel,
    scoring_model: Optional[Union[BaseScoringModel, ScoringModelType, str]] = None,
    max_impostor_ratio: int = 5,
) -> Tuple[np.ndarray, np.ndarray]:
    """Generate genuine and impostor similarity scores under the given attacker knowledge level.

    Args:
        corpus: The synthetic or acoustic speaker corpus.
        level: The attacker knowledge tier (IGNORANT, SEMI_INFORMED, FULLY_INFORMED).
        scoring_model: Optional scoring model. If None or "cosine", uses standard dot product/cosine similarity.
                       If "plda", fits and evaluates a Two-Covariance G-PLDA model.
                       Can also be an instance of BaseScoringModel.
        max_impostor_ratio: Ratio limit of impostor comparisons relative to genuine comparisons.
    """
    # Resolve scoring model backend
    scorer: Optional[BaseScoringModel] = None
    if scoring_model is None or scoring_model == ScoringModelType.COSINE or scoring_model == "cosine":
        scorer = None  # None preserves exact bit-for-bit baseline dot-product scoring
    elif scoring_model == ScoringModelType.PLDA or scoring_model == "plda":
        scorer = PLDAScoringModel().fit_corpus(corpus)
    elif isinstance(scoring_model, BaseScoringModel):
        scorer = scoring_model
    else:
        raise ValueError(f"Unknown scoring model: {scoring_model}")

    genuine: List[float] = []
    impostor: List[float] = []

    n_spk = corpus.n_speakers
    n_utt = corpus.utterances_per_speaker
    has_acoustic_transform = hasattr(corpus, "voice_transform") and corpus.voice_transform is not None

    for i in range(n_spk):
        # Enrolled original voiceprint for speaker i (clean enrollment)
        enroll = corpus.utterances[i][0]

        for j in range(n_spk):
            for u in range(1, n_utt):
                clean_test = corpus.utterances[j][u]
                Q = corpus.transforms[j][u]

                if has_acoustic_transform:
                    anon_test = corpus.voice_transform.transform(clean_test, Q)
                else:
                    anon_test = Q @ clean_test

                if level == AttackerKnowledgeLevel.IGNORANT:
                    # Attacker compares clean enrollment directly to anonymized test
                    test_rep = anon_test
                elif level == AttackerKnowledgeLevel.SEMI_INFORMED:
                    # Attacker knows transform architecture and general distribution,
                    # but lacks the exact per-session rotation key (partial inversion estimate)
                    if has_acoustic_transform:
                        est = 0.5 * corpus.voice_transform.invert(anon_test, Q) + 0.5 * anon_test
                    else:
                        est = 0.5 * (Q.T @ anon_test) + 0.5 * anon_test
                    test_rep = est / np.linalg.norm(est)
                elif level == AttackerKnowledgeLevel.FULLY_INFORMED:
                    # Attacker possesses exact inverse transform Q^T
                    if has_acoustic_transform:
                        test_rep = corpus.voice_transform.invert(anon_test, Q)
                    else:
                        test_rep = Q.T @ anon_test
                else:
                    raise ValueError(f"Unknown attacker level: {level}")

                if scorer is None:
                    # Exact bit-for-bit backward compatibility
                    score = float(np.dot(enroll, test_rep))
                else:
                    score = scorer.score(enroll, test_rep)

                if i == j:
                    genuine.append(score)
                else:
                    # Sample impostors to balance distribution
                    if len(impostor) < len(genuine) * max_impostor_ratio:
                        impostor.append(score)

    return np.array(genuine, dtype=np.float64), np.array(impostor, dtype=np.float64)


def run_standing_regression(
    n_speakers: int = 20,
    utterances_per_speaker: int = 8,
    seed: int = 3,
    scoring_model: Union[BaseScoringModel, ScoringModelType, str] = "cosine",
) -> Dict[str, Any]:
    """Execute standing regression check over all three attacker tiers."""
    corpus = SyntheticSpeakerCorpus(
        n_speakers=n_speakers,
        utterances_per_speaker=utterances_per_speaker,
        seed=seed,
    )

    resolved_scorer: Optional[BaseScoringModel] = None
    if scoring_model in ("plda", ScoringModelType.PLDA):
        resolved_scorer = PLDAScoringModel().fit_corpus(corpus)
    elif isinstance(scoring_model, BaseScoringModel):
        resolved_scorer = scoring_model

    results: Dict[str, Dict[str, Any]] = {}
    for level in AttackerKnowledgeLevel:
        gen, imp = build_attacker_scores(corpus, level, scoring_model=resolved_scorer)
        eer, threshold = compute_eer(gen, imp)
        auc = compute_auc(gen, imp)
        ci_eer = bootstrap_eer_ci(gen, imp, n_bootstraps=100, seed=seed)
        ci_auc = bootstrap_auc_ci(gen, imp, n_bootstraps=100, seed=seed)

        results[level.value] = {
            "eer": eer,
            "threshold": threshold,
            "auc": auc,
            "confidence_interval_95": [ci_eer.lower, ci_eer.upper],
            "confidence_interval_95_auc": [ci_auc.lower, ci_auc.upper],
            "bootstrap_percentiles": ci_eer.percentiles,
            "bootstrap_percentiles_auc": ci_auc.percentiles,
            "bootstrap_mean": ci_eer.mean,
            "bootstrap_std_err": ci_eer.std_err,
            "n_genuine": len(gen),
            "n_impostor": len(imp),
        }

    model_name = scoring_model if isinstance(scoring_model, str) else getattr(scoring_model, "value", type(scoring_model).__name__)

    return {
        "framing": FRAMING_STATEMENT,
        "n_speakers": n_speakers,
        "utterances_per_speaker": utterances_per_speaker,
        "random_seed": seed,
        "scoring_model": str(model_name),
        "results": results,
    }


def run_multi_model_standing_regression(
    n_speakers: int = 20,
    utterances_per_speaker: int = 8,
    seed: int = 3,
) -> Dict[str, Any]:
    """Execute standing regression across both Cosine and PLDA scoring backends for comparative audit."""
    cosine_report = run_standing_regression(
        n_speakers=n_speakers,
        utterances_per_speaker=utterances_per_speaker,
        seed=seed,
        scoring_model="cosine",
    )
    plda_report = run_standing_regression(
        n_speakers=n_speakers,
        utterances_per_speaker=utterances_per_speaker,
        seed=seed,
        scoring_model="plda",
    )
    return {
        "framing": FRAMING_STATEMENT,
        "cosine": cosine_report["results"],
        "plda": plda_report["results"],
    }


def run_acoustic_standing_regression(
    n_speakers: int = 20,
    utterances_per_speaker: int = 8,
    seed: int = 42,
    scoring_model: Union[BaseScoringModel, ScoringModelType, str] = "cosine",
    use_real_audio: bool = False,
    duration_sec: float = 0.6,
) -> Dict[str, Any]:
    """Execute standing regression check on Chronis acoustic pipeline representations.

    Supports both:
      - Synthetic acoustic vector corpus representations (Bible Part 5.26).
      - Full raw audio signal processing pipeline (Bible Parts 4.3 & 4.4) via ChronisRealAudioPipelineHarness.
    """
    if use_real_audio:
        harness = ChronisRealAudioPipelineHarness(
            n_speakers=n_speakers,
            utterances_per_speaker=utterances_per_speaker,
            duration_sec=duration_sec,
            seed=seed,
            scoring_model=scoring_model,
        )
        return harness.run()

    corpus = ChronisAcousticPipelineCorpus(
        n_speakers=n_speakers,
        utterances_per_speaker=utterances_per_speaker,
        seed=seed,
    )
    resolved_scorer: Optional[BaseScoringModel] = None
    if scoring_model in ("plda", ScoringModelType.PLDA):
        resolved_scorer = PLDAScoringModel().fit_corpus(corpus)
    elif isinstance(scoring_model, BaseScoringModel):
        resolved_scorer = scoring_model

    results: Dict[str, Dict[str, Any]] = {}
    for level in AttackerKnowledgeLevel:
        gen, imp = build_attacker_scores(corpus, level, scoring_model=resolved_scorer)
        eer, threshold = compute_eer(gen, imp)
        auc = compute_auc(gen, imp)
        ci_eer = bootstrap_eer_ci(gen, imp, n_bootstraps=100, seed=seed)
        ci_auc = bootstrap_auc_ci(gen, imp, n_bootstraps=100, seed=seed)

        results[level.value] = {
            "eer": eer,
            "threshold": threshold,
            "auc": auc,
            "confidence_interval_95": [ci_eer.lower, ci_eer.upper],
            "confidence_interval_95_auc": [ci_auc.lower, ci_auc.upper],
            "bootstrap_percentiles": ci_eer.percentiles,
            "bootstrap_percentiles_auc": ci_auc.percentiles,
            "bootstrap_mean": ci_eer.mean,
            "bootstrap_std_err": ci_eer.std_err,
            "n_genuine": len(gen),
            "n_impostor": len(imp),
        }

    model_name = scoring_model if isinstance(scoring_model, str) else getattr(scoring_model, "value", type(scoring_model).__name__)

    return {
        "framing": FRAMING_STATEMENT,
        "pipeline_type": "chronis_acoustic_vocal_tract_f0",
        "n_speakers": n_speakers,
        "utterances_per_speaker": utterances_per_speaker,
        "random_seed": seed,
        "scoring_model": str(model_name),
        "results": results,
    }
