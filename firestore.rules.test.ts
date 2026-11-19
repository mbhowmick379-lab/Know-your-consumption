import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');

test('firestore.rules exists and enforces rules_version 2 and default deny', () => {
  const rules = fs.readFileSync(rulesPath, 'utf8');
  assert.match(rules, /rules_version\s*=\s*'2';/);
  assert.match(rules, /match\s+\/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
});

test('firestore.rules enforces email_verified, isValidId, and server timestamp integrity', () => {
  const rules = fs.readFileSync(rulesPath, 'utf8');
  assert.match(rules, /request\.auth\.token\.email_verified\s*==\s*true/);
  assert.match(rules, /function isValidId\(id\)/);
  assert.match(rules, /incoming\(\)\.createdAt\s*==\s*request\.time/);
  assert.match(rules, /incoming\(\)\.updatedAt\s*==\s*request\.time/);
});

test('firestore.rules isolates patient PII and covers every collection in firebase-blueprint.json', () => {
  const rules = fs.readFileSync(rulesPath, 'utf8');
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));
  const collections = Object.keys(blueprint.firestore);

  assert.ok(collections.includes('/users/{userId}/private/{docId}'));
  assert.ok(collections.includes('/users/{userId}/dosageRecords/{recordId}'));
  assert.ok(collections.includes('/users/{userId}/interactionRecords/{recordId}'));

  assert.match(rules, /match \/users\/\{userId\}\/private\/\{docId\}/);
  assert.match(rules, /match \/users\/\{userId\}\/dosageRecords\/\{recordId\}/);
  assert.match(rules, /match \/users\/\{userId\}\/interactionRecords\/\{recordId\}/);

  // Query Enforcer: allow list must check resource.data.userId == request.auth.uid
  assert.match(rules, /allow list: if isOwner\(userId\) && isValidId\(userId\) && resource\.data\.userId == request\.auth\.uid;/);
  // Shadow Update Test: affectedKeys().hasOnly(...) required on updates
  assert.match(rules, /incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasOnly\(/);
  // Value Poisoning Test: validation helper must wrap update
  assert.match(rules, /allow update: if isOwner\(userId\)[\s\S]*isValidPatientProfile\(incoming\(\), userId\)/);
  // No blanket reads anywhere
  assert.doesNotMatch(rules, /allow (read|get|list):\s*if\s*isSignedIn\(\)\s*;/);
});

test('firestore.rules strictly validates sex enum and sexDisplay bounds', () => {
  const rules = fs.readFileSync(rulesPath, 'utf8');
  assert.match(rules, /data\.sex in \['male', 'female'\]/);
  assert.match(rules, /data\.sexDisplay\.size\(\) <= 20/);
});

