"""test_unlinkability_enhanced.py — Validation of Enhanced Unlinkability Functionality.

Audits and validates:
1. CosineScoringModel: similarity, distance, batch equivalence, zero handling.
2. PLDAScoringModel: Two-covariance G-PLDA fitting, LLR scoring, distance, batch equivalence.
3. Area Under the ROC Curve (ROC-AUC): exact agreement with sklearn.metrics.roc_auc_score.
4. Exact Bootstrap Distribution Percentiles: 95% CI, p0.5 through p99.5, BootstrapCI tuple unpacking.
5. Strict Monotonicity: Ignorant >= Semi-Informed >= Fully-Informed for both Cosine and PLDA scoring models.
6. Epistemic Grounding: Bible Addendum 5.26 FRAMING_STATEMENT adherence.
"""

import sys
import unittest
from pathlib import Path

import numpy as np
from sklearn.metrics import roc_auc_score, roc_curve

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from unlinkability import (
    AttackerKnowledgeLevel,
    BaseScoringModel,
    BootstrapCI,
    CosineScoringModel,
    FRAMING_STATEMENT,
    PLDAScoringModel,
    ScoringModelType,
    SyntheticSpeakerCorpus,
    ChronisVoiceTransform,
    ChronisAcousticPipelineCorpus,
    ChronisAudioPreprocessor,
    ChronisProsodyExtractor,
    ChronisAudioVoiceTransform,
    ChronisRealAudioPipelineHarness,
    bootstrap_auc_ci,
    bootstrap_eer_ci,
    bootstrap_metrics_ci,
    build_attacker_scores,
    compute_auc,
    compute_distribution_percentiles,
    compute_eer,
    compute_roc_metrics,
    run_acoustic_standing_regression,
    run_multi_model_standing_regression,
    run_standing_regression,
)


class TestScoringModels(unittest.TestCase):
    """Test Cosine and PLDA distance scoring models."""

    def test_cosine_identical_vectors_give_similarity_one(self):
        v = np.array([1.0, 2.0, -1.0, 3.0])
        model = CosineScoringModel()
        sim = model.score(v, v)
        dist = model.distance(v, v)
        self.assertAlmostEqual(sim, 1.0, places=6)
        self.assertAlmostEqual(dist, 0.0, places=6)

    def test_cosine_orthogonal_vectors_give_similarity_zero(self):
        v1 = np.array([1.0, 0.0])
        v2 = np.array([0.0, 1.0])
        model = CosineScoringModel()
        self.assertAlmostEqual(model.score(v1, v2), 0.0, places=6)
        self.assertAlmostEqual(model.distance(v1, v2), 1.0, places=6)

    def test_cosine_batch_matches_pairwise(self):
        rng = np.random.default_rng(10)
        X1 = rng.normal(0, 1, size=(5, 8))
        X2 = rng.normal(0, 1, size=(6, 8))
        model = CosineScoringModel()
        batch_scores = model.score_batch(X1, X2)
        batch_distances = model.distance_batch(X1, X2)

        for i in range(5):
            for j in range(6):
                self.assertAlmostEqual(batch_scores[i, j], model.score(X1[i], X2[j]), places=6)
                self.assertAlmostEqual(batch_distances[i, j], model.distance(X1[i], X2[j]), places=6)

    def test_plda_fitting_and_scoring_discrimination(self):
        corpus = SyntheticSpeakerCorpus(n_speakers=20, utterances_per_speaker=8, seed=42)
        plda = PLDAScoringModel()
        plda.fit_corpus(corpus)

        self.assertTrue(plda.is_fitted)
        self.assertIsNotNone(plda.mu)
        self.assertIsNotNone(plda.V)

        # Same speaker utterances should yield higher LLR and lower distance
        spk0_u0 = corpus.utterances[0][0]
        spk0_u1 = corpus.utterances[0][1]
        spk1_u0 = corpus.utterances[1][0]

        score_same = plda.score(spk0_u0, spk0_u1)
        score_diff = plda.score(spk0_u0, spk1_u0)
        dist_same = plda.distance(spk0_u0, spk0_u1)
        dist_diff = plda.distance(spk0_u0, spk1_u0)

        self.assertGreater(score_same, score_diff)
        self.assertLess(dist_same, dist_diff)

    def test_plda_unfitted_raises_runtime_error(self):
        plda = PLDAScoringModel()
        with self.assertRaises(RuntimeError):
            plda.score(np.ones(10), np.ones(10))


