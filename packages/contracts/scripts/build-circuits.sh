#!/usr/bin/env bash
# build-circuits.sh
# Compiles Circom ZK circuits and generates Solidity verifiers with real IC constants.
#
# Prerequisites (install once):
#   npm install -g circom
#   npm install -g snarkjs
#
# Powers of Tau (phase 1 ceremony — download once, ~200MB):
#   wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau \
#        -O circuits/powersOfTau28_hez_final_14.ptau
#
# Run from packages/contracts/:
#   bash scripts/build-circuits.sh

set -euo pipefail

CIRCUITS_DIR="$(dirname "$0")/../circuits"
OUT_DIR="${CIRCUITS_DIR}/build"
PTAU="${CIRCUITS_DIR}/powersOfTau28_hez_final_14.ptau"

mkdir -p "${OUT_DIR}"

if [ ! -f "${PTAU}" ]; then
  echo "ERROR: Powers of Tau file not found at ${PTAU}"
  echo "Download: wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau -O ${PTAU}"
  exit 1
fi

build_circuit() {
  local NAME=$1
  local CIRCOM_FILE="${CIRCUITS_DIR}/${NAME}.circom"
  local BUILD="${OUT_DIR}/${NAME}"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Building: ${NAME}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  mkdir -p "${BUILD}"

  # 1. Compile circuit → R1CS + WASM + symbols
  circom "${CIRCOM_FILE}" \
    --r1cs "${BUILD}/${NAME}.r1cs" \
    --wasm "${BUILD}" \
    --sym  "${BUILD}/${NAME}.sym" \
    --O2

  echo "Compiled R1CS: ${BUILD}/${NAME}.r1cs"

  # 2. Circuit-specific setup (phase 2 — random entropy from /dev/urandom)
  snarkjs groth16 setup \
    "${BUILD}/${NAME}.r1cs" \
    "${PTAU}" \
    "${BUILD}/${NAME}_0000.zkey"

  # Contribute randomness (in production: use a real ceremony with multiple contributors)
  snarkjs zkey contribute \
    "${BUILD}/${NAME}_0000.zkey" \
    "${BUILD}/${NAME}_final.zkey" \
    --name="ATTESTA Phase 2 Contribution" \
    -v \
    -e="$(head -c 64 /dev/urandom | base64)"

  echo "Final zkey: ${BUILD}/${NAME}_final.zkey"

  # 3. Export verification key JSON
  snarkjs zkey export verificationkey \
    "${BUILD}/${NAME}_final.zkey" \
    "${BUILD}/${NAME}_verification_key.json"

  echo "Verification key: ${BUILD}/${NAME}_verification_key.json"

  # 4. Export Solidity verifier with REAL IC constants
  #    This OVERWRITES the placeholder in src/
  local SOL_NAME
  case "${NAME}" in
    salaryRange)       SOL_NAME="SalaryRangeVerifier" ;;
    employmentDuration) SOL_NAME="EmploymentVerifier" ;;
    *) SOL_NAME="${NAME}Verifier" ;;
  esac

  snarkjs zkey export solidityverifier \
    "${BUILD}/${NAME}_final.zkey" \
    "$(dirname "$0")/../src/${SOL_NAME}.sol"

  echo "Verifier updated: src/${SOL_NAME}.sol (real IC constants)"

  # 5. Copy WASM + zkey to web app public dir for client-side proving
  local WEB_ZK_DIR="$(dirname "$0")/../../../apps/web/public/circuits/${NAME}"
  mkdir -p "${WEB_ZK_DIR}"
  cp "${BUILD}/${NAME}_js/${NAME}.wasm" "${WEB_ZK_DIR}/${NAME}.wasm"
  cp "${BUILD}/${NAME}_final.zkey"           "${WEB_ZK_DIR}/${NAME}_final.zkey"
  cp "${BUILD}/${NAME}_verification_key.json" "${WEB_ZK_DIR}/verification_key.json"
  echo "WASM + zkey → apps/web/public/circuits/${NAME}/"
}

build_circuit "salaryRange"
build_circuit "employmentDuration"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "All circuits built."
echo "Next: deploy contracts with updated verifier constants"
echo "  pnpm --filter @attesta/contracts deploy:amoy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
