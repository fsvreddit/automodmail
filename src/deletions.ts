import { CommentDelete, PostDelete } from "@devvit/protos";
import { TriggerContext } from "@devvit/public-api";
import { isLinkId } from "@devvit/public-api/types/tid.js";
import { addWeeks } from "date-fns";

async function storeRecordOfDeletion (event: CommentDelete | PostDelete, thingId: string, context: TriggerContext) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (event.source !== 1) {
        // Not a user deletion
        return;
    }

    await context.redis.set(`deleted:${thingId}`, Date.now().toString(), { expiration: addWeeks(new Date(), 1) });
    console.log(`Recorded deletion of ${isLinkId(thingId) ? "post" : "comment"} ${thingId}`);
}

export async function handleDeletedComment (event: CommentDelete, context: TriggerContext) {
    await storeRecordOfDeletion(event, event.commentId, context);
}

export async function handleDeletedPost (event: PostDelete, context: TriggerContext) {
    await storeRecordOfDeletion(event, event.postId, context);
}

export async function wasThingDeleted (thingId: string, context: TriggerContext): Promise<boolean> {
    const wasDeleted = await context.redis.exists(`deleted:${thingId}`);
    return wasDeleted === 1;
}