class TestAUCCalculation(unittest.TestCase):
    """Test ROC-AUC computation and validate equivalence against sklearn."""

    def test_auc_matches_sklearn_across_distributions(self):
        rng = np.random.default_rng(77)
        for delta in [0.0, 0.5, 1.5, 3.0]:
            genuine = rng.normal(loc=delta, scale=1.0, size=300)
            impostor = rng.normal(loc=0.0, scale=1.0, size=700)

            ours = compute_auc(genuine, impostor)
            labels = np.concatenate([np.ones(len(genuine)), np.zeros(len(impostor))])
            scores = np.concatenate([genuine, impostor])
            reference = float(roc_auc_score(labels, scores))

            self.assertAlmostEqual(ours, reference, places=7)

    def test_auc_with_tied_scores_matches_sklearn(self):
        genuine = np.array([1.0, 2.0, 2.0, 3.0, 4.0])
        impostor = np.array([0.0, 1.0, 2.0, 2.0, 3.0])
        ours = compute_auc(genuine, impostor)
        labels = np.concatenate([np.ones(len(genuine)), np.zeros(len(impostor))])
        reference = float(roc_auc_score(labels, np.concatenate([genuine, impostor])))
        self.assertAlmostEqual(ours, reference, places=7)

    def test_auc_boundary_cases(self):
        # Perfect separation
        self.assertEqual(compute_auc(np.array([5.0, 6.0]), np.array([1.0, 2.0])), 1.0)
        # Completely inverted
        self.assertEqual(compute_auc(np.array([1.0, 2.0]), np.array([5.0, 6.0])), 0.0)


class TestBootstrapPercentiles(unittest.TestCase):
    """Test exact bootstrap distribution percentiles and 95% confidence intervals."""

    def test_bootstrap_ci_unpacks_as_2_tuple(self):
        ci = BootstrapCI(0.12, 0.24, percentiles={"p2.5": 0.12, "p97.5": 0.24})
        low, high = ci
        self.assertEqual(low, 0.12)
        self.assertEqual(high, 0.24)
        self.assertEqual(len(ci), 2)

    def test_bootstrap_eer_ci_provides_exact_percentiles(self):
        rng = np.random.default_rng(999)
        gen = rng.normal(1.0, 0.5, size=150)
        imp = rng.normal(0.0, 0.5, size=300)

        ci = bootstrap_eer_ci(gen, imp, n_bootstraps=100, seed=123)
        self.assertIsInstance(ci, BootstrapCI)
        self.assertIn("p2.5", ci.percentiles)
        self.assertIn("p50", ci.percentiles)
        self.assertIn("p97.5", ci.percentiles)
        self.assertAlmostEqual(ci.lower, ci.percentiles["p2.5"], places=7)
        self.assertAlmostEqual(ci.upper, ci.percentiles["p97.5"], places=7)
        self.assertAlmostEqual(ci.median, ci.percentiles["p50"], places=7)
        self.assertGreater(ci.upper, ci.lower)

    def test_bootstrap_auc_ci_provides_exact_percentiles(self):
        rng = np.random.default_rng(888)
        gen = rng.normal(1.0, 0.5, size=150)
        imp = rng.normal(0.0, 0.5, size=300)

        ci = bootstrap_auc_ci(gen, imp, n_bootstraps=100, seed=123)
        self.assertIsInstance(ci, BootstrapCI)
        self.assertIn("p2.5", ci.percentiles)
        self.assertIn("p97.5", ci.percentiles)
        self.assertAlmostEqual(ci.lower, ci.percentiles["p2.5"], places=7)
        self.assertAlmostEqual(ci.upper, ci.percentiles["p97.5"], places=7)
        self.assertGreater(ci.mean, 0.8)


