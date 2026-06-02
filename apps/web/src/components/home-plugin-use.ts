/**
 * In the WXCode embed, the user's plugin pick must become the *executable*
 * (active/pinned) plugin so its SKILL.md drives generation — not the
 * auto-applied generic `example-web-prototype`. Outside the embed we keep
 * upstream behavior, where "Use" attaches the plugin as an `@`-context
 * reference only.
 */
export function resolvePluginUseMode(opts: { embed: boolean }): 'pin' | 'context' {
  return opts.embed ? 'pin' : 'context';
}
