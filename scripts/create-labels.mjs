// scripts/create-labels.mjs
//
// Run once after creating the repo to seed the standard labels.
//   GITHUB_TOKEN=ghp_... GITHUB_REPO=owner/repo node scripts/create-labels.mjs
//
// Idempotent — skips labels that already exist.

const token = process.env.GITHUB_TOKEN;
const repo  = process.env.GITHUB_REPO;
if (!token || !repo) {
  console.error('Missing GITHUB_TOKEN or GITHUB_REPO env vars.');
  process.exit(1);
}

const labels = [
  { name: 'intake',     color: 'd04030', description: 'New design questionnaire submission' },
  { name: 'qualified',  color: '3a7060', description: 'Reviewed and qualified to schedule a call' },
  { name: 'declined',   color: '8a8a8a', description: 'Reviewed and declined' },
  { name: 'follow-up',  color: 'a06010', description: 'Needs a follow-up touch' },
];

for (const lbl of labels) {
  const res = await fetch(`https://api.github.com/repos/${repo}/labels`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'cma-questionnaire-setup',
    },
    body: JSON.stringify(lbl),
  });
  if (res.ok) {
    console.log(`✓ Created label "${lbl.name}"`);
  } else if (res.status === 422) {
    console.log(`· Label "${lbl.name}" already exists`);
  } else {
    const err = await res.text();
    console.error(`✗ Failed to create "${lbl.name}": ${res.status} ${err}`);
  }
}
console.log('Done.');
