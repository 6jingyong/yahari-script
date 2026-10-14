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

2026-10-12 extension: binary `.yahari` bundle validation runs before the same Core gate; files are bounded to 32 MB and expanded media to the existing project limit. The browser previews before import, saves the existing work, and creates a copy on duplicate project identity. Active editing position is stored separately from the entry scene. Real browser import/export, custom images, failed-save transaction rollback and restoration are now verified; see [PROJECT_FILES_AND_SAVING.md](PROJECT_FILES_AND_SAVING.md).
