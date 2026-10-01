# ChatGPT Project Continuation Instructions

Use these instructions in a ChatGPT Project, Work workspace, or any ChatGPT session that has access to this repository.

## Mandatory startup

Before helping with meaningful project work:

1. Read `AGENTS.md`.
2. Read `docs/handoff/CURRENT_HANDOFF.md`.
3. Verify important state against the files currently available.
4. Continue from `Exact next action` unless the user's current request overrides it.

## Mandatory finish

After meaningful project-changing work, update:

`docs/handoff/CURRENT_HANDOFF.md`

before considering the task complete.

The handoff must reflect only verified work from the current session.

## If local files are not writable

If this ChatGPT session cannot directly modify the repository:

1. Do not claim the handoff was updated.
2. Produce a complete replacement body for `docs/handoff/CURRENT_HANDOFF.md`.
3. Tell the user that the repository copy still needs to be written/synchronized by a file-capable session.

## Never include secrets

Do not copy passwords, API keys, tokens, cookies, private keys, or `.env` values into the handoff.

## Completion message

When the repository file was actually updated, end with:

`Cross-device handoff updated.`
