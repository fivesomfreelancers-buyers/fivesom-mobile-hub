import { supabase } from "@/integrations/supabase/client";
import type { PublicProfile } from "@/lib/fivesom";

/**
 * FIVESOM messaging helpers.
 *
 * IMPORTANT data-model note: `conversations.freelancer_id` stores the
 * freelancer's **auth user id** (exactly like the website), not the
 * `freelancers.id` row id. Everything here works in user ids so the app and
 * the website share the same threads.
 */

export type Conversation = {
  id: string;
  buyer_id: string;
  freelancer_id: string;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string | null;
  message: string | null;
  attachment_url: string | null;
  is_read: boolean | null;
  created_at: string;
};

/** Official FIVESOM channels that live in `system_conversations`. */
export type SystemChannelType = "support" | "news";

export type SystemConversation = {
  id: string;
  user_id: string;
  type: SystemChannelType;
  last_message: string | null;
  last_message_at: string | null;
  unread_user: number | null;
  status: string | null;
  created_at: string;
};

export type SystemMessage = {
  id: string;
  conversation_id: string;
  sender_type: "system" | "admin" | "user";
  body: string | null;
  attachment_url: string | null;
  is_read_user: boolean | null;
  created_at: string;
};

const PROFILE_COLUMNS =
  "id, full_name, username, profile_image_url, professional_title, bio, location, role, last_seen";

/**
 * Opens the existing buyer↔freelancer thread or creates it, then returns its
 * id. Used by every "Message seller" entry point.
 */
export async function openOrCreateConversation(
  buyerUserId: string,
  freelancerUserId: string,
): Promise<string> {
  const { data: existing, error: findError } = await supabase
    .from("conversations")
    .select("id")
    .eq("buyer_id", buyerUserId)
    .eq("freelancer_id", freelancerUserId)
    .maybeSingle();
  if (findError) throw findError;
  if (existing?.id) return existing.id as string;

  const { data, error } = await supabase
    .from("conversations")
    .insert({ buyer_id: buyerUserId, freelancer_id: freelancerUserId })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Could not start this conversation.");
  return data.id as string;
}

/** Resolves the freelancer's auth user id from a `freelancers.id` row id. */
export async function freelancerUserId(freelancerRowId: string): Promise<string | null> {
  const { data } = await supabase
    .from("public_freelancers")
    .select("user_id")
    .eq("id", freelancerRowId)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

export async function fetchProfiles(userIds: string[]): Promise<Map<string, PublicProfile>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const { data } = await supabase.from("public_profiles").select(PROFILE_COLUMNS).in("id", ids);
  return new Map(((data ?? []) as PublicProfile[]).map((p) => [p.id, p]));
}

export type ConversationListItem = {
  kind: "user" | "system";
  id: string;
  channel?: SystemChannelType;
  counterpart?: PublicProfile | undefined;
  lastMessage: string | null;
  lastAt: string | null;
  unread: number;
};

/**
 * The full Messages inbox: real buyer↔freelancer threads plus the official
 * FIVESOM Support and FIVESOM News channels from the website.
 */
