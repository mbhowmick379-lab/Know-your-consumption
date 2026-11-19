# DoseSafe Firestore Security Specification (Phase 0)

## 1. Data Invariants & Relationship Mapping
- **Master Source of Truth**: Every clinical record is strictly scoped under `/users/{userId}` where `{userId}` MUST equal `request.auth.uid`.
- **PII & Clinical Isolation**: Patient profiles live in `/users/{userId}/private/profile` (explicit split-collection private namespace). No cross-user read, list, create, update, or delete is permitted under any circumstance.
- **Verified Identity Mandate**: All reads and writes require `request.auth != null && request.auth.token.email_verified == true`.
- **Immutable Audit Fields**: `userId` and `createdAt` are immutable after creation; timestamps MUST match `request.time`.
- **Volumetric Bounds**: Every string field enforces strict `.size()` limits and every array enforces strict `.size() <= MAX` limits plus index-0 type guarding.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated Read**: `get /users/alice/private/profile` with `auth = null`.
2. **Cross-User PII Read**: `get /users/alice/private/profile` as verified user `bob`.
3. **Unverified Email Write**: `create /users/alice/private/profile` with `email_verified = false`.
4. **Identity Spoofing**: `create /users/alice/dosageRecords/rec_1` as `alice` with payload `userId: "bob"`.
5. **Shadow / Ghost Field Injection**: `create /users/alice/private/profile` with extra field `isAdmin: true` or `role: "clinician"`.
6. **ID Poisoning**: `create /users/alice/dosageRecords/<200-char-invalid-id$!>` attempting oversized/malformed path ID.
7. **Timestamp Forgery**: `create /users/alice/dosageRecords/rec_2` with client-backdated `createdAt` not equal to `request.time`.
8. **Immutable Field Mutation**: `update /users/alice/private/profile` modifying `createdAt` or `userId`.
9. **Value Poisoning on Update**: `update /users/alice/private/profile` setting `displayName` to a 500-character string or non-string boolean.
10. **Array Exhaustion (Denial of Wallet)**: `create /users/alice/private/profile` with 100 entries in `allergies` (exceeds max 25).
11. **Invalid Enum Injection**: `create /users/alice/interactionRecords/int_1` with `overallSeverity: "super_critical"`.
12. **Blanket Query Scraping**: `list /users/alice/dosageRecords` as `bob` or querying without `userId == request.auth.uid` satisfaction.