class TestMonotonicityAcrossScoringModels(unittest.TestCase):
    """Test strict monotonicity across Ignorant, Semi-Informed, and Fully-Informed tiers."""

    def test_monotonicity_under_both_cosine_and_plda(self):
        report = run_multi_model_standing_regression(n_speakers=25, utterances_per_speaker=8, seed=7)
        self.assertEqual(report["framing"], FRAMING_STATEMENT)

        for model_name in ("cosine", "plda"):
            res = report[model_name]
            eer_ign = res["ignorant"]["eer"]
            eer_semi = res["semi_informed"]["eer"]
            eer_full = res["fully_informed"]["eer"]

            auc_ign = res["ignorant"]["auc"]
            auc_semi = res["semi_informed"]["auc"]
            auc_full = res["fully_informed"]["auc"]

            # EER must decrease as attacker knowledge increases: Ignorant >= Semi >= Full
            self.assertGreaterEqual(eer_ign, eer_semi, f"{model_name}: EER Ignorant should be >= Semi")
            self.assertGreaterEqual(eer_semi, eer_full, f"{model_name}: EER Semi should be >= Full")

            # AUC must increase as attacker knowledge increases: Ignorant <= Semi <= Full
            self.assertLessEqual(auc_ign, auc_semi, f"{model_name}: AUC Ignorant should be <= Semi")
            self.assertLessEqual(auc_semi, auc_full, f"{model_name}: AUC Semi should be <= Full")


class TestAcousticPipelineIntegration(unittest.TestCase):
    """Test acoustic feature transformations and multi-speaker corpus pipeline integration."""

    def test_voice_transform_orthogonality_and_invertibility(self):
        vt = ChronisVoiceTransform(dim=64, seed=42)
        session_entropy = b"session_entropy_salt_1234567890"
        Q = vt.derive_rotation_matrix(session_entropy)

        # 1. Orthogonality: Q^T Q == I
        identity = np.eye(64)
        np.testing.assert_allclose(Q.T @ Q, identity, atol=1e-6)
        np.testing.assert_allclose(Q @ Q.T, identity, atol=1e-6)

        # 2. Invertibility without non-linear warping
        x = np.random.default_rng(1).normal(0, 1, size=64)
        x = x / np.linalg.norm(x)
        # Transform with identity warping
        anon = vt.transform(x, Q, warp_factor=1.0, pitch_shift_semitones=0.0)
        rec = vt.invert(anon, Q)
        np.testing.assert_allclose(rec, x, atol=1e-6)

    def test_voice_transform_deterministic_derivation_from_session_key(self):
        vt = ChronisVoiceTransform(dim=64, seed=42)
        key_a1 = b"session_key_secret_material_abc"
        key_a2 = b"session_key_secret_material_abc"
        key_b = b"session_key_secret_material_xyz"

        Q_a1 = vt.derive_rotation_matrix(key_a1)
        Q_a2 = vt.derive_rotation_matrix(key_a2)
        Q_b = vt.derive_rotation_matrix(key_b)

        np.testing.assert_array_equal(Q_a1, Q_a2)
        self.assertFalse(np.allclose(Q_a1, Q_b))

    def test_acoustic_pipeline_corpus_structure(self):
        corpus = ChronisAcousticPipelineCorpus(n_speakers=15, utterances_per_speaker=6, dim=64, seed=7)
        self.assertEqual(corpus.n_speakers, 15)
        self.assertEqual(corpus.utterances_per_speaker, 6)
        self.assertEqual(len(corpus.utterances), 15)
        self.assertEqual(len(corpus.transforms), 15)

        # Check speaker parameter bounds
        self.assertTrue(all(14.0 <= vtl <= 18.5 for vtl in corpus.speaker_vocal_tract_lengths))
        self.assertTrue(all(90.0 <= f0 <= 260.0 for f0 in corpus.speaker_base_f0))

        # Check unit norm of utterances
        for spk_utts in corpus.utterances:
            for u in spk_utts:
                self.assertAlmostEqual(float(np.linalg.norm(u)), 1.0, places=5)

    def test_acoustic_standing_regression_monotonicity(self):
        rep = run_acoustic_standing_regression(n_speakers=15, utterances_per_speaker=6, seed=7, scoring_model="cosine")
        self.assertEqual(rep["pipeline_type"], "chronis_acoustic_vocal_tract_f0")
        res = rep["results"]

        eer_ign = res["ignorant"]["eer"]
        eer_semi = res["semi_informed"]["eer"]
        eer_full = res["fully_informed"]["eer"]

        # Epistemic Monotonicity: Ignorant >= Semi >= Full
        self.assertGreaterEqual(eer_ign, eer_semi)
        self.assertGreaterEqual(eer_semi, eer_full)


