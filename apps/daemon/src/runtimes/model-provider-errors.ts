function providerDetail(raw: string): string {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart)) as { detail?: unknown };
      if (typeof parsed.detail === 'string' && parsed.detail.trim()) {
        return parsed.detail.trim();
      }
    } catch {
      // Preserve the original text when the provider's JSON is malformed.
    }
  }
  return trimmed;
}

export function isOpenAiChatGptModelProviderError(raw: string): boolean {
  return (
    /model/i.test(raw) &&
    /not supported/i.test(raw) &&
    /codex/i.test(raw) &&
    /chatgpt\s+account/i.test(raw)
  );
}

export function formatModelProviderError(raw: string, agentName: string): string {
  const prefix = `${agentName} rejected the selected model.`;
  if (raw.startsWith(prefix)) return raw;
  return `${prefix} Choose a different ${agentName} model or sign in with a different account, then retry. Technical detail: ${providerDetail(raw)}`;
}
