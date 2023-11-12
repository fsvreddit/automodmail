import {TriggerContext} from "@devvit/public-api";

export async function isModerator (context: TriggerContext, subredditName: string, username: string): Promise<boolean> {
    const filteredModeratorList = await context.reddit.getModerators({subredditName, username}).all();
    return filteredModeratorList.length > 0;
}

export async function isContributor (context: TriggerContext, subredditName: string, username: string): Promise<boolean> {
    const filteredContributorList = await context.reddit.getApprovedUsers({subredditName, username}).all();
    return filteredContributorList.length > 0;
}

export async function isBanned (context: TriggerContext, subredditName: string, username: string): Promise<boolean> {
    const bannedList = await context.reddit.getBannedUsers({subredditName, username}).all();
    return bannedList.length > 0;
}

export function stringOrStringArrayToStringArray (input: string | string[] | undefined): string[] | undefined {
    let result: string[] | undefined;

    if (!input) {
        return;
    }

    if (typeof input === "string") {
        result = [input];
    } else {
        result = input;
    }

    if (result.length === 0) {
        return;
    }

    return result;
}
