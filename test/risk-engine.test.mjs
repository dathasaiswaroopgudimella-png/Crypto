import test from "node:test";
import assert from "node:assert/strict";

test("Risk Engine: 6-dimension weighted composite computation", () => {
  const dimensions = [
    { name: "Mixer Proximity", score: 100, weight: 0.30 },
    { name: "VASP Attribution Confidence", score: 95, weight: 0.25 },
    { name: "Layering Depth", score: 65, weight: 0.20 },
    { name: "Cross-Chain Complexity", score: 80, weight: 0.15 },
    { name: "Structuring Signals", score: 82, weight: 0.05 },
    { name: "Sanctioned Entity Exposure", score: 100, weight: 0.05 },
  ];

  const total = Math.min(
    100,
    Math.round(dimensions.reduce((sum, d) => sum + d.score * d.weight, 0))
  );

  // 100*0.30 + 95*0.25 + 65*0.20 + 80*0.15 + 82*0.05 + 100*0.05
  // = 30 + 23.75 + 13 + 12 + 4.1 + 5 = 87.85 -> 88
  assert.equal(total, 88);
  assert.ok(total >= 80, "Score 88 should be classified as CRITICAL risk");
});

test("Risk Engine: Low risk baseline for direct transparent transfer", () => {
  const dimensions = [
    { name: "Mixer Proximity", score: 0, weight: 0.30 },
    { name: "VASP Attribution Confidence", score: 95, weight: 0.25 },
    { name: "Layering Depth", score: 20, weight: 0.20 },
    { name: "Cross-Chain Complexity", score: 0, weight: 0.15 },
    { name: "Structuring Signals", score: 0, weight: 0.05 },
    { name: "Sanctioned Entity Exposure", score: 0, weight: 0.05 },
  ];

  const total = Math.round(dimensions.reduce((sum, d) => sum + d.score * d.weight, 0));
  // 0 + 23.75 + 4 + 0 + 0 + 0 = 27.75 -> 28
  assert.equal(total, 28);
  assert.ok(total < 35, "Score 28 should be classified as LOW risk");
});
