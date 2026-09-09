# Chronis Sprint 16 — External Gate EXT-05 Deployment Guide
## MicroVM Hardware Virtualization & gVisor Container Isolation Boundaries

### Overview and Purpose of External Gate EXT-05
External Gate EXT-05 establishes the hardware and kernel isolation perimeter mandated by Chronis Architecture Specification Parts 4.2 and 5.24. When sensitive biometric transcripts, medical inference models, or cryptographic keys are processed, standard user-space process boundaries cannot defend against speculative execution vulnerabilities, root-level memory dumpers, or untrusted co-tenant processes. Gate EXT-05 guarantees that all Mode A (Cloud) and Mode B (Local) high-assurance processing workloads execute strictly inside virtualized microVMs (via Firecracker) or user-space sandboxed application kernels (via gVisor `runsc`).

Under this gate, the host operating system never has direct access to unencrypted plaintext buffers in its shared user space. Plaintext is decrypted inside the isolated guest boundary into RAM-pinned `SecureBuffer` instances, processed to generate encrypted or redacted outputs, and immediately subjected to hardware-level C `ctypes.memset` zero-fill on container teardown.

---

### Security Architecture & Virtualization Boundaries

#### 1. Firecracker Hardware-Isolated MicroVM
Firecracker provides hardware-level virtualization through the Linux Kernel-based Virtual Machine (KVM) interface. Each microVM runs an isolated Linux guest kernel with a dedicated virtual CPU and a strictly bounded physical RAM allocation of 256 MiB. Communication between the host and the guest occurs over an authenticated virtio-vsock communication channel (`/run/chronis/v.sock`, Guest CID 3), avoiding unencrypted network interfaces for sensitive control planes. Virtual machine page tables are isolated by hardware second-level address translation (EPT on Intel, NPT on AMD), guaranteeing that memory cannot be read by other guest processes or host user-space programs without hypervisor interception.

#### 2. gVisor User-Space Sandboxed Container (`runsc`)
For containerized Kubernetes and OCI environments where microVM deployment is restricted by bare-metal virtualization quotas, gVisor provides a defense-in-depth application kernel. The `runsc` engine intercepts every system call executed by the container runtime inside user space using the Sentry process. The host kernel is never exposed to raw system calls from untrusted code. Our specification enforces isolated mount namespaces, isolated user namespaces (`uidMappings` and `gidMappings` mapping non-root IDs to container root), and a fail-closed seccomp filter where all unlisted syscalls default to `SCMP_ACT_ERRNO`.

---

### Host Operating System Prerequisites

To deploy Gate EXT-05 in a production Linux host environment, ensure the following kernel features and packages are active:
- Linux kernel version 5.10 or higher with KVM support enabled (`kvm_intel` or `kvm_amd`).
- Hardware virtualization extensions enabled in host firmware (Intel VT-x or AMD-V).
- Host access to `/dev/kvm` with read/write permissions for the `chronis` service account.
- Kernel module `vhost_vsock` loaded via `modprobe vhost_vsock` for low-latency host-guest IPC.
- `iproute2` and `iptables` installed for network TAP provisioning and traffic forwarding.
- Firecracker release v1.4.0+ installed at `/usr/local/bin/firecracker`.
- gVisor `runsc` release 20240101.0+ installed at `/usr/local/bin/runsc`.

---

### Firecracker MicroVM Production Deployment

#### Step 1: Provision Kernel and Root Filesystem
Obtain or build an uncompressed Linux kernel binary stripped of unnecessary device drivers:
```bash
sudo mkdir -p /boot /var/lib/chronis /run/chronis /var/log/chronis
sudo curl -fsSL -o /boot/vmlinux https://s3.amazonaws.com/spec.ccfc.min/img/quickstart_guide/x86_64/kernels/vmlinux-5.10.186
```
Construct the read-only or read-write ext4 root filesystem containing Python 3.10+, the Chronis processing worker, and minimal shared runtime dependencies:
```bash
sudo dd if=/dev/zero of=/var/lib/chronis/rootfs.ext4 bs=1M count=512
sudo mkfs.ext4 /var/lib/chronis/rootfs.ext4
```

#### Step 2: Configure the MicroVM Specification
The Firecracker configuration file `firecracker_vm_spec.json` defines the hardware envelope for the guest:
- vCPU count: 2
- Memory allocation: 256 MiB (`mem_size_mib: 256`)
- Kernel path: `/boot/vmlinux`
- Rootfs path: `/var/lib/chronis/rootfs.ext4`
- Network TAP interface: `tap0` with host MAC address pairing
- Virtio-vsock device: Guest CID 3, UDS path `/run/chronis/v.sock`

#### Step 3: Launch Firecracker MicroVM
Execute the launch script as root or a user with KVM permissions:
```bash
sudo chmod +x microvm/launch_firecracker.sh
sudo ./microvm/launch_firecracker.sh
```
The script performs environmental validation, allocates the `tap0` interface, cleans stale Unix domain sockets, and starts Firecracker in fail-closed configuration. Upon shutdown, traps guarantee that the microVM process is terminated and sockets are removed from the filesystem.

---

### gVisor Sandbox Production Deployment

#### Step 1: Prepare OCI Bundle
gVisor utilizes the Open Container Initiative specification. The provided `runsc_spec.json` is automatically placed into `/var/lib/chronis/runsc-bundle/config.json` by the launcher:
```bash
sudo mkdir -p /var/lib/chronis/runsc-bundle/rootfs
```

#### Step 2: Namespace & Resource Limits
The gVisor specification restricts container capabilities to a minimal set:
- Memory ceiling: 256 MiB (`limit: 268435456`) with `swap: 0` to prevent plaintext paging.
- Memory locking ceiling: `RLIMIT_MEMLOCK` set to 64 MiB, enabling `VirtualLock`/`mlock` in `SecureBuffer`.
- User namespace isolation: Maps container UID 0 to host UID 100000, ensuring an escape cannot gain host root.
- Seccomp whitelist: Allows strictly essential primitives (memory allocation, locks, futexes, epoll) and denies all peripheral system calls.

#### Step 3: Launch gVisor Sandbox
Execute the gVisor launcher:
```bash
sudo chmod +x microvm/launch_gvisor.sh
sudo ./microvm/launch_gvisor.sh
```
The script evaluates host hardware virtualization; if `/dev/kvm` is present, it selects the high-performance `kvm` platform. Otherwise, it gracefully falls back to `systrap`.

---

### Security Boundaries & Memory Forensics Verification

#### Fail-Closed Enforcement
The `IsolatedProcessingContainer` refuses to execute any decryption or processing unless a valid hypervisor runtime is present, unless the caller explicitly sets `allow_no_isolation=True` during local testing. In production, attempting to process without Firecracker or gVisor raises `SandboxRuntimeUnavailable`.

#### Memory Forensics Validation
Every processing lifecycle is verified against three constitutional invariants:
1. **Gate T16.1**: Decrypted plaintext exists solely in RAM within the guest boundary and is pinned via physical page locking to prevent swap persistence.
2. **Gate T16.2**: Ephemeral session keys expire strictly after 24 hours, enforced by the Constitutional Layer client.
3. **Gate T16.3**: Upon container completion or uncaught exception, `SecureBuffer.zero()` immediately executes a C-level pointer memset across the entire buffer address range. Memory forensics scanners (`scan_process_memory_for_secret`) inspect memory regions and confirm exactly 0 recoverable occurrences of plaintext secrets post-teardown.
