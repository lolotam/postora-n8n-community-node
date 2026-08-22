import { PostoraTrigger } from "../nodes/PostoraTrigger/PostoraTrigger.node";

type WebhookRequest = {
  method: string;
  url: string;
  body?: unknown;
};

type RegisteredWebhook = { id?: string; webhook_url?: string; events?: string[]; is_active?: boolean };

const CALLBACK_URL = "https://n8n.example.test/webhook/postora";

function createHookContext(overrides: {
  staticData?: Record<string, unknown>;
  webhookResponse?: unknown;
  callbackUrl?: string | undefined;
  events?: string[];
  typeVersion?: number;
  eventCategories?: string[];
  messageEvents?: string[];
  commentEvents?: string[];
  listing?: RegisteredWebhook[];
  listingError?: Error;
  deleteError?: Error;
}) {
  const requests: WebhookRequest[] = [];
  const staticData = overrides.staticData ?? {};

  return {
    context: {
      getCredentials: async () => ({ baseUrl: "https://api.example.test" }),
      getNode: () => ({ typeVersion: overrides.typeVersion ?? 1 }),
      // Mirrors n8n: a parameter the node never stored is answered with the caller's
      // fallback, and asking for one without a fallback is an error.
      getNodeParameter: (name: string, fallbackValue?: unknown) => {
        const stored: Record<string, unknown> = {
          eventCategories: overrides.eventCategories,
          messageEvents: overrides.messageEvents,
          commentEvents: overrides.commentEvents,
          events: overrides.events ?? (overrides.typeVersion === 2 ? undefined : ["post.completed"]),
        };
        const value = stored[name] ?? fallbackValue;
        if (value === undefined) throw new Error(`Could not get parameter "${name}"`);
        return value;
      },
      getNodeWebhookUrl: () => (
        "callbackUrl" in overrides ? overrides.callbackUrl : CALLBACK_URL
      ),
      getWorkflowStaticData: () => staticData,
      helpers: {
        httpRequestWithAuthentication: function (_credentialName: string, request: WebhookRequest) {
          requests.push(request);
          if (request.method === "GET") {
            if (overrides.listingError) return Promise.reject(overrides.listingError);
            return Promise.resolve({ webhooks: overrides.listing ?? [] });
          }
          if (request.method === "DELETE" && overrides.deleteError) {
            return Promise.reject(overrides.deleteError);
          }
          return Promise.resolve(overrides.webhookResponse ?? { webhook: { id: "subscription-123" } });
        },
      },
    },
    requests,
    staticData,
  };
}

