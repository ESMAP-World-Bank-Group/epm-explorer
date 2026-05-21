const OWNER = import.meta.env.VITE_GITHUB_OWNER || 'ESMAP-World-Bank-Group'
const REPO  = import.meta.env.VITE_GITHUB_REPO  || 'EPM'
const TOKEN = import.meta.env.VITE_GITHUB_TOKEN  || ''

const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}

// Accepts eapp_2026 AND sapp_new2025 (no underscore before year)
export const BRANCH_PATTERN = /^([a-z][a-z_]*)_?(\d{4})$/

export function parseBranch(name) {
  const m = name.match(BRANCH_PATTERN)
  if (!m) return null
  return { branch: name, model: m[1].replace(/_$/, ''), year: parseInt(m[2]) }
}

export async function listBranches() {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/branches?per_page=100`,
    { headers }
  )
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
  const data = await res.json()
  return data.map(b => b.name).filter(n => BRANCH_PATTERN.test(n)).map(parseBranch)
}

export function rawUrl(branch, path) {
  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${branch}/${path}`
}

export async function fetchText(branch, path) {
  const res = await fetch(rawUrl(branch, path), { headers })
  if (!res.ok) throw new Error(`404: ${path} on ${branch}`)
  return res.text()
}

export async function fetchJson(branch, path) {
  const text = await fetchText(branch, path)
  return JSON.parse(text)
}
