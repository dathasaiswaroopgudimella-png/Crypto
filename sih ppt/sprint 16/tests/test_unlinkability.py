import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from unlinkability import (
    compute_eer,
    AttackerKnowledgeLevel,
    SyntheticSpeakerCorpus,
    build_attacker_scores,
    run_standing_regression,
    FRAMING_STATEMENT,
)


def _reference_eer_via_sklearn(genuine, impostor):
    """Independent cross-check using sklearn's roc_curve, to validate our
    hand-rolled compute_eer against a different, well-tested implementation
    path rather than only checking it against itself."""
    from sklearn.metrics import roc_curve

    scores = np.concatenate([genuine, impostor])
    labels = np.concatenate([np.ones(len(genuine)), np.zeros(len(impostor))])
    fpr, tpr, _ = roc_curve(labels, scores)
    fnr = 1 - tpr
    idx = np.nanargmin(np.abs(fpr - fnr))
    return (fpr[idx] + fnr[idx]) / 2


class TestComputeEER(unittest.TestCase):
    def test_perfectly_separated_scores_give_near_zero_eer(self):
        rng = np.random.default_rng(0)
        genuine = rng.normal(loc=5.0, scale=0.1, size=500)
        impostor = rng.normal(loc=-5.0, scale=0.1, size=500)
        eer, _ = compute_eer(genuine, impostor)
        self.assertLess(eer, 0.01)

    def test_identical_distributions_give_eer_near_half(self):
        rng = np.random.default_rng(1)
        genuine = rng.normal(loc=0.0, scale=1.0, size=2000)
        impostor = rng.normal(loc=0.0, scale=1.0, size=2000)
        eer, _ = compute_eer(genuine, impostor)
        self.assertAlmostEqual(eer, 0.5, delta=0.07)

    def test_matches_independent_sklearn_based_reference(self):
        rng = np.random.default_rng(2)
        genuine = rng.normal(loc=1.0, scale=1.0, size=1000)
        impostor = rng.normal(loc=-0.5, scale=1.0, size=1000)
        ours, _ = compute_eer(genuine, impostor)
        reference = _reference_eer_via_sklearn(genuine, impostor)
        self.assertAlmostEqual(ours, reference, delta=0.02)


class TestAttackerSimulation(unittest.TestCase):
    def setUp(self):
        self.corpus = SyntheticSpeakerCorpus(n_speakers=30, utterances_per_speaker=10, seed=7)

    def test_fully_informed_attacker_beats_ignorant_attacker(self):
        """Sanity check on the harness's own methodology: an attacker with
        the real session's transform key should re-identify speakers far
        better (lower EER) than one enrolled in a totally mismatched
        domain. If this didn't hold, the synthetic construction itself
        would be broken, independent of any real product question."""
        genuine_ign, impostor_ign = build_attacker_scores(self.corpus, AttackerKnowledgeLevel.IGNORANT)
        genuine_full, impostor_full = build_attacker_scores(self.corpus, AttackerKnowledgeLevel.FULLY_INFORMED)
        eer_ignorant, _ = compute_eer(genuine_ign, impostor_ign)
        eer_fully_informed, _ = compute_eer(genuine_full, impostor_full)
        self.assertLess(eer_fully_informed, eer_ignorant)

    def test_knowledge_levels_are_monotonic(self):
        eers = {}
        for level in AttackerKnowledgeLevel:
            g, i = build_attacker_scores(self.corpus, level)
            eers[level], _ = compute_eer(g, i)
        self.assertGreaterEqual(eers[AttackerKnowledgeLevel.IGNORANT], eers[AttackerKnowledgeLevel.SEMI_INFORMED])
        self.assertGreaterEqual(
            eers[AttackerKnowledgeLevel.SEMI_INFORMED], eers[AttackerKnowledgeLevel.FULLY_INFORMED]
        )

    def test_ignorant_attacker_is_close_to_chance(self):
        genuine, impostor = build_attacker_scores(self.corpus, AttackerKnowledgeLevel.IGNORANT)
        eer, _ = compute_eer(genuine, impostor)
        # domain mismatch should leave the attacker close to chance, but
        # not asserting exact 0.5 since a random orthogonal transform can
        # leak a little geometry (this is itself worth a senior's attention
        # if the real pipeline shows the same leakage -- see README).
        self.assertGreater(eer, 0.30)


class TestStandingRegression(unittest.TestCase):
    def test_report_includes_all_three_levels_and_framing(self):
        report = run_standing_regression(n_speakers=20, utterances_per_speaker=8, seed=3)
        self.assertEqual(report["framing"], FRAMING_STATEMENT)
        for level in AttackerKnowledgeLevel:
            self.assertIn(level.value, report["results"])
            self.assertIn("eer", report["results"][level.value])

    def test_report_is_deterministic_given_seed(self):
        r1 = run_standing_regression(n_speakers=15, utterances_per_speaker=6, seed=99)
        r2 = run_standing_regression(n_speakers=15, utterances_per_speaker=6, seed=99)
        self.assertEqual(r1["results"], r2["results"])


if __name__ == "__main__":
    unittest.main()
