#!/usr/bin/env bash
# ==============================================================================
# launch_firecracker.sh — Production Launch Script for Chronis MicroVM Boundary
# External Gate EXT-05: Firecracker Hardware-Isolated Virtualization
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/firecracker_vm_spec.json"
CHRONIS_RUN_DIR="/run/chronis"
CHRONIS_LOG_DIR="/var/log/chronis"
API_SOCKET="${CHRONIS_RUN_DIR}/firecracker.socket"
VSOCK_SOCKET="${CHRONIS_RUN_DIR}/v.sock"
TAP_DEV="tap0"
TAP_IP="172.16.0.1/24"
FC_PID=""

log_info() {
    echo -e "\033[1;34m[INFO]\033[0m $(date -u +'%Y-%m-%dT%H:%M:%SZ') $1"
}

log_error() {
    echo -e "\033[1;31m[ERROR]\033[0m $(date -u +'%Y-%m-%dT%H:%M:%SZ') $1" >&2
}

# ------------------------------------------------------------------------------
# 1. Environmental & Hypervisor Pre-flight Verification
# ------------------------------------------------------------------------------
log_info "Verifying host virtualization environment for Gate EXT-05..."

if [[ "$(uname -s)" != "Linux" ]]; then
    log_error "Firecracker microVM runtime requires a Linux host environment."
    exit 1
fi

if [[ ! -e "/dev/kvm" ]]; then
    log_error "/dev/kvm device node not found. Hardware virtualization (VT-x/AMD-V) must be enabled."
    exit 1
fi

if [[ ! -r "/dev/kvm" ]] || [[ ! -w "/dev/kvm" ]]; then
    log_error "Current user does not have read/write permissions on /dev/kvm. Add user to kvm group."
    exit 1
fi

if ! command -v firecracker &>/dev/null; then
    log_error "'firecracker' binary not found on PATH. Install Firecracker (v1.4.0+ recommended)."
    exit 1
fi

if [[ ! -f "${CONFIG_FILE}" ]]; then
    log_error "Firecracker configuration spec not found at: ${CONFIG_FILE}"
    exit 1
fi

KERNEL_PATH=$(grep -o '"kernel_image_path": *"[^"]*"' "${CONFIG_FILE}" | head -n1 | cut -d'"' -f4)
ROOTFS_PATH=$(grep -o '"path_on_host": *"[^"]*"' "${CONFIG_FILE}" | head -n1 | cut -d'"' -f4)

if [[ ! -f "${KERNEL_PATH}" ]]; then
    log_error "Uncompressed kernel image not found at ${KERNEL_PATH}. Check EXT-05 deployment instructions."
    exit 1
fi

if [[ ! -f "${ROOTFS_PATH}" ]]; then
    log_error "Chronis rootfs ext4 image not found at ${ROOTFS_PATH}. Check EXT-05 deployment instructions."
    exit 1
fi

# ------------------------------------------------------------------------------
# 2. Runtime Directories & Network TAP Provisioning
# ------------------------------------------------------------------------------
log_info "Creating runtime directories..."
mkdir -p "${CHRONIS_RUN_DIR}" "${CHRONIS_LOG_DIR}"

# Remove stale sockets
rm -f "${API_SOCKET}" "${VSOCK_SOCKET}"

log_info "Configuring network TAP device: ${TAP_DEV}..."
if ! ip link show "${TAP_DEV}" &>/dev/null; then
    ip tuntap add "${TAP_DEV}" mode tap
    ip addr add "${TAP_IP}" dev "${TAP_DEV}"
    ip link set "${TAP_DEV}" up
    log_info "Created and configured ${TAP_DEV} with IP ${TAP_IP}."
else
    log_info "${TAP_DEV} already exists; ensuring it is up."
    ip link set "${TAP_DEV}" up
fi

# Ensure IP forwarding is active
if [[ -w /proc/sys/net/ipv4/ip_forward ]]; then
    echo 1 > /proc/sys/net/ipv4/ip_forward
fi

# ------------------------------------------------------------------------------
# 3. Teardown & Cleanup Trap
# ------------------------------------------------------------------------------
cleanup() {
    log_info "Shutting down Firecracker microVM instance..."
    if [[ -n "${FC_PID}" ]] && kill -0 "${FC_PID}" 2>/dev/null; then
        kill -TERM "${FC_PID}" 2>/dev/null || true
        wait "${FC_PID}" 2>/dev/null || true
        log_info "Firecracker microVM process (PID ${FC_PID}) terminated."
    fi
    rm -f "${API_SOCKET}" "${VSOCK_SOCKET}"
    log_info "Teardown complete. External Gate EXT-05 microVM terminated safely."
}
trap cleanup EXIT INT TERM

# ------------------------------------------------------------------------------
# 4. Firecracker MicroVM Execution
# ------------------------------------------------------------------------------
log_info "Launching Firecracker microVM using configuration: ${CONFIG_FILE}"
firecracker --api-sock "${API_SOCKET}" --config-file "${CONFIG_FILE}" &
FC_PID=$!
log_info "Firecracker microVM started with PID: ${FC_PID}"

# Wait for process exit or interrupt
wait "${FC_PID}"