export const inboxQuery = (userId: string | undefined) => ({
  queryKey: ["inbox", userId],
  enabled: Boolean(userId),
  refetchInterval: 15000,
  queryFn: async (): Promise<ConversationListItem[]> => {
    const uid = userId!;

    const [{ data: convos }, { data: systemConvos }] = await Promise.all([
      supabase
        .from("conversations")
        .select("id, buyer_id, freelancer_id, created_at")
        .or(`buyer_id.eq.${uid},freelancer_id.eq.${uid}`)
        .order("created_at", { ascending: false }),
      supabase
        .from("system_conversations")
        .select("id, user_id, type, last_message, last_message_at, unread_user, status, created_at")
        .eq("user_id", uid),
    ]);

    const rows = (convos ?? []) as Conversation[];
    let items: ConversationListItem[] = [];

    if (rows.length) {
      const [{ data: msgs }, profiles] = await Promise.all([
        supabase
          .from("messages")
          .select("conversation_id, message, attachment_url, created_at, is_read, receiver_id")
          .in(
            "conversation_id",
            rows.map((c) => c.id),
          )
          .order("created_at", { ascending: false }),
        fetchProfiles(rows.map((c) => (c.buyer_id === uid ? c.freelancer_id : c.buyer_id))),
      ]);

      items = rows
        .map((c) => {
          const otherId = c.buyer_id === uid ? c.freelancer_id : c.buyer_id;
          const mine = (msgs ?? []).filter((m) => m.conversation_id === c.id);
          const last = mine[0];
          return {
            kind: "user" as const,
            id: c.id,
            counterpart: profiles.get(otherId),
            lastMessage: last
              ? ((last.message as string | null) ?? (last.attachment_url ? "📎 Attachment" : null))
              : null,
            lastAt: (last?.created_at as string | undefined) ?? c.created_at,
            unread: mine.filter((m) => m.receiver_id === uid && !m.is_read).length,
            hasMessages: mine.length > 0,
          };
        })
        // Only real conversations: an empty thread (created by tapping
        // "Contact freelancer") stays hidden until someone actually writes.
        .filter((c) => c.hasMessages)
        .map(({ hasMessages: _ignored, ...c }) => c);

    }

    const systemItems: ConversationListItem[] = ((systemConvos ?? []) as SystemConversation[]).map(
      (s) => ({
        kind: "system" as const,
        id: s.id,
        channel: s.type,
        lastMessage: s.last_message,
        lastAt: s.last_message_at ?? s.created_at,
        unread: Number(s.unread_user ?? 0),
      }),
    );

    // Official FIVESOM channels stay pinned at the top, then newest first.
    return [
      ...systemItems.sort((a, b) => (a.channel === "support" ? -1 : 1) - (b.channel === "support" ? -1 : 1)),
      ...items.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "")),
    ];
  },
});

export const systemChannelQuery = (channelId: string) => ({
  queryKey: ["system-channel", channelId],
  refetchInterval: 15000,
  queryFn: async (): Promise<{ conversation: SystemConversation | null; messages: SystemMessage[] }> => {
    const [{ data: conversation }, { data: messages }] = await Promise.all([
      supabase
        .from("system_conversations")
        .select("id, user_id, type, last_message, last_message_at, unread_user, status, created_at")
        .eq("id", channelId)
        .maybeSingle(),
      supabase
        .from("system_messages")
        .select("id, conversation_id, sender_type, body, attachment_url, is_read_user, created_at")
        .eq("conversation_id", channelId)
        .order("created_at", { ascending: true }),
    ]);
    return {
      conversation: (conversation as SystemConversation) ?? null,
      messages: (messages ?? []) as SystemMessage[],
    };
  },
});

/** Uploads a chat attachment to the shared `message-attachments` bucket. */
export async function uploadAttachment(userId: string, file: File): Promise<string> {
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${userId}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from("message-attachments").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = await supabase.storage.from("message-attachments").createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? path;
}

export function isImageUrl(url: string | null | undefined) {
  if (!url) return false;
  return /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(url);
}

export function fileNameFromUrl(url: string) {
  try {
    const path = new URL(url).pathname;
    return decodeURIComponent(path.split("/").pop() ?? "attachment");
  } catch {
    return url.split("/").pop() ?? "attachment";
  }
}

/**
 * Finds (or creates) this user's official FIVESOM channel of the given type.
 * Returns null when the backend does not allow the app to create it, so the
 * screen can fall back to a read-only view instead of erroring.
 */
export async function openSystemChannel(
  userId: string,
  type: SystemChannelType,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("system_conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data } = await supabase
    .from("system_conversations")
    .insert({ user_id: userId, type })
    .select("id")
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export const systemChannelIdQuery = (userId: string | undefined, type: SystemChannelType) => ({
  queryKey: ["system-channel-id", userId, type],
  enabled: Boolean(userId),
  queryFn: () => openSystemChannel(userId!, type),
});
