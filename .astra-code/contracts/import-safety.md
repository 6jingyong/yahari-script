# Import safety contract

Objective: reject structurally unsafe projects before activation while retaining repairable semantic errors.
Scope: Core decoder, browser activation boundary, regression tests and current architecture documentation.
Excluded: new features, appearance redesign, adapter changes, ID renumbering, cloud storage.

Acceptance:
1. Null manifest references and malformed cast members return an error result without throwing.
2. Legacy bare documents receive supported-version and identity checks before binding.
3. Duplicate cast/pack/document declarations and duplicate block/token identities within a document are rejected.
4. Valid multi-document content and extension metadata round-trip unchanged.
5. Missing dependencies retain read-only availability; unknown tokens and missing cast references remain diagnosable data.
6. Every explicit browser activation path checks the candidate before changing current project/store/storage.
7. Existing compiler, editor and playback regressions remain green.

Evidence: npm test; static-smoke.mjs; node --check; separate read-only review. Browser interaction and storage integration were not automated this milestone.
