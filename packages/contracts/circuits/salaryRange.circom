pragma circom 2.0.0;

include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/bitify.circom";

/*
 * SalaryRange — proves actualSalary ∈ [minSalary, maxSalary]
 *
 * Private input:
 *   actualSalary  — candidate's real salary (USD cents, e.g. 150000_00)
 *
 * Public inputs:
 *   minSalary     — lower bound (inclusive)
 *   maxSalary     — upper bound (inclusive)
 *
 * Public output:
 *   valid         — 1 if in range, circuit is unsatisfiable if 0
 *
 * Usage (snarkjs):
 *   snarkjs groth16 prove salary_range.zkey witness.wtns proof.json public.json
 *
 * Verifier sees only: minSalary, maxSalary, valid=1
 * Actual salary never leaves the browser.
 */
template SalaryRange() {
    // ── Signals ──────────────────────────────────────────────────────────
    signal input  actualSalary;   // private
    signal input  minSalary;      // public
    signal input  maxSalary;      // public
    signal output valid;          // public — always 1 when proof is valid

    // ── Range check: minSalary <= actualSalary ───────────────────────────
    // LessEqThan(n): checks a[0] <= a[1] over n-bit integers
    // 32 bits → supports values up to ~4.29B (well above any salary in USD cents)
    component lte_low = LessEqThan(32);
    lte_low.in[0] <== minSalary;
    lte_low.in[1] <== actualSalary;

    // ── Range check: actualSalary <= maxSalary ───────────────────────────
    component lte_high = LessEqThan(32);
    lte_high.in[0] <== actualSalary;
    lte_high.in[1] <== maxSalary;

    // ── Combine: both must be true ───────────────────────────────────────
    signal both;
    both <== lte_low.out * lte_high.out;

    // Force valid=1 — proof is unsatisfiable if salary outside range
    both === 1;
    valid <== both;
}

component main {public [minSalary, maxSalary]} = SalaryRange();