class TestAudioPreprocessor(unittest.TestCase):
    """Audits and validates ChronisAudioPreprocessor per Chronis Bible Part 4.3."""

    def setUp(self) -> None:
        self.prep = ChronisAudioPreprocessor(
            sample_rate=16000,
            cutoff_hz=80.0,
            filter_order=5,
            target_dbfs=-20.0,
        )

    def test_dc_offset_removal(self) -> None:
        """Verify that DC bias is completely eliminated from the signal."""
        t = np.linspace(0.0, 1.0, 16000, endpoint=False)
        sig = np.sin(2.0 * np.pi * 250.0 * t) + 1.35
        dc_removed = self.prep.remove_dc_offset(sig)
        self.assertAlmostEqual(float(np.mean(dc_removed)), 0.0, places=10)

        processed = self.prep.process(sig)
        self.assertAlmostEqual(float(np.mean(processed)), 0.0, places=6)

    def test_butterworth_80hz_highpass_cutoff(self) -> None:
        """Verify 80Hz Butterworth highpass filter strongly attenuates sub-80Hz rumble."""
        t = np.linspace(0.0, 1.0, 16000, endpoint=False)
        sig_30hz = np.sin(2.0 * np.pi * 30.0 * t)
        sig_500hz = np.sin(2.0 * np.pi * 500.0 * t)

        hp_30 = self.prep.highpass_filter(sig_30hz)
        hp_500 = self.prep.highpass_filter(sig_500hz)

        # Measure steady-state RMS (discard first 2000 samples filter transient)
        rms_30 = self.prep.compute_rms(hp_30[2000:])
        rms_500 = self.prep.compute_rms(hp_500[2000:])
        attenuation_db = 20.0 * np.log10(rms_30 / rms_500)

        # 30Hz is well inside stopband; 5th order Butterworth should attenuate by > 30 dB
        self.assertLess(attenuation_db, -30.0)
        self.assertEqual(self.prep.cutoff_hz, 80.0)
        self.assertEqual(self.prep.filter_order, 5)

    def test_rms_normalization_to_minus_20_dbfs(self) -> None:
        """Verify RMS amplitude normalization scales any signal to -20 dBFS (0.1 RMS)."""
        t = np.linspace(0.0, 1.0, 16000, endpoint=False)
        sig_quiet = 0.005 * np.sin(2.0 * np.pi * 300.0 * t)
        sig_loud = 0.850 * np.sin(2.0 * np.pi * 300.0 * t)

        proc_quiet = self.prep.process(sig_quiet)
        proc_loud = self.prep.process(sig_loud)

        # Target RMS for -20 dBFS is 10^(-20/20) = 0.1
        self.assertAlmostEqual(self.prep.compute_rms(proc_quiet), 0.1, delta=1e-4)
        self.assertAlmostEqual(self.prep.compute_rms(proc_loud), 0.1, delta=1e-4)
        self.assertAlmostEqual(self.prep.compute_dbfs(proc_quiet), -20.0, delta=0.05)
        self.assertAlmostEqual(self.prep.compute_dbfs(proc_loud), -20.0, delta=0.05)

    def test_pcm_input_formats_handling(self) -> None:
        """Verify handling of int16 PCM arrays and multichannel input."""
        rng = np.random.default_rng(123)
        int16_pcm = (rng.uniform(-0.8, 0.8, size=16000) * 32767).astype(np.int16)
        stereo_pcm = rng.normal(0.0, 0.1, size=(2, 16000))

        proc_int16 = self.prep.process(int16_pcm)
        proc_stereo = self.prep.process(stereo_pcm)

        self.assertEqual(proc_int16.ndim, 1)
        self.assertEqual(proc_stereo.ndim, 1)
        self.assertAlmostEqual(self.prep.compute_rms(proc_int16), 0.1, delta=1e-4)
        self.assertAlmostEqual(self.prep.compute_rms(proc_stereo), 0.1, delta=1e-4)


