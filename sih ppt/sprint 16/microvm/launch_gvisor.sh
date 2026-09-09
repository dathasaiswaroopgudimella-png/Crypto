#!/usr/bin/env bash
# ==============================================================================
# launch_gvisor.sh — Production Launch Script for Chronis Sandboxed OCI Boundary
# External Gate EXT-05: gVisor (runsc) Application Kernel Virtualization
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPEC_FILE="${SCRIPT_DIR}/runsc_spec.json"
BUNDLE_DIR="/var/lib/chronis/runsc-bundle"
ROOTFS_DIR="${BUNDLE_DIR}/rootfs"
RUNSC_ROOT="/run/runsc"
CONTAINER_ID="chronis-isolation-container-$(date +%s)"

log_info() {
    echo -e "\033[1;34m[INFO]\033[0m $(date -u +'%Y-%m-%dT%H:%M:%SZ') $1"
}

log_error() {
    echo -e "\033[1;31m[ERROR]\033[0m $(date -u +'%Y-%m-%dT%H:%M:%SZ') $1" >&2
}

# ------------------------------------------------------------------------------
# 1. Environmental & gVisor Runtime Verification
# ------------------------------------------------------------------------------
log_info "Verifying host gVisor environment for Gate EXT-05..."

if [[ "$(uname -s)" != "Linux" ]]; then
    log_error "gVisor (runsc) runtime requires a Linux host environment."
    exit 1
fi

if ! command -v runsc &>/dev/null; then
    log_error "'runsc' binary not found on PATH. Install gVisor runsc (https://gvisor.dev/docs/user_guide/install/)."
    exit 1
fi

# Detect platform: kvm preferred for hardware acceleration, systrap fallback
PLATFORM="systrap"
if [[ -e "/dev/kvm" ]] && [[ -r "/dev/kvm" ]] && [[ -w "/dev/kvm" ]]; then
    PLATFORM="kvm"
fi
log_info "Using gVisor platform virtualization engine: ${PLATFORM}"

if [[ ! -f "${SPEC_FILE}" ]]; then
    log_error "gVisor OCI specification file not found at: ${SPEC_FILE}"
    exit 1
fi

# ------------------------------------------------------------------------------
# 2. OCI Bundle Preparation
# ------------------------------------------------------------------------------
log_info "Preparing OCI bundle at: ${BUNDLE_DIR}..."
mkdir -p "${BUNDLE_DIR}" "${RUNSC_ROOT}"

# Copy runtime spec to config.json
cp -f "${SPEC_FILE}" "${BUNDLE_DIR}/config.json"

if [[ ! -d "${ROOTFS_DIR}" ]]; then
    log_info "Bundle rootfs directory ${ROOTFS_DIR} does not exist. Creating minimal rootfs skeleton..."
    mkdir -p "${ROOTFS_DIR}/bin" "${ROOTFS_DIR}/usr/bin" "${ROOTFS_DIR}/usr/local/bin" \
             "${ROOTFS_DIR}/lib" "${ROOTFS_DIR}/lib64" "${ROOTFS_DIR}/etc" \
             "${ROOTFS_DIR}/tmp" "${ROOTFS_DIR}/app"
fi

# ------------------------------------------------------------------------------
# 3. Teardown & Container Lifecycle Cleanup Trap
# ------------------------------------------------------------------------------
cleanup() {
    log_info "Cleaning up gVisor container: ${CONTAINER_ID}..."
    if runsc --root="${RUNSC_ROOT}" list 2>/dev/null | grep -q "${CONTAINER_ID}"; then
        runsc --root="${RUNSC_ROOT}" kill "${CONTAINER_ID}" SIGKILL 2>/dev/null || true
        runsc --root="${RUNSC_ROOT}" delete "${CONTAINER_ID}" 2>/dev/null || true
        log_info "Container ${CONTAINER_ID} deleted cleanly."
    fi
    log_info "Teardown complete. External Gate EXT-05 gVisor sandbox terminated."
}
trap cleanup EXIT INT TERM

# ------------------------------------------------------------------------------
# 4. gVisor Sandboxed Execution
# ------------------------------------------------------------------------------
log_info "Launching gVisor sandboxed container with ID: ${CONTAINER_ID}..."
runsc --platform="${PLATFORM}" \
      --root="${RUNSC_ROOT}" \
      run \
      --bundle="${BUNDLE_DIR}" \
      "${CONTAINER_ID}"
