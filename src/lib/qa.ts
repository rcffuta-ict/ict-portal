/**
 * Event Q&A — questions asked at an event, and the answers given.
 *
 * Reproduced from @rcffuta/ict-lib's `QAService` when that dependency was removed.
 * Only the five methods the portal actually called are here; the package carried
 * fifteen, the rest for flagging and clustering features that were never wired up.
 *
 * TWO DATABASE OBJECTS THIS DEPENDS ON, neither created by a migration in this repo:
 *   * the `event_questions_with_details` VIEW
 *   * the `search_questions` and `toggle_question_visibility` FUNCTIONS
 * They exist in the live database. If a fresh project ever needs rebuilding from
 * `db/migrations/` alone, these must be recreated — noted here because the dependency
 * was previously invisible, buried inside a package.
 *
 * Server-only: uses the service-role client and performs no authorization.
 */
import { db } from "@/lib/db";

export interface QuestionListParams {
    status?: string | string[];
    cluster_id?: string;
    is_answered?: boolean;
    search_term?: string;
    created_after?: string;
    created_before?: string;
    limit?: number;
    offset?: number;
}

export interface CreateQuestionInput {
    event_id: string;
    question_text: string;
    scripture_reference?: string | null;
    asked_by_profile_id?: string | null;
    asker_name?: string | null;
}

type Row = Record<string, unknown>;

/**
 * Query results are generic over the row shape.
 *
 * These come back from a view and two RPCs, so there is no schema TypeScript can derive
 * them from. Rather than assert one shape here and have every caller fight it, each
 * caller names the shape IT expects — `qa.getEventQuestions<Question>(id)` — and the
 * assertion sits where the knowledge is.
 */
interface ListResult<T = Row> {
    data: T[];
    count: number;
    error?: string;
}

interface SingleResult<T = Row> {
    data: T | null;
    error?: string;
}

const message = (e: unknown) => (e instanceof Error ? e.message : "Unknown error");

/**
 * Flatten the embedded author and event onto the question.
 *
 * `author_full_name` falls back to `asker_name` — questions may be asked by someone with
 * no portal profile, which is the normal case at a public event.
 */
function transform(raw: Row): Row {
    const profiles = raw.profiles as { first_name?: string; last_name?: string } | null;
    const events = raw.events as { title?: string; slug?: string } | null;
    return {
        ...raw,
        author_full_name: profiles
            ? `${profiles.first_name} ${profiles.last_name}`
            : raw.asker_name,
        event_title: events?.title ?? "",
        event_slug: events?.slug ?? "",
        active_flags_count: 0,
    };
}

const EMBED = `
    *,
    profiles:asked_by_profile_id(first_name, last_name),
    events(title, slug)
`;

/** Questions for one event, newest first, pinned ones on top. */
export async function getEventQuestions<T = Row>(
    eventId: string,
    params?: QuestionListParams,
): Promise<ListResult<T>> {
    try {
        let query = db
            .from("event_questions_with_details")
            .select("*")
            .eq("event_id", eventId);

        if (params?.status) {
            query = Array.isArray(params.status)
                ? query.in("status", params.status)
                : query.eq("status", params.status);
        }
        if (params?.cluster_id) query = query.eq("cluster_id", params.cluster_id);
        if (params?.is_answered !== undefined) {
            query = params.is_answered
                ? query.not("answer_text", "is", null)
                : query.is("answer_text", null);
        }
        if (params?.search_term) {
            // `or()` is delimiter-parsed by PostgREST, so a search term containing a
            // comma, parenthesis or backslash would be read as filter syntax. Strip
            // those rather than hand the user's input to the parser.
            const safe = params.search_term.replace(/[,()\\]/g, " ");
            query = query.or(
                `question_text.ilike.%${safe}%,scripture_reference.ilike.%${safe}%`,
            );
        }
        if (params?.created_after) query = query.gte("created_at", params.created_after);
        if (params?.created_before) query = query.lte("created_at", params.created_before);

        query = query
            .order("is_pinned", { ascending: false })
            .order("created_at", { ascending: false });

        if (params?.limit) query = query.limit(params.limit);
        if (params?.offset) {
            query = query.range(params.offset, params.offset + (params.limit || 10) - 1);
        }

        const { data, error, count } = await query;
        if (error) return { data: [], count: 0, error: error.message };
        return { data: (data ?? []) as T[], count: count ?? 0 };
    } catch (e) {
        return { data: [], count: 0, error: message(e) };
    }
}

/** Full-text search, via the `search_questions` database function. */
export async function searchQuestions<T = Row>(params: {
    search_term: string;
    event_id_filter?: string;
}): Promise<ListResult<T>> {
    try {
        const { data, error } = await db.rpc("search_questions", {
            search_term: params.search_term,
            event_id_filter: params.event_id_filter,
        });
        if (error) return { data: [], count: 0, error: error.message };
        return { data: (data ?? []) as T[], count: data?.length ?? 0 };
    } catch (e) {
        return { data: [], count: 0, error: message(e) };
    }
}

export async function createQuestion<T = Row>(input: CreateQuestionInput): Promise<SingleResult<T>> {
    try {
        const { data, error } = await db
            .from("event_questions")
            .insert(input)
            .select(EMBED)
            .single();
        if (error) return { data: null, error: error.message };
        return { data: transform(data) as T };
    } catch (e) {
        return { data: null, error: message(e) };
    }
}

export async function answerQuestion<T = Row>(
    questionId: string,
    answerText: string,
    answeredBy: string,
): Promise<SingleResult<T>> {
    try {
        const { data, error } = await db
            .from("event_questions")
            .update({
                answer_text: answerText,
                answered_by_profile_id: answeredBy,
                answered_at: new Date().toISOString(),
                status: "answered",
            })
            .eq("id", questionId)
            .select(EMBED)
            .single();
        if (error) return { data: null, error: error.message };
        return { data: transform(data) as T };
    } catch (e) {
        return { data: null, error: message(e) };
    }
}

/** Show or hide a question, via the `toggle_question_visibility` function. */
export async function toggleQuestionVisibility(params: {
    question_id: string;
    new_status: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const { data, error } = await db.rpc("toggle_question_visibility", {
            question_id: params.question_id,
            new_status: params.new_status,
        });
        if (error) return { success: false, error: error.message };
        return { success: data ?? false };
    } catch (e) {
        return { success: false, error: message(e) };
    }
}
