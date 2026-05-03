// netlify/functions/submit.mjs
//
// POST /submit
// Receives a JSON questionnaire payload from the form, formats it, and creates
// a GitHub Issue in the configured private repo. Each issue is tagged with a
// `client:<slug>` label so submissions are filterable/searchable.
//
// Environment variables required (set in Netlify dashboard, Site → Settings → Env):
//   GITHUB_TOKEN  Personal Access Token with `repo` scope (fine-grained: Issues = read+write)
//   GITHUB_REPO   The "owner/repo" that will store submissions, e.g. "tscarlisle/cma-questionnaire"
//
// Optional:
//   ALLOWED_ORIGIN  If set, restricts CORS to that origin. Defaults to "*".
//
// Returns: { ok: true, issueUrl: "https://github.com/.../issues/123" }

export default async (req, context) => {
  const allowedOrigin = Netlify.env.get('ALLOWED_ORIGIN') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  let data;
  try {
    data = await req.json();
  } catch (e) {
    return jsonResponse({ ok: false, error: 'Invalid JSON' }, 400, corsHeaders);
  }

  // Minimal validation
  if (!data || typeof data !== 'object' || !data.name || !data.email) {
    return jsonResponse({ ok: false, error: 'Missing name or email' }, 400, corsHeaders);
  }

  const token = Netlify.env.get('GITHUB_TOKEN');
  const repo  = Netlify.env.get('GITHUB_REPO');
  if (!token || !repo) {
    return jsonResponse(
      { ok: false, error: 'Server is missing GITHUB_TOKEN or GITHUB_REPO configuration' },
      500,
      corsHeaders
    );
  }

  const slug = slugify(data.name);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const title = `${data.name} — Design Questionnaire — ${dateStamp}`;
  const body = formatMarkdown(data);
  const labels = ['intake', `client:${slug}`];

  // Create issue
  let issueRes;
  try {
    issueRes = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'cma-questionnaire',
      },
      body: JSON.stringify({ title, body, labels }),
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Network error contacting GitHub: ' + err.message }, 502, corsHeaders);
  }

  if (!issueRes.ok) {
    // Common cause: label doesn't exist yet on a fresh repo. Fall back without labels.
    const errBody = await issueRes.text();
    if (issueRes.status === 422 && /label/i.test(errBody)) {
      const retry = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'cma-questionnaire',
        },
        body: JSON.stringify({ title, body }),
      });
      if (retry.ok) {
        const issue = await retry.json();
        return jsonResponse({ ok: true, issueUrl: issue.html_url, note: 'created without labels (run create-labels.sh once to enable tagging)' }, 200, corsHeaders);
      }
      return jsonResponse({ ok: false, error: 'GitHub: ' + (await retry.text()) }, retry.status, corsHeaders);
    }
    return jsonResponse({ ok: false, error: 'GitHub: ' + errBody }, issueRes.status, corsHeaders);
  }

  const issue = await issueRes.json();
  return jsonResponse({ ok: true, issueUrl: issue.html_url }, 200, corsHeaders);
};

export const config = { path: '/submit' };

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────
function jsonResponse(payload, status, headers) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function slugify(s) {
  return (s || 'unknown')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';
}

function formatMarkdown(d) {
  const line = (label, value) => {
    if (!value || (Array.isArray(value) && value.length === 0)) return `**${label}:** —\n`;
    if (Array.isArray(value)) return `**${label}:** ${value.join(', ')}\n`;
    if (typeof value === 'string' && value.includes('\n')) {
      return `**${label}:**\n\n${value.split('\n').map(l => '> ' + l).join('\n')}\n\n`;
    }
    return `**${label}:** ${value}\n`;
  };

  const submitted = d.submitted_at ? new Date(d.submitted_at).toLocaleString() : new Date().toLocaleString();
  let out = `*Submitted ${submitted}*\n\n`;
  out += `**Email:** ${d.email || '—'}  \n`;
  out += `**Phone:** ${d.phone || '—'}  \n`;
  out += `**Project location:** ${d.address || '—'}\n\n---\n\n`;

  if (d.notes && d.notes.trim()) {
    out += `## Opening notes\n\n${d.notes.trim()}\n\n---\n\n`;
  }

  out += `## §1 Contact\n`;
  out += line('Name', d.name);
  out += line('Partner', d.partner);
  out += line('Email', d.email);
  out += line('Phone', d.phone);
  out += line('Project location', d.address);
  out += line('Referral', d.referral);
  out += line('Referral detail', d.referral_detail);

  out += `\n## §2 You and your life\n`;
  out += line('Household', d.household);
  out += line('Weekly rhythm', d.rhythm);
  out += line('Lifestyle', d.lifestyle);

  out += `\n## §3 Project\n`;
  out += line('Type', d.project_type);
  out += line('Square footage', d.sqft);
  out += line('Stories', d.stories);
  out += line('Builder', d.builder);
  out += line('Prior architect', d.prior_architect);

  out += `\n## §4 Character\n`;
  out += line('Style resonance', d.style_cards);
  out += line('In their words', d.style_words);
  out += line('References', d.references);
  out += line('What to avoid', d.avoid);

  out += `\n## §5 Spaces\n`;
  out += line('Bedrooms', d.bedrooms);
  out += line('Primary bedroom', d.primary_bedroom);
  out += line('Bathrooms', d.bathrooms);
  out += line('Spaces', d.spaces);
  out += line('Key spaces detail', d.key_spaces);
  out += line('Storage', d.storage);

  out += `\n## §6 Site\n`;
  out += line('Site strengths', d.site_best);
  out += line('Challenges + constraints', d.site_worst_and_constraints);
  out += line('Arrival + outdoor', d.arrival_and_outdoor);

  out += `\n## §7 Budget & timeline\n`;
  out += line('Budget', d.budget);
  out += line('Fee preference', d.fee_preference);
  out += line('Construction start', d.construction_start);
  out += line('Target move-in', d.target_movein);

  out += `\n## §8 Last thoughts\n`;
  out += line('Priority', d.priority);
  out += line('Concerns', d.concerns);
  out += line('Feeling', d.feeling);
  out += line('Other', d.other);

  out += `\n---\n<details><summary>Raw JSON</summary>\n\n\`\`\`json\n${JSON.stringify(d, null, 2)}\n\`\`\`\n</details>\n`;

  return out;
}
