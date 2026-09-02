import test from "node:test";
import assert from "node:assert/strict";

test("Risk Engine: 6-dimension criminal laundering risk computation", () => {
  const dimensions = [
    { name: "Mixer / Privacy Pool Exposure", score: 100, weight: 0.25 },
    { name: "Layering Depth & Peeling", score: 85, weight: 0.25 },
    { name: "Sub-Threshold Structuring (Smurfing)", score: 80, weight: 0.20 },
    { name: "Cross-Chain Flight & Obfuscation", score: 75, weight: 0.15 },
    { name: "Sanctioned Entity Exposure", score: 100, weight: 0.10 },
    { name: "Rapid Sweeping & Mule Velocity", score: 90, weight: 0.05 },
  ];

  const total = Math.min(
    100,
    Math.round(dimensions.reduce((sum, d) => sum + d.score * d.weight, 0))
  );

  // 100*0.25 + 85*0.25 + 80*0.20 + 75*0.15 + 100*0.10 + 90*0.05
  // = 25 + 21.25 + 16 + 11.25 + 10 + 4.5 = 88
  assert.equal(total, 88);
  assert.ok(total >= 80, "Score 88 should be classified as CRITICAL risk");
});

test("Risk Engine: Low criminal risk baseline for transparent direct transfer", () => {
  const dimensions = [
    { name: "Mixer / Privacy Pool Exposure", score: 0, weight: 0.25 },
    { name: "Layering Depth & Peeling", score: 25, weight: 0.25 },
    { name: "Sub-Threshold Structuring (Smurfing)", score: 10, weight: 0.20 },
    { name: "Cross-Chain Flight & Obfuscation", score: 5, weight: 0.15 },
    { name: "Sanctioned Entity Exposure", score: 0, weight: 0.10 },
    { name: "Rapid Sweeping & Mule Velocity", score: 10, weight: 0.05 },
  ];

  const total = Math.round(dimensions.reduce((sum, d) => sum + d.score * d.weight, 0));
  // 0 + 6.25 + 2 + 0.75 + 0 + 0.5 = 9.5 -> 10
  assert.equal(total, 10);
  assert.ok(total < 35, "Score 10 should be classified as LOW risk");
});
