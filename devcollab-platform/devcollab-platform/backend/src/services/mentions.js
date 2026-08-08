export function extractMentions(body) {
  return [...new Set((body.match(/@[a-zA-Z0-9._-]+/g) || []).map(x => x.slice(1).toLowerCase()))];
}
