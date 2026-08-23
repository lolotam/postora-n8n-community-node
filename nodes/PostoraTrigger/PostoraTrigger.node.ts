import {
  IAllExecuteFunctions,
  IHookFunctions,
  ILoadOptionsFunctions,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
  NodeConnectionTypes,
} from "n8n-workflow";
import {
  isAlreadyGone,
  listWebhooks,
  sameEventSet,
  unregisterWebhook,
  WebhookListing,
  WebhookRegistration,
} from "../shared/webhookLifecycle";

// n8n reads parameters straight off the stored node, and throws for one it has never stored,
// so every read here passes the property's own default as the fallback.
function eventsForCategories(context: IHookFunctions, categories: string[]): string[] {
  const events: string[] = [];
  if (categories.includes("post")) events.push("post.completed");
  if (categories.includes("message")) {
    events.push(...(context.getNodeParameter("messageEvents", ["message.received"]) as string[]));
  }
  if (categories.includes("comment")) {
    events.push(...(context.getNodeParameter("commentEvents", ["comment.received"]) as string[]));
  }
  // "All Platforms" alongside a specific platform is harmless — Postora matches a payload
  // against the whole list and delivers once per subscription — so only exact repeats are dropped.
  return [...new Set(events)];
}

// Version 1 listed every event in one flat "Events" multi-select, which put Threads beside
// WhatsApp under the message family even though Postora only ever emits Threads activity as
// a comment envelope. Version 2 asks for the category first so the impossible pairings are
// not offered at all. Version 1 nodes keep reading their saved "events" selection.
function resolveSubscribedEvents(context: IHookFunctions): string[] {
  const events = context.getNodeParameter("events", []) as string[];
  const typeVersion = context.getNode().typeVersion || 1;
  if (typeVersion < 2) return events;
  if (typeVersion >= 3) {
    if (events.length > 0) return events;
    throw new Error("Select at least one Event before activating the Postora Trigger.");
  }

  const categories = context.getNodeParameter("eventCategories", []) as string[];
  if (categories.length > 0) return eventsForCategories(context, categories);

  // Adding this node from the triggers side panel writes the chosen event straight into
  // `events`, which version 2 hides. Honouring it here is what makes those nine panel
  // entries produce the subscription they name. Any category selection takes precedence
  // over it, so the two can never combine into a subscription nobody asked for — clearing
  // every category does fall back to it again rather than erroring.
  if (events.length > 0) return events;

  throw new Error(
    "Select at least one Event Category, and at least one platform inside it, before activating the Postora Trigger.",
  );
}

// Version 3 folds the Comment Trigger's Platform and Account filters into this node, so one
// trigger covers every Postora event. Postora applies both filters to message and comment
// envelopes; a post.completed event carries no single platform or account and is delivered
// regardless. Both are stored on the subscription and matched server-side.
type SubscriptionFilters = { platform: string; socialAccountId: string };

// Fallbacks of "" rather than throwing: a version 1 or 2 node never stored either parameter.
function readFilters(context: IHookFunctions): SubscriptionFilters {
  return {
    platform: (context.getNodeParameter("platform", "") as string) || "",
    socialAccountId: (context.getNodeParameter("socialAccountId", "") as string) || "",
  };
}

// A filter left at "All" is omitted rather than sent empty: the dispatcher treats an absent
// filter as accept-all, which is also what every subscription registered before filters
// existed looks like.
function registrationBody(callbackUrl: string, events: string[], filters: SubscriptionFilters): Record<string, unknown> {
  const body: Record<string, unknown> = { webhook_url: callbackUrl, events };
  if (filters.platform) body.platform = filters.platform;
  if (filters.socialAccountId) body.social_account_id = filters.socialAccountId;
  return body;
}

const ACCOUNT_PLATFORMS = ["facebook", "instagram", "threads", "whatsapp"];