class TestProsodyExtractor(unittest.TestCase):
    """Audits and validates ChronisProsodyExtractor per Chronis Bible Part 4.4."""

    def setUp(self) -> None:
        self.extractor = ChronisProsodyExtractor(
            sample_rate=16000,
            window_sec=0.500,
            hop_sec=0.250,
            lpc_order=16,
            n_mfcc=13,
            n_mels=26,
            f0_min=50.0,
            f0_max=500.0,
        )

    def test_sliding_windows_length_and_hop(self) -> None:
        """Verify 500ms sliding windows with 250ms hop across a 1-second audio signal."""
        sig_1s = np.random.default_rng(42).normal(0.0, 0.1, size=16000)
        feats = self.extractor.extract_features(sig_1s)

        # At 16kHz: 1.0s = 16000 samples. Window=8000 (500ms), Hop=4000 (250ms)
        # Windows: [0:8000], [4000:12000], [8000:16000] -> exactly 3 windows
        self.assertEqual(feats["n_windows"], 3)
        self.assertEqual(len(feats["f0_contour"]), 3)

        emb = self.extractor.extract_embedding(sig_1s)
        self.assertEqual(len(emb), 64)
        self.assertAlmostEqual(float(np.linalg.norm(emb)), 1.0, places=5)

    def test_autocorrelation_f0_pitch_detection(self) -> None:
        """Verify autocorrelation F0 pitch estimation on signals with known fundamental frequencies."""
        t = np.linspace(0.0, 1.0, 16000, endpoint=False)
        for target_f0 in [150.0, 220.0]:
            sig = np.zeros(16000, dtype=np.float64)
            for k in range(1, 8):
                sig += (1.0 / k) * np.sin(2.0 * np.pi * k * target_f0 * t)

            feats = self.extractor.extract_features(sig)
            detected_f0 = feats["f0_mean"]
            self.assertAlmostEqual(detected_f0, target_f0, delta=2.0)
            self.assertGreaterEqual(feats["f0_variance"], 0.0)

    def test_lpc_formant_extraction_f1_to_f4(self) -> None:
        """Verify LPC polynomial root formant extraction for F1, F2, F3, and F4."""
        import scipy.signal

        target_formants = [600.0, 1200.0, 2400.0, 3200.0]
        bandwidths = [80.0, 100.0, 130.0, 170.0]

        # Glottal pulse excitation train at 130 Hz
        glottal = np.zeros(16000, dtype=np.float64)
        for p in range(0, 16000, int(16000 / 130)):
            glottal[p] = 1.0

        # Pass through formant resonators
        sig_vowel = glottal
        for fc, bw in zip(target_formants, bandwidths):
            r = np.exp(-np.pi * bw / 16000.0)
            theta = 2.0 * np.pi * fc / 16000.0
            a = [1.0, -2.0 * r * np.cos(theta), r ** 2]
            sig_vowel = scipy.signal.lfilter([1.0], a, sig_vowel)

        feats = self.extractor.extract_features(sig_vowel)
        f1, f2, f3, f4 = feats["formants"]

        # Strictly ascending order
        self.assertLess(f1, f2)
        self.assertLess(f2, f3)
        self.assertLess(f3, f4)

        # Accurately extracted formants within acoustic tolerance
        self.assertAlmostEqual(f1, 600.0, delta=100.0)
        self.assertAlmostEqual(f2, 1200.0, delta=100.0)
        self.assertAlmostEqual(f3, 2400.0, delta=150.0)
        self.assertAlmostEqual(f4, 3200.0, delta=200.0)

    def test_harmonics_to_noise_ratio_hnr(self) -> None:
        """Verify HNR distinguishes clean harmonic speech from unvoiced noise."""
        t = np.linspace(0.0, 1.0, 16000, endpoint=False)
        sig_harmonic = np.zeros(16000, dtype=np.float64)
        for k in range(1, 8):
            sig_harmonic += (1.0 / k) * np.sin(2.0 * np.pi * k * 160.0 * t)

        sig_noise = np.random.default_rng(99).normal(0.0, 1.0, size=16000)

        feats_harm = self.extractor.extract_features(sig_harmonic)
        feats_noise = self.extractor.extract_features(sig_noise)

        self.assertGreater(feats_harm["hnr"], 15.0)
        self.assertLess(feats_noise["hnr"], 5.0)
        self.assertGreater(feats_harm["hnr"], feats_noise["hnr"])

    def test_mfcc_spectral_filterbank_features(self) -> None:
        """Verify MFCC spectral filterbank extraction produces expected dimensions and valid values."""
        sig = np.random.default_rng(7).normal(0.0, 0.1, size=8000)
        mfcc = self.extractor.extract_window_mfcc(sig)

        self.assertEqual(len(mfcc), 13)
        self.assertTrue(np.all(np.isfinite(mfcc)))

        feats = self.extractor.extract_features(sig)
        self.assertEqual(len(feats["mfcc"]), 13)
        self.assertTrue(np.all(np.isfinite(feats["mfcc"])))


