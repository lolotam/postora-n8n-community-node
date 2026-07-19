# LinkedIn Personal And Commercial Destinations

## Goal

Allow one Postora n8n node to publish a LinkedIn post to any combination of a connected personal profile and the LinkedIn organization pages that profile administers.

## User Experience

- The platform selector displays `LinkedIn`, with no personal-account limitation label.
- The existing `Social Accounts` multi-select remains the only account-selection control.
- For LinkedIn, it lists the connected personal profile and each administered organization page together:
  - `Jane Doe (personal)`
  - `Acme Inc. (commercial)`
- Users can select one or more destinations in a single node execution.

## Data Contract

LinkedIn pages are stored in the connected personal account's `account_metadata.linkedin_pages`, not as separate `social_accounts` rows. The account-list endpoint must therefore return destination data for each LinkedIn connection.

Each LinkedIn option must carry an opaque selection value containing:

- The connected `social_accounts.id`, used to obtain the access token.
- A destination ID: `personal` for the connected profile or the LinkedIn organization ID for a commercial page.

The node must send the selected connection IDs in `account_ids` and the selected LinkedIn destinations in a separate request field. The API must validate that each commercial destination belongs to its associated connection before recording it in the post metadata. The worker must read the same metadata representation and publish once to every validated destination.

## Compatibility

- Existing saved workflows continue to submit plain `social_accounts.id` values and retain personal-profile publishing behavior.
- Existing LinkedIn `linkedin_page_id` input remains supported as a legacy fallback by the backend worker.
- Non-LinkedIn account selection and payloads are unchanged.

## Testing

- Verify LinkedIn load options include personal and commercial labels and preserve the parent account ID plus destination ID.
- Verify a mixed personal-and-commercial selection generates unique `account_ids` and the expected LinkedIn destination payload.
- Verify malformed or unauthorized commercial destination selections are rejected by the API.
- Run the community-node type check, Jest suite, and build. Rebuild and commit `dist`.

## Repository And Release Workflow

- Apply community-node source, tests, package version, and generated `dist` changes in this repository.
- Mirror the same community-node package files to `F:\Postora_new\Postora-n8n-community-node` and commit them on its current feature branch without touching unrelated worktree changes.
- Bump the community package from `1.1.14` to `1.1.15`.
- Commit and push the standalone community-node repository, then create GitHub release `v1.1.15`. Its release-created workflow publishes the package to npm.