export class PostoraTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Postora Trigger",
    name: "postoraTrigger",
    icon: "fa:bolt",
    group: ["trigger"],
    version: [1, 2, 3],
    defaultVersion: 3,
    description: "Starts a workflow when Postora sends an event",
    defaults: {
      name: "Postora Trigger",
    },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      {
        name: "postoraApi",
        required: true,
      },
    ],
    webhooks: [
      {
        name: "default",
        httpMethod: "POST",
        path: "postora",
      },
    ],
    properties: [
      {
        // First on purpose: n8n builds the triggers side panel from the first property named
        // "Events" without checking @version, so this list is also what the panel shows.
        displayName: "Events",
        name: "events",
        type: "multiOptions",
        options: [
          { name: "Post Completed", value: "post.completed", action: "Post Completed" },
          { name: "New Comment Received", value: "comment.received", action: "New Comment Received", description: "Facebook and Instagram comments, Threads replies and mentions (see comment.kind)" },
          { name: "Threads Reply / Mention Received", value: "comment.threads", action: "Threads Reply / Mention Received" },
          { name: "Threads Mention Created", value: "threads.mention.created", action: "Threads Mention Created", description: "Legacy mention envelope with a data object" },
          { name: "Threads Mention Replied", value: "threads.mention.replied", action: "Threads Mention Replied", description: "Legacy mention envelope with a data object" },
          { name: "New Message Received", value: "message.received", action: "New Message Received" },
          { name: "WhatsApp Message Received", value: "message.whatsapp", action: "WhatsApp Message Received" },
          { name: "Instagram DM Received", value: "message.instagram", action: "Instagram DM Received" },
          { name: "Facebook Message Received", value: "message.facebook", action: "Facebook Message Received" },
        ],
        default: ["comment.received"],
        displayOptions: { show: { "@version": [3] } },
      },
      {
        displayName: "Platform",
        name: "platform",
        type: "options",
        options: [
          { name: "All", value: "" },
          { name: "Facebook", value: "facebook" },
          { name: "Instagram", value: "instagram" },
          { name: "Threads", value: "threads" },
          { name: "WhatsApp", value: "whatsapp" },
        ],
        default: "",
        description: "Only message and comment events from this platform trigger the workflow. Post Completed events are not filtered.",
        displayOptions: { show: { "@version": [3] } },
      },
      {
        displayName: "Account",
        name: "socialAccountId",
        type: "options",
        typeOptions: { loadOptionsMethod: "getAccounts", loadOptionsDependsOn: ["platform"] },
        default: "",
        description: "Only message and comment events on this account trigger the workflow. For comments, the account's Comments automation handler must be set to n8n in Postora (Messaging → Automation), otherwise no comment events are sent.",
        displayOptions: { show: { "@version": [3] } },
      },
      {
        displayName: "Event Category",
        name: "eventCategories",
        type: "multiOptions",
        options: [
          {
            name: "Post Completed",
            value: "post",
            description: "A scheduled or queued Postora post finished publishing",
          },
          {
            name: "Message Received",
            value: "message",
            description: "A direct message reached a connected WhatsApp, Instagram or Facebook account",
          },
          {
            name: "Comment Received",
            value: "comment",
            description: "A comment, reply or mention reached a connected Facebook, Instagram or Threads account",
          },
        ],
        default: [],
        description: "Pick as many categories as the workflow should react to. Each one adds its own platform selector below.",
        displayOptions: { show: { "@version": [2] } },
      },
      {
        displayName: "Message Platforms",
        name: "messageEvents",
        type: "multiOptions",
        options: [
          { name: "All Platforms", value: "message.received" },
          { name: "WhatsApp", value: "message.whatsapp" },
          { name: "Instagram", value: "message.instagram" },
          { name: "Facebook", value: "message.facebook" },
        ],
        default: ["message.received"],
        description: "Threads is absent on purpose: Postora never emits a Threads direct message, only comment-shaped events. Subscribe to those under Comment Received.",
        displayOptions: { show: { "@version": [2], eventCategories: ["message"] } },
      },
      {
        displayName: "Comment Platforms",
        name: "commentEvents",
        type: "multiOptions",
        options: [
          { name: "All Platforms", value: "comment.received" },
          { name: "Facebook", value: "comment.facebook" },
          { name: "Instagram", value: "comment.instagram" },
          { name: "Threads", value: "comment.threads" },
        ],
        default: ["comment.received"],
        description: "WhatsApp is absent on purpose: it has no public comments. Threads covers both replies and mentions — read comment.kind to tell them apart.",
        displayOptions: { show: { "@version": [2], eventCategories: ["comment"] } },
      },
      {
        // The flat list version 1 workflows still read. Version 2 nodes created from the
        // side panel also stored their one event here, which resolveSubscribedEvents honours.
        displayName: "Events",
        name: "events",
        type: "multiOptions",
        options: [
          {
            name: "Post Completed",
            value: "post.completed",
            action: "Post Completed",
          },
          {
            name: "Message Received (All Platforms)",
            value: "message.received",
            action: "Message Received (All Platforms)",
          },
          {
            name: "Message Received (WhatsApp)",
            value: "message.whatsapp",
            action: "Message Received (WhatsApp)",
          },
          {
            name: "Message Received (Facebook)",
            value: "message.facebook",
            action: "Message Received (Facebook)",
          },
          {
            name: "Message Received (Instagram)",
            value: "message.instagram",
            action: "Message Received (Instagram)",
          },
          {
            name: "Comment Received (All Platforms)",
            value: "comment.received",
            action: "Comment Received (All Platforms)",
          },
          {
            name: "Comment Received (Facebook)",
            value: "comment.facebook",
            action: "Comment Received (Facebook)",
          },
          {
            name: "Comment Received (Instagram)",
            value: "comment.instagram",
            action: "Comment Received (Instagram)",
          },
          {
            name: "Comment Received (Threads)",
            value: "comment.threads",
            action: "Comment Received (Threads)",
          },
        ],
        default: [],
        displayOptions: { show: { "@version": [1] } },
      },
    ],
  };

  methods = {
    loadOptions: {
      async getAccounts(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials("postoraApi");
        const baseUrl = credentials.baseUrl as string;
        const platform = (this.getCurrentNodeParameter("platform") as string) || "";
        const url = platform
          ? `${baseUrl}/api/v1/accounts?platform=${encodeURIComponent(platform)}`
          : `${baseUrl}/api/v1/accounts`;
        const response = await this.helpers.httpRequestWithAuthentication.call(
          this as unknown as IAllExecuteFunctions,
          "postoraApi",
          { method: "GET", url, json: true },
        );
        const accounts: Array<{ id: string; platform: string; platform_username?: string | null; name?: string | null }> =
          Array.isArray(response?.accounts) ? response.accounts : [];
        return [
          { name: "All accounts", value: "" },
          ...accounts
            // Only the platforms that emit message or comment events; the filter does nothing
            // for a publishing-only account such as TikTok or YouTube.
            .filter((account) => ACCOUNT_PLATFORMS.includes(account.platform))
            .map((account) => ({
              name: `${account.platform_username || account.name || account.id} (${account.platform})`,
              value: account.id,
            })),
        ];
      },
    },
  };

  webhookMethods = {
    default: {
      // Answered from the server rather than from static data. A cached id alone says
      // nothing about what Postora is actually subscribed to, so editing the Events
      // selection used to leave the original subscription in place forever and the
      // workflow silently received the wrong events.
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const staticData = this.getWorkflowStaticData("node");
        const webhookId = staticData.webhookId as string | undefined;
        if (!webhookId) return false;

        const credentials = await this.getCredentials<{ baseUrl: string }>("postoraApi");
        const events = resolveSubscribedEvents(this);
        const filters = readFilters(this);
        const callbackUrl = this.getNodeWebhookUrl("default");
        // Without a callback URL every registration compares as mismatched, which would retire a
        // perfectly good subscription and then fail in create() for the very same missing URL.
        // Keep what is registered and let create() report the problem if it is ever reached.
        if (!callbackUrl) return true;

        let listing: WebhookListing;
        try {
          listing = await listWebhooks(this, credentials.baseUrl);
        } catch {
          // Postora being unreachable is not evidence the registration is gone, and
          // re-registering on every transient error would pile up duplicates.
          return true;
        }

        const existing = (listing.webhooks || []).find((webhook) => webhook.id === webhookId);
        const matches = Boolean(
          existing &&
          existing.is_active !== false &&
          existing.webhook_url === callbackUrl &&
          sameEventSet(existing.events || [], events) &&
          (existing.platform || "") === filters.platform &&
          (existing.social_account_id || "") === filters.socialAccountId,
        );
        if (matches) return true;

        // Returning false makes n8n call create(), which registers a fresh id. Without
        // retiring the superseded row first, every Events edit would leave another live
        // subscription pointing at this same workflow and duplicate its executions.
        if (existing) {
          try {
            await unregisterWebhook(this, credentials.baseUrl, webhookId);
          } catch (error) {
            // A surviving subscription is not inert: it keeps the same callback URL, and
            // Postora's post-event fan-out does not deduplicate by URL, so any event kept
            // across the edit would run this workflow twice. Refuse to re-register rather
            // than leave two live subscriptions behind.
            if (!isAlreadyGone(error)) {
              throw new Error(
                `Postora could not retire the previous webhook subscription (${webhookId}), so re-registering would deliver some events twice. Resolve the Postora API error and activate again.`,
              );
            }
          }
        }
        delete staticData.webhookId;
        return false;
      },
      async create(this: IHookFunctions): Promise<boolean> {
        const credentials = await this.getCredentials<{ baseUrl: string }>("postoraApi");
        const events = resolveSubscribedEvents(this);
        const callbackUrl = this.getNodeWebhookUrl("default");
        if (!callbackUrl) {
          throw new Error("Postora webhook registration requires an n8n callback URL.");
        }
        const registration = await this.helpers.httpRequestWithAuthentication.call(
          this as unknown as IAllExecuteFunctions,
          "postoraApi",
          {
            method: "POST",
            url: `${credentials.baseUrl}/api/v1/webhooks`,
            body: registrationBody(callbackUrl, events, readFilters(this)),
          },
        ) as WebhookRegistration;

        this.getWorkflowStaticData("node").webhookId = registration.webhook.id;
        return true;
      },
      async delete(this: IHookFunctions): Promise<boolean> {
        const staticData = this.getWorkflowStaticData("node");
        const webhookId = staticData.webhookId as string | undefined;
        if (!webhookId) return true;

        const credentials = await this.getCredentials<{ baseUrl: string }>("postoraApi");
        try {
          await unregisterWebhook(this, credentials.baseUrl, webhookId);
        } catch (error) {
          // Already gone on Postora's side is the outcome deactivation wanted.
          if (!isAlreadyGone(error)) throw error;
        }
        delete staticData.webhookId;
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    return {
      workflowData: [[{ json: this.getBodyData() }]],
      webhookResponse: { status: 200 },
    };
  }
}