describe("Postora Trigger", () => {
  it("lists exactly the nine triggers the n8n side panel should offer, in order", () => {
    // n8n builds that panel from the first property named "Events" and shows one entry per
    // option, so this list is the panel. The legacy threads.mention.* pair lives on the
    // Postora Comment Trigger only; duplicating it here is what made the panel read as if
    // the same trigger were listed twice.
    const trigger = new PostoraTrigger();
    const events = (trigger.description.properties?.find((property) => property.name === "events") as any).options;

    expect(events.map((event: { value: string; action: string }) => [event.value, event.action])).toEqual([
      ["post.completed", "Post Completed"],
      ["message.received", "Message Received (All Platforms)"],
      ["message.whatsapp", "Message Received (WhatsApp)"],
      ["message.facebook", "Message Received (Facebook)"],
      ["message.instagram", "Message Received (Instagram)"],
      ["comment.received", "Comment Received (All Platforms)"],
      ["comment.facebook", "Comment Received (Facebook)"],
      ["comment.instagram", "Comment Received (Instagram)"],
      ["comment.threads", "Comment Received (Threads)"],
    ]);
  });

  it("treats an unregistered node as having no subscription without calling Postora", async () => {
    const { context, requests } = createHookContext({});
    const trigger = new PostoraTrigger();

    await expect(trigger.webhookMethods?.default?.checkExists.call(context as any)).resolves.toBe(false);
    expect(requests).toEqual([]);
  });

  it("keeps a subscription whose URL and events still match the node", async () => {
    const { context, staticData } = createHookContext({
      staticData: { webhookId: "subscription-123" },
      events: ["message.received", "message.instagram"],
      // Order differs from the node's selection on purpose: the subscription is the same.
      listing: [{
        id: "subscription-123",
        webhook_url: CALLBACK_URL,
        events: ["message.instagram", "message.received"],
        is_active: true,
      }],
    });
    const trigger = new PostoraTrigger();

    await expect(trigger.webhookMethods?.default?.checkExists.call(context as any)).resolves.toBe(true);
    expect(staticData.webhookId).toBe("subscription-123");
  });

  it("retires and re-registers a subscription whose events no longer match the node", async () => {
    const { context, requests, staticData } = createHookContext({
      staticData: { webhookId: "subscription-123" },
      events: ["message.received", "message.instagram"],
      listing: [{
        id: "subscription-123",
        webhook_url: CALLBACK_URL,
        events: ["message.whatsapp"],
        is_active: true,
      }],
    });
    const trigger = new PostoraTrigger();

    await expect(trigger.webhookMethods?.default?.checkExists.call(context as any)).resolves.toBe(false);
    expect(requests).toEqual([
      { method: "GET", url: "https://api.example.test/api/v1/webhooks" },
      { method: "DELETE", url: "https://api.example.test/api/v1/webhooks/subscription-123" },
    ]);
    expect(staticData.webhookId).toBeUndefined();
  });

  it("refuses to re-register when the superseded subscription could not be retired", async () => {
    // Two live subscriptions share this workflow's callback URL, and the post-event fan-out
    // does not deduplicate by URL, so any event kept across the edit would fire twice.
    const { context, staticData } = createHookContext({
      staticData: { webhookId: "subscription-123" },
      events: ["post.completed", "message.instagram"],
      listing: [{
        id: "subscription-123",
        webhook_url: CALLBACK_URL,
        events: ["post.completed"],
        is_active: true,
      }],
      deleteError: Object.assign(new Error("500 Server Error"), { statusCode: 500 }),
    });
    const trigger = new PostoraTrigger();

    await expect(trigger.webhookMethods?.default?.checkExists.call(context as any)).rejects.toThrow(
      /deliver some events twice/i,
    );
    expect(staticData.webhookId).toBe("subscription-123");
  });

  it("treats an already-deleted subscription as retired and re-registers", async () => {
    const { context, staticData } = createHookContext({
      staticData: { webhookId: "subscription-123" },
      events: ["message.instagram"],
      listing: [{
        id: "subscription-123",
        webhook_url: CALLBACK_URL,
        events: ["message.whatsapp"],
        is_active: true,
      }],
      deleteError: Object.assign(new Error("404 Not Found"), { statusCode: 404 }),
    });
    const trigger = new PostoraTrigger();

    await expect(trigger.webhookMethods?.default?.checkExists.call(context as any)).resolves.toBe(false);
    expect(staticData.webhookId).toBeUndefined();
  });

  it("re-registers when the subscription is gone from Postora, without a delete call", async () => {
    const { context, requests, staticData } = createHookContext({
      staticData: { webhookId: "subscription-123" },
      listing: [],
    });
    const trigger = new PostoraTrigger();

    await expect(trigger.webhookMethods?.default?.checkExists.call(context as any)).resolves.toBe(false);
    expect(requests.map((request) => request.method)).toEqual(["GET"]);
    expect(staticData.webhookId).toBeUndefined();
  });

  it.each([
    ["points at a different callback URL", { webhook_url: "https://n8n.example.test/webhook/stale" }],
    ["was deactivated by Postora after repeated delivery failures", { is_active: false }],
  ])("re-registers a subscription that %s", async (_reason, divergence) => {
    const { context } = createHookContext({
      staticData: { webhookId: "subscription-123" },
      listing: [{
        id: "subscription-123",
        webhook_url: CALLBACK_URL,
        events: ["post.completed"],
        is_active: true,
        ...divergence,
      }],
    });
    const trigger = new PostoraTrigger();

    await expect(trigger.webhookMethods?.default?.checkExists.call(context as any)).resolves.toBe(false);
  });

  it("keeps the saved subscription when n8n cannot supply a callback URL", async () => {
    // Every registration would compare as mismatched against an undefined URL, so retiring one
    // here would destroy a working subscription over a condition create() cannot recover from.
    const { context, requests, staticData } = createHookContext({
      staticData: { webhookId: "subscription-123" },
      callbackUrl: undefined,
    });
    const trigger = new PostoraTrigger();

    await expect(trigger.webhookMethods?.default?.checkExists.call(context as any)).resolves.toBe(true);
    expect(requests).toEqual([]);
    expect(staticData.webhookId).toBe("subscription-123");
  });

  it("keeps the saved subscription when Postora is unreachable", async () => {
    const { context, staticData } = createHookContext({
      staticData: { webhookId: "subscription-123" },
      listingError: new Error("ECONNREFUSED"),
    });
    const trigger = new PostoraTrigger();

    await expect(trigger.webhookMethods?.default?.checkExists.call(context as any)).resolves.toBe(true);
    expect(staticData.webhookId).toBe("subscription-123");
  });

  it("registers the n8n callback URL and selected events using the Postora API contract", async () => {
    const { context, requests, staticData } = createHookContext({});
    const trigger = new PostoraTrigger();

    await expect(trigger.webhookMethods?.default?.create.call(context as any)).resolves.toBe(true);

    expect(requests).toEqual([
      {
        method: "POST",
        url: "https://api.example.test/api/v1/webhooks",
        body: {
          webhook_url: "https://n8n.example.test/webhook/postora",
          events: ["post.completed"],
        },
      },
    ]);
    expect(staticData.webhookId).toBe("subscription-123");
  });

  it("rejects registration when n8n does not provide a callback URL", async () => {
    const { context, requests } = createHookContext({ callbackUrl: undefined });
    const trigger = new PostoraTrigger();

    await expect(trigger.webhookMethods?.default?.create.call(context as any)).rejects.toThrow(
      /callback URL/i,
    );

    expect(requests).toEqual([]);
  });

  it("deletes the saved subscription and clears its static state", async () => {
    const { context, requests, staticData } = createHookContext({
      staticData: { webhookId: "subscription-123" },
    });
    const trigger = new PostoraTrigger();

    await expect(trigger.webhookMethods?.default?.delete.call(context as any)).resolves.toBe(true);

    expect(requests).toEqual([
      {
        method: "DELETE",
        url: "https://api.example.test/api/v1/webhooks/subscription-123",
      },
    ]);
    expect(staticData.webhookId).toBeUndefined();
  });

  it("returns an incoming request body as workflow data with an HTTP 200 response", async () => {
    const trigger = new PostoraTrigger();
    const body = { event: "post.completed", post: { id: "post-1" } };

    const response = await trigger.webhook?.call({ getBodyData: () => body } as any);

    expect(response).toEqual({
      workflowData: [[{ json: body }]],
      webhookResponse: { status: 200 },
    });
  });
});

