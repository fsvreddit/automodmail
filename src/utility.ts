import { TriggerContext } from "@devvit/public-api";

export enum ThingPrefix {
    Comment = "t1_",
    Account = "t2_",
    Post = "t3_",
    Message = "t4_",
    Subreddit = "t5_",
    Award = "t6_",
}

export async function isContributor (context: TriggerContext, subredditName: string, username: string): Promise<boolean> {
    const filteredContributorList = await context.reddit.getApprovedUsers({ subredditName, username }).all();
    return filteredContributorList.length > 0;
}

export async function isModerator (context: TriggerContext, subredditName: string, username: string): Promise<boolean> {
    const filteredContributorList = await context.reddit.getModerators({ subredditName, username }).all();
    return filteredContributorList.length > 0;
}

export async function isBanned (context: TriggerContext, subredditName: string, username: string): Promise<boolean> {
    const bannedList = await context.reddit.getBannedUsers({ subredditName, username }).all();
    return bannedList.length > 0;
}

export function replaceAll (input: string, pattern: string, replacement: string): string {
    return input.split(pattern).join(replacement);
}
