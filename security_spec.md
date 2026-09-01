# Security Specification for Firestore Rules

## 1. Data Invariants
1. A user cannot read or update another user's private profile or balance.
2. Only verified administrators can adjust wallet balances, approve deposits, or alter global pricing and API keys.
3. Client users can create deposit requests strictly with status 'pending' and bound to their own authenticated UID.
4. Activations and Mail activations are queryable only by the owner user or administrators (or via token verification for public viewing).
5. All write operations must enforce structural schema validity, bounded size limits, and non-bypassable role checks.

## 2. The Dirty Dozen Payloads (Target Test Payloads)
1. **User Profile Role Escalation**: Attempting to set `role: "admin"` on account registration. (Rejected)
2. **Ghost Field Injection**: Attempting to insert arbitrary metadata into user profiles. (Rejected)
3. **Cross-User Wallet Modification**: Attempting to set or increment another user's balance. (Rejected)
4. **Deposit Request Self-Approval**: Creating a deposit request with `status: "approved"`. (Rejected)
5. **Deposit Request Owner Hijack**: Creating a deposit request with `userId` set to another user's UID. (Rejected)
6. **Malicious ID Injection**: Attempting to query with oversize or special characters as document ID. (Rejected)
7. **Facebook ID Inventory Leak**: Non-admin querying all unsold Facebook IDs in inventory. (Rejected)
8. **Settings Tampering**: Unauthenticated user attempting to modify global provider credentials. (Rejected)
9. **Admin List Snooping**: Non-admin attempting to list all registered users and their emails. (Rejected)
10. **Activation Hijack**: User attempting to read another client's SMS activation codes. (Rejected)
11. **Terminal Deposit State Bypass**: User attempting to change status of rejected/approved deposit request. (Rejected)
12. **Anonymous Write Attack**: Unauthenticated actor attempting to write to any collection. (Rejected)
