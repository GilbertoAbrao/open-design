@AGENTS.md

## User-documentation delivery

For every implementation task, read the canonical
[User-Documentation contract in wxk-support](https://github.com/GilbertoAbrao/wxk-support/blob/main/documentation/README.md)
and follow its
[executable dev-time procedure](https://github.com/GilbertoAbrao/wxk-support/blob/main/documentation/dev-time.md).
Do this before implementation, even when the task was not preclassified as user-visible.

Run `user_documentation.py begin` before implementation. When documentation is
required, update the paired central documentation during the task. Before the final
handoff or PR, run `user_documentation.py check` and include its generated evidence
in the PR's User documentation section. An already-running session must reread both
central documents and run `user_documentation.py begin` before its next delivery.

Keep this entry as a pointer. The rules and executable procedure remain central;
do not copy them into this repository.