describe("Postora Trigger — version 2 Event Category", () => {
  function optionValues(name: string): string[] {
    const trigger = new PostoraTrigger();
    const property = trigger.description.properties?.find((candidate) => candidate.name === name) as any;
    return property.options.map((option: { value: string }) => option.value);
  }

  it("defaults new nodes to version 2 while still loading version 1 workflows", () => {
    const trigger = new PostoraTrigger();

    expect(trigger.description.version).toEqual([1, 2]);
    expect(trigger.description.defaultVersion).toBe(2);
  });

  it("never offers Threads as a message platform or WhatsApp as a comment platform", () => {
    // Postora emits Threads activity only as a comment envelope and WhatsApp has no public
    // comments, so these pairings produce a subscription that can never fire.
    expect(optionValues("messageEvents")).toEqual([
      "message.received",
      "message.whatsapp",
      "message.instagram",
      "message.facebook",
    ]);
    expect(optionValues("commentEvents")).toEqual([
      "comment.received",
      "comment.facebook",
      "comment.instagram",
      "comment.threads",
    ]);
  });

  it.each([
    ["post only", ["post"], ["post.completed"]],
    ["message only", ["message"], ["message.whatsapp", "message.facebook"]],
    ["comment only", ["comment"], ["comment.threads"]],
    [
      "several categories at once",
      ["post", "message", "comment"],
      ["post.completed", "message.whatsapp", "message.facebook", "comment.threads"],
    ],
  ])("registers the events belonging to the selected categories — %s", async (_label, eventCategories, expected) => {
    const { context, requests } = createHookContext({
      typeVersion: 2,
      eventCategories: eventCategories as string[],
      messageEvents: ["message.whatsapp", "message.facebook"],
      commentEvents: ["comment.threads"],
    });
    const trigger = new PostoraTrigger();

    await trigger.webhookMethods?.default?.create.call(context as any);

    expect((requests[0].body as { events: string[] }).events).toEqual(expected);
  });

  it("registers the single event a triggers-panel click wrote into the hidden events field", async () => {
    const { context, requests } = createHookContext({
      typeVersion: 2,
      eventCategories: [],
      events: ["message.instagram"],
    });
    const trigger = new PostoraTrigger();

    await trigger.webhookMethods?.default?.create.call(context as any);

    expect((requests[0].body as { events: string[] }).events).toEqual(["message.instagram"]);
  });

  it("lets a chosen category replace what the triggers panel wrote rather than adding to it", async () => {
    const { context, requests } = createHookContext({
      typeVersion: 2,
      eventCategories: ["comment"],
      commentEvents: ["comment.threads"],
      events: ["message.instagram"],
    });
    const trigger = new PostoraTrigger();

    await trigger.webhookMethods?.default?.create.call(context as any);

    expect((requests[0].body as { events: string[] }).events).toEqual(["comment.threads"]);
  });

  it("refuses to register a subscription that would receive nothing", async () => {
    const { context, requests } = createHookContext({ typeVersion: 2, eventCategories: [], events: [] });
    const trigger = new PostoraTrigger();

    await expect(trigger.webhookMethods?.default?.create.call(context as any)).rejects.toThrow(
      /at least one Event Category/,
    );
    expect(requests).toEqual([]);
  });

  it("keeps reading the flat events list for a workflow still on version 1", async () => {
    const { context, requests } = createHookContext({
      typeVersion: 1,
      events: ["threads.mention.created"],
      eventCategories: ["post"],
    });
    const trigger = new PostoraTrigger();

    await trigger.webhookMethods?.default?.create.call(context as any);

    expect((requests[0].body as { events: string[] }).events).toEqual(["threads.mention.created"]);
  });
});