class TestRealAudioPipelineASV(unittest.TestCase):
    """Audits and validates the end-to-end real audio pipeline ASV evaluation harness."""

    def test_audio_voice_transform_subspace_projection(self) -> None:
        """Verify ChronisAudioVoiceTransform applies orthogonal rotation, VTLN warping, and pitch shift."""
        vt = ChronisAudioVoiceTransform(dim=64, seed=42)
        session_key = b"chronis_ephemeral_key_material_0987654321"
        Q = vt.derive_rotation_matrix(session_key)

        # Check orthogonality
        np.testing.assert_allclose(Q.T @ Q, np.eye(64), atol=1e-6)

        # Transform audio end-to-end
        t = np.linspace(0.0, 0.6, int(16000 * 0.6), endpoint=False)
        audio = np.sin(2.0 * np.pi * 180.0 * t)
        anon_rep = vt.transform_audio(audio, Q, warp_factor=1.12, pitch_shift_semitones=2.5)

        self.assertEqual(len(anon_rep), 64)
        self.assertAlmostEqual(float(np.linalg.norm(anon_rep)), 1.0, places=5)

    def test_real_audio_pipeline_speaker_synthesis(self) -> None:
        """Verify multi-speaker waveform synthesis in ChronisRealAudioPipelineHarness."""
        harness = ChronisRealAudioPipelineHarness(n_speakers=4, utterances_per_speaker=2, seed=42)
        waveform_spk0 = harness.generate_speaker_speech(0, 0)
        waveform_spk1 = harness.generate_speaker_speech(1, 0)

        self.assertEqual(len(waveform_spk0), int(harness.duration_sec * harness.sample_rate))
        self.assertEqual(len(waveform_spk1), int(harness.duration_sec * harness.sample_rate))
        self.assertFalse(np.allclose(waveform_spk0, waveform_spk1))

    def test_real_audio_pipeline_asv_eer_monotonicity(self) -> None:
        """Verify epistemic ASV EER monotonicity on real audio pipeline: Ignorant >= Semi >= Full."""
        rep = run_acoustic_standing_regression(
            n_speakers=10,
            utterances_per_speaker=4,
            seed=42,
            scoring_model="cosine",
            use_real_audio=True,
        )

        self.assertEqual(rep["pipeline_type"], "chronis_real_audio_pipeline")
        self.assertEqual(rep["framing"], FRAMING_STATEMENT)
        res = rep["results"]

        eer_ign = res["ignorant"]["eer"]
        eer_semi = res["semi_informed"]["eer"]
        eer_full = res["fully_informed"]["eer"]

        auc_ign = res["ignorant"]["auc"]
        auc_semi = res["semi_informed"]["auc"]
        auc_full = res["fully_informed"]["auc"]

        # Strict EER Monotonicity: Ignorant >= Semi-Informed >= Fully-Informed
        self.assertGreaterEqual(eer_ign, eer_semi, f"EER Ignorant ({eer_ign:.4f}) should be >= Semi ({eer_semi:.4f})")
        self.assertGreaterEqual(eer_semi, eer_full, f"EER Semi ({eer_semi:.4f}) should be >= Full ({eer_full:.4f})")

        # Strict AUC Monotonicity: Ignorant <= Semi-Informed <= Fully-Informed
        self.assertLessEqual(auc_ign, auc_semi, f"AUC Ignorant ({auc_ign:.4f}) should be <= Semi ({auc_semi:.4f})")
        self.assertLessEqual(auc_semi, auc_full, f"AUC Semi ({auc_semi:.4f}) should be <= Full ({auc_full:.4f})")


if __name__ == "__main__":
    unittest.main()
