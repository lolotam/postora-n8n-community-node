# n8n-nodes-postora

This is an [n8n](https://n8n.io/) community node for [Postora](https://postora.cloud) — the AI-powered social media management platform.

Publish content to **Instagram, Facebook, TikTok, YouTube, Twitter/X, LinkedIn, Pinterest, Threads, Bluesky, and Reddit** directly from your n8n workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

1. Go to **Settings → Community Nodes**
2. Click **Install a community node**
3. Enter `n8n-nodes-postora`
4. Click **Install**

## Operations

### Post
- **Create** — Publish content to one or more social media platforms
- **Get Status** — Check the publishing status of a post
- **List** — List recent posts with optional status filter

### Media
- **Upload** — Upload an image or video file to use in posts

### Account
- **List** — List all connected social media accounts

## Credentials

You need a Postora API key to use this node:

1. Sign up at [postora.cloud](https://postora.cloud)
2. Go to **Settings → API Keys**
3. Generate a new API key
4. In n8n, create a new **Postora API** credential and paste the key

## Usage Examples

### Schedule a Post to Instagram

1. Add a **Postora** node to your workflow.
2. Set **Resource** to `Post`.
3. Set **Operation** to `Create`.
4. Set **Platform** to `Instagram`.
5. In **Social Accounts**, select the Instagram account(s) to publish to.
6. (Optional) Set **Post Type** to `Reel` for short-form video or `Story` for ephemeral content.
7. Write your **Caption** (disabled for Stories — only media is posted).
8. Set **Media Source** to `URL` and paste a direct image or video URL (e.g. `https://example.com/photo.jpg`).
9. (Optional) Set **Schedule At** to a future date/time to publish later. Leave empty to post immediately.
10. (Optional) Expand **Additional Options** and add a **First Comment**.
11. Execute the node. The response includes a `post_id` you can use to check status later.

### List Connected Accounts

Use this to verify your credentials work and discover which social accounts are available:

1. Add a **Postora** node to your workflow.
2. Set **Resource** to `Account`.
3. Set **Operation** to `List`.
4. Execute the node. The output lists every connected social account with its ID, name, and platform.

### Publish a YouTube Video

1. Add a **Postora** node to your workflow.
2. Set **Resource** to `Post`.
3. Set **Operation** to `Create`.
4. Set **Platform** to `YouTube`.
5. In **Social Accounts**, select the YouTube channel to publish to.
6. Write your video description in **Caption**.
7. Set **Media Source** to `URL` and paste a direct video URL.
8. Expand **Additional Options** and configure:
   - **YouTube Title** — the video title.
   - **YouTube Visibility** — `Public`, `Unlisted`, or `Private`.
   - **YouTube Category** — category ID (default: `22` for People & Blogs).
9. Execute the node.

## Platform-Specific Options

When creating a post, you can set platform-specific options:

| Platform | Options |
|----------|---------|
| YouTube | Title, Privacy (public/unlisted/private), Category ID |
| TikTok | Privacy level, Allow Comments/Duet/Stitch |
| Pinterest | Board ID, Title |
| Reddit | Subreddit, Title |

## Media Source Options

When creating a post, you can attach media using one of three methods:

| Source | Description |
|--------|-------------|
| **None** | Text-only post, no media attached |
| **URL** | Provide one or more comma-separated media URLs (e.g., `https://example.com/photo1.jpg,https://example.com/photo2.jpg`) |
| **Binary Data** | Attach binary file(s) from previous nodes. Specify property names as comma-separated values (e.g., `data,data1,data2`) to upload multiple files at once |

### Binary Data Details

To use binary data:
1. Connect a node that outputs binary data (e.g., HTTP Request, Read Binary File)
2. Select **Binary Data** as the Media Source
3. Enter the binary property name(s) — default is `data`
4. For multiple files, use comma-separated names: `data,data1,data2`

Binary files are automatically converted to base64 and sent via the `media_base64` API parameter.

## Troubleshooting

### "Could not find any entity of type BinaryDataFile matching..."

This error comes from n8n itself, not from this node — it means n8n can no longer find the actual file bytes for a binary field on the item you're processing.

The most common cause: the upstream node's output was **pinned** (📌) in the n8n editor while you were building the workflow. Pinning freezes the *shape* of the data, but the underlying file content lives in n8n's own storage and can be cleaned up over time (e.g. on restart, or by n8n's execution data retention settings). Once that happens, the pinned item still *looks* like it has a file attached, but reading it fails with this error.

**Fix:** unpin the upstream node (click the pin icon again to remove it) and re-run the workflow with a fresh execution before testing **Media → Upload** or **Post → Create** with binary data.

## Resources

- [Postora Website](https://postora.cloud)
- [API Documentation](https://postora.cloud/docs/api)
- [n8n Community Nodes Docs](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE.md)
