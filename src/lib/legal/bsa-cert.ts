export class BsaCertificateGenerator {
  /**
   * Generates formatted text for Section 63 BSA 2023 Electronic Evidence Certificate
   */
  static generateBsaCertificate(
    sha256Hash: string,
    extractedTimestampUtc: string,
    officerName: string,
    systemName: string = "AEGIS-TRACE Autonomous Forensic Node v1.0"
  ): string {
    return `CERTIFICATE UNDER SECTION 63 OF THE BHARATIYA SAKSHYA ADHINIYAM (BSA, 2023)
========================================================================================

I, \${officerName}, do hereby certify and confirm as follows:

1. I am an authorized investigating officer operating the electronic system known as \${systemName}.
2. The cryptographic graph traversal and blockchain log extraction output bearing SHA-256 state checksum:
   [\${sha256Hash}]
   was produced by the computer system during a period over which the computer was used regularly to store and process digital asset forensic records.
3. The on-chain records were queried directly from decentralized consensus nodes on Ethereum / TRON ledgers without manual interpolation or data tampering.
4. Timestamp of extraction: \${extractedTimestampUtc} (UTC).
5. The digital output accurately reproduces the transactions, micro-gas refills, and sweeping events recorded on the respective distributed ledgers.

Date: \${new Date().toLocaleDateString("en-IN")}
Place: Cyber Crime Police Station / MHA Nodal Center
Signature: ___________________________
`;
  }
}
