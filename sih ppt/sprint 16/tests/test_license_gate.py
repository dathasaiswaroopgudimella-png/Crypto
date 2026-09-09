import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from license_gate import (
    DEFAULT_IN_BOUNDARY_PACKAGES,
    LicenseViolation,
    categorize_license,
    check_manifest,
    export_sbom,
    generate_cyclonedx_sbom,
    generate_sbom,
    generate_spdx_sbom,
    inspect_installed_packages,
    load_manifest,
    normalize_spdx_license,
    scan_installed_dependencies,
)

MANIFEST_PATH = Path(__file__).resolve().parents[1] / "licenses_manifest.json"


class TestLicenseGate(unittest.TestCase):
    # =========================================================================
    # ORIGINAL BASELINE SUITE (ZERO-REGRESSION VERIFICATION)
    # =========================================================================

    def test_clean_permissive_manifest_passes(self):
        manifest = {"pkg-a": "MIT", "pkg-b": "BSD-3-Clause", "pkg-c": "Apache-2.0"}
        result = check_manifest(manifest)
        self.assertTrue(result.passed)

    def test_intentionally_introduced_copyleft_dependency_fails_build(self):
        # This is the exact DoD requirement: "CI fails the build on an
        # intentionally introduced copyleft-licensed dependency inside the
        # trusted boundary."
        manifest = {"pkg-a": "MIT", "sneaky-new-dep": "GPL-3.0-only"}
        result = check_manifest(manifest)
        self.assertFalse(result.passed)
        categories = {v.category for v in result.violations}
        self.assertIn("strong_copyleft", categories)

    def test_lgpl_is_flagged_but_not_blocking(self):
        manifest = {"pkg-a": "MIT", "pkg-b": "LGPL-2.1-or-later"}
        result = check_manifest(manifest)
        self.assertTrue(result.passed)  # warning only
        self.assertEqual(len(result.violations), 1)
        self.assertEqual(result.violations[0].category, "weak_copyleft_review")

    def test_noncommercial_restricted_license_blocks(self):
        manifest = {"opensmile": "audEERING-NC"}
        result = check_manifest(manifest)
        self.assertFalse(result.passed)
        self.assertEqual(result.violations[0].category, "noncommercial_restricted")

    def test_unknown_license_fails_closed(self):
        manifest = {"mystery-package": "Some-Unrecognized-License"}
        result = check_manifest(manifest)
        self.assertFalse(result.passed)
        self.assertEqual(result.violations[0].category, "unknown_unverified")

    def test_real_manifest_file_is_well_formed_and_flags_known_issues(self):
        manifest = load_manifest(MANIFEST_PATH)
        self.assertIn("opensmile", manifest)
        self.assertIn("bocd", manifest)
        result = check_manifest(manifest)
        self.assertFalse(result.passed)  # opensmile + bocd both block today
        categories = {v.package: v.category for v in result.violations}
        self.assertEqual(categories["opensmile"], "noncommercial_restricted")
        self.assertEqual(categories["bocd"], "unknown_unverified")
        # the confirmed-permissive packages must NOT show up as violations
        for clean_pkg in ("openai-whisper", "pyannote.audio", "hdbscan", "bertopic", "statsmodels"):
            self.assertNotIn(clean_pkg, categories)

    # =========================================================================
    # ENHANCED SUITE: LIVE INSTALLED PACKAGE INSPECTION & SCANNING
    # =========================================================================

    def test_inspect_installed_packages_real_environment(self):
        """Verify live importlib.metadata inspection on installed in-boundary packages."""
        inspected = inspect_installed_packages(DEFAULT_IN_BOUNDARY_PACKAGES)
        for pkg in DEFAULT_IN_BOUNDARY_PACKAGES:
            self.assertIn(pkg, inspected)
            meta = inspected[pkg]
            self.assertEqual(meta.name.lower().replace("_", "-"), pkg)
            self.assertNotEqual(meta.version, "UNKNOWN")
            self.assertFalse(meta.is_blocking, f"Package {pkg} unexpectedly flagged as blocking")
            self.assertEqual(meta.category, "permissive")
            self.assertTrue(meta.purl.startswith(f"pkg:pypi/{pkg}@"))

        # Verify dual licensing extraction for cryptography (dual-licensed Apache-2.0 OR BSD-3-Clause)
        crypto_meta = inspected["cryptography"]
        self.assertTrue(
            "Apache-2.0" in crypto_meta.concluded_license or "BSD-3-Clause" in crypto_meta.concluded_license,
            f"Expected Apache-2.0 or BSD-3-Clause in concluded license: {crypto_meta.concluded_license}",
        )
        self.assertFalse(crypto_meta.is_blocking)
        self.assertEqual(crypto_meta.category, "permissive")

    def test_scan_installed_dependencies_in_boundary_passes(self):
        """Live scanning of default in-boundary dependencies must pass cleanly."""
        result = scan_installed_dependencies()
        self.assertTrue(result.passed)
        for pkg in DEFAULT_IN_BOUNDARY_PACKAGES:
            self.assertIn(pkg, result.clean_packages)
        self.assertEqual(len(result.violations), 0)

    def test_scan_installed_dependencies_blocks_copyleft_gpl_and_agpl(self):
        """CI gate strictly blocks GPL/AGPL copyleft dependencies inside the boundary."""
        manifest = {
            "cryptography": "Apache-2.0",
            "malicious-dep": "GPL-3.0-only",
            "network-daemon": "AGPL-3.0-only",
        }
        result = scan_installed_dependencies(packages=list(manifest.keys()), manifest=manifest)
        self.assertFalse(result.passed)
        blocking_pkgs = {v.package: v.category for v in result.violations if v.is_blocking}
        self.assertEqual(blocking_pkgs.get("malicious-dep"), "strong_copyleft")
        self.assertEqual(blocking_pkgs.get("network-daemon"), "strong_copyleft")
        self.assertIn("cryptography", result.clean_packages)

    def test_scan_installed_dependencies_blocks_noncommercial_audeering(self):
        """CI gate strictly blocks audEERING-NC non-commercial restriction per Addendum 7.4a."""
        manifest = {
            "scikit-learn": "BSD-3-Clause",
            "opensmile": "audEERING-NC",
            "dataset-tool": "CC-BY-NC-4.0",
        }
        result = scan_installed_dependencies(packages=list(manifest.keys()), manifest=manifest)
        self.assertFalse(result.passed)
        blocking_pkgs = {v.package: v.category for v in result.violations if v.is_blocking}
        self.assertEqual(blocking_pkgs.get("opensmile"), "noncommercial_restricted")
        self.assertEqual(blocking_pkgs.get("dataset-tool"), "noncommercial_restricted")

    # =========================================================================
    # ENHANCED SUITE: REAL-TIME SBOM GENERATION (SPDX 2.3 & CYCLONEDX 1.5)
    # =========================================================================

    def test_generate_spdx_sbom_schema_and_integrity(self):
        """Validate live SPDX 2.3 JSON SBOM generation against ISO/IEC 5962:2021 specification."""
        sbom = generate_spdx_sbom()

        # Document level validation
        self.assertEqual(sbom["spdxVersion"], "SPDX-2.3")
        self.assertEqual(sbom["dataLicense"], "CC0-1.0")
        self.assertEqual(sbom["SPDXID"], "SPDXRef-DOCUMENT")
        self.assertIn("documentNamespace", sbom)
        self.assertTrue(sbom["documentNamespace"].startswith("https://spdx.org/spdxdocs/"))

        creation_info = sbom["creationInfo"]
        self.assertIn("created", creation_info)
        self.assertTrue(creation_info["created"].endswith("Z"))
        self.assertIn("Tool: Chronis-LicenseGate-1.0.0", creation_info["creators"][0])
        self.assertEqual(creation_info["licenseListVersion"], "3.22")

        # Packages validation
        packages = sbom["packages"]
        self.assertEqual(len(packages), len(DEFAULT_IN_BOUNDARY_PACKAGES))
        pkg_names = [p["name"] for p in packages]
        for expected in DEFAULT_IN_BOUNDARY_PACKAGES:
            self.assertIn(expected, pkg_names)

        for p in packages:
            self.assertTrue(p["SPDXID"].startswith("SPDXRef-Package-"))
            self.assertFalse(p["filesAnalyzed"])
            self.assertEqual(p["downloadLocation"], "NOASSERTION")
            self.assertNotEqual(p["licenseConcluded"], "NOASSERTION")
            self.assertTrue(len(p["externalRefs"]) > 0)
            self.assertEqual(p["externalRefs"][0]["referenceCategory"], "PACKAGE-MANAGER")
            self.assertEqual(p["externalRefs"][0]["referenceType"], "purl")
            self.assertTrue(p["externalRefs"][0]["referenceLocator"].startswith("pkg:pypi/"))

        # Relationships validation
        relationships = sbom["relationships"]
        self.assertEqual(len(relationships), len(DEFAULT_IN_BOUNDARY_PACKAGES))
        for r in relationships:
            self.assertEqual(r["spdxElementId"], "SPDXRef-DOCUMENT")
            self.assertEqual(r["relationshipType"], "DESCRIBES")
            self.assertTrue(r["relatedSpdxElement"].startswith("SPDXRef-Package-"))

    def test_generate_cyclonedx_sbom_schema_and_integrity(self):
        """Validate live CycloneDX 1.5 JSON SBOM generation against ECMA-419 / v1.5 specification."""
        sbom = generate_cyclonedx_sbom()

        # Root BOM validation
        self.assertEqual(sbom["bomFormat"], "CycloneDX")
        self.assertEqual(sbom["specVersion"], "1.5")
        self.assertTrue(sbom["serialNumber"].startswith("urn:uuid:"))
        self.assertEqual(sbom["version"], 1)

        # Metadata validation
        metadata = sbom["metadata"]
        self.assertIn("timestamp", metadata)
        self.assertTrue(metadata["timestamp"].endswith("Z"))
        self.assertEqual(metadata["component"]["name"], "chronis-sprint16")
        self.assertEqual(metadata["component"]["type"], "application")

        # Components validation
        components = sbom["components"]
        self.assertEqual(len(components), len(DEFAULT_IN_BOUNDARY_PACKAGES))
        for c in components:
            self.assertEqual(c["type"], "library")
            self.assertTrue(c["bom-ref"].startswith("pkg:pypi/"))
            self.assertTrue(c["purl"].startswith("pkg:pypi/"))
            self.assertTrue(len(c["licenses"]) > 0)

        # Dependencies validation
        deps = sbom["dependencies"]
        self.assertTrue(len(deps) > 0)
        self.assertEqual(deps[0]["ref"], metadata["component"]["bom-ref"])
        self.assertEqual(len(deps[0]["dependsOn"]), len(DEFAULT_IN_BOUNDARY_PACKAGES))

    def test_sbom_generation_with_addendum_manifest_packages(self):
        """Validate SBOM generation from Addendum 7.4a manifest file."""
        manifest = load_manifest(MANIFEST_PATH)
        spdx_sbom = generate_spdx_sbom(packages=manifest)
        cyclone_sbom = generate_cyclonedx_sbom(packages=manifest)

        spdx_pkgs = {p["name"]: p for p in spdx_sbom["packages"]}
        self.assertIn("opensmile", spdx_pkgs)
        self.assertIn("bocd", spdx_pkgs)
        self.assertEqual(spdx_pkgs["opensmile"]["licenseConcluded"], "audEERING-NC")
        self.assertEqual(spdx_pkgs["bocd"]["licenseConcluded"], "NOASSERTION")

        cyclone_comps = {c["name"]: c for c in cyclone_sbom["components"]}
        # In CycloneDX, audEERING-NC is non-standard, so it must use license.name
        opensmile_lic = cyclone_comps["opensmile"]["licenses"][0]["license"]
        self.assertEqual(opensmile_lic.get("name"), "audEERING-NC")

        # In CycloneDX, MIT is standard SPDX, so it uses license.id
        whisper_lic = cyclone_comps["openai-whisper"]["licenses"][0]["license"]
        self.assertEqual(whisper_lic.get("id"), "MIT")

    def test_export_sbom_lifecycle(self):
        """Validate exporting SBOM to file system and re-parsing as valid JSON."""
        with tempfile.TemporaryDirectory() as tmpdir:
            spdx_file = Path(tmpdir) / "spdx.json"
            cyclone_file = Path(tmpdir) / "cyclonedx.json"

            out_spdx = export_sbom(spdx_file, format="spdx")
            out_cyclone = export_sbom(cyclone_file, format="cyclonedx")

            self.assertTrue(out_spdx.is_file())
            self.assertTrue(out_cyclone.is_file())

            with open(out_spdx, "r", encoding="utf-8") as f:
                spdx_data = json.load(f)
                self.assertEqual(spdx_data["spdxVersion"], "SPDX-2.3")

            with open(out_cyclone, "r", encoding="utf-8") as f:
                cyclone_data = json.load(f)
                self.assertEqual(cyclone_data["specVersion"], "1.5")

    def test_compound_license_expressions_and_classifiers(self):
        """Validate PEP 639 license expression parsing and Trove classifier resolution."""
        # Dual licensing OR: user can choose permissive
        cat, is_block = categorize_license("Apache-2.0 OR BSD-3-Clause")
        self.assertEqual(cat, "permissive")
        self.assertFalse(is_block)

        cat, is_block = categorize_license("MIT OR GPL-3.0-only")
        self.assertEqual(cat, "permissive")
        self.assertFalse(is_block)

        # Mandatory licensing AND: copyleft or noncommercial constraint binds
        cat, is_block = categorize_license("MIT AND GPL-3.0-only")
        self.assertEqual(cat, "strong_copyleft")
        self.assertTrue(is_block)

        cat, is_block = categorize_license("MIT AND audEERING-NC")
        self.assertEqual(cat, "noncommercial_restricted")
        self.assertTrue(is_block)

        # Trove classifier normalization
        self.assertEqual(
            normalize_spdx_license(None, ["License :: OSI Approved :: MIT License"]),
            "MIT",
        )
        self.assertEqual(
            normalize_spdx_license(None, ["License :: OSI Approved :: Apache Software License"]),
            "Apache-2.0",
        )
        self.assertEqual(
            normalize_spdx_license(None, ["License :: OSI Approved :: GNU General Public License v3 (GPLv3)"]),
            "GPL-3.0-only",
        )

    def test_3_tier_status_table_and_manifest_summary(self):
        """Validate 3-tier dependency table generation and manifest summary."""
        from license_gate import DependencyStatusTier, get_dependency_status_table, format_manifest_summary

        manifest = load_manifest(MANIFEST_PATH)
        table = get_dependency_status_table(manifest=manifest)
        self.assertIn("Dependency | Declared License | Concluded SPDX | Status Tier | Blocking?", table)
        self.assertIn("`opensmile`", table)
        self.assertIn("audEERING-NC", table)
        self.assertIn("Blocking", table)
        self.assertIn("`openai-whisper`", table)
        self.assertIn("Approved", table)

        summary = format_manifest_summary(manifest)
        self.assertIn("In-Boundary Dependency License Governance", summary)
        self.assertIn("License gate implementation validated; current dependency manifest contains unresolved in-boundary blockers", summary)
        self.assertIn("openSMILE audEERING-NC, bocd UNKNOWN", summary)


if __name__ == "__main__":
    unittest.main()
