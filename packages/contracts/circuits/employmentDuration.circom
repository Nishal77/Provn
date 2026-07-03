pragma circom 2.0.0;

include "node_modules/circomlib/circuits/comparators.circom";

/*
 * EmploymentDuration — proves actualMonths >= minMonths
 *
 * Private input:
 *   actualMonths  — real employment duration in months
 *
 * Public inputs:
 *   minMonths     — minimum months the employer requires (e.g. 12)
 *
 * Public output:
 *   valid         — 1 if duration meets requirement
 *
 * Example: prove "I worked somewhere for at least 2 years"
 * without revealing exact tenure (could be 36 months).
 */
template EmploymentDuration() {
    // ── Signals ──────────────────────────────────────────────────────────
    signal input  actualMonths;   // private
    signal input  minMonths;      // public
    signal output valid;          // public

    // ── Range check: minMonths <= actualMonths ───────────────────────────
    // 16 bits → supports up to 65535 months (~5461 years)
    component lte = LessEqThan(16);
    lte.in[0] <== minMonths;
    lte.in[1] <== actualMonths;

    // Force valid=1 — unsatisfiable if actualMonths < minMonths
    lte.out === 1;
    valid <== lte.out;
}

component main {public [minMonths]} = EmploymentDuration();
