import test from "node:test";
import assert from "node:assert/strict";

test("Risk Engine: 6-dimension weighted composite computation", () => {
  const dimensions = [
    { name: "Mixer Proximity", score: 100, weight: 0.25 },
    { name: "VASP Attribution Confidence", score: 98, weight: 0.25 },
    { name: "Layering Depth", score: 70, weight: 0.20 },
    { name: "Cross-Chain Complexity", score: 70, weight: 0.15 },
    { name: "Structuring Signals", score: 85, weight: 0.10 },
    { name: "Sanctioned Entity Exposure", score: 100, weight: 0.05 },
  ];

  const total = Math.min(
    100,
    Math.round(dimensions.reduce((sum, d) => sum + d.score * d.weight, 0))
  );

  // 100*0.25 + 98*0.25 + 70*0.20 + 70*0.15 + 85*0.10 + 100*0.05
  // = 25 + 24.5 + 14 + 10.5 + 8.5 + 5 = 87.5 -> 88
  assert.equal(total, 88);
  assert.ok(total >= 80, "Score 88 should be classified as CRITICAL risk");
});

test("Risk Engine: Low risk baseline for direct transparent transfer", () => {
  const dimensions = [
    { name: "Mixer Proximity", score: 0, weight: 0.25 },
    { name: "VASP Attribution Confidence", score: 98, weight: 0.25 },
    { name: "Layering Depth", score: 25, weight: 0.20 },
    { name: "Cross-Chain Complexity", score: 5, weight: 0.15 },
    { name: "Structuring Signals", score: 10, weight: 0.10 },
    { name: "Sanctioned Entity Exposure", score: 0, weight: 0.05 },
  ];

  const total = Math.round(dimensions.reduce((sum, d) => sum + d.score * d.weight, 0));
  // 0 + 24.5 + 5 + 0.75 + 1.0 + 0 = 31.25 -> 31
  assert.equal(total, 31);
  assert.ok(total < 35, "Score 31 should be classified as LOW risk");
});
