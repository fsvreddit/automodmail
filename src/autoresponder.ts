import {OnTriggerEvent, Subreddit, TriggerContext, User} from "@devvit/public-api";
import {ModMail} from "@devvit/protos";
import {ResponseRule, getRules} from "./config.js";
import {Duration, add} from "date-fns";
import {isBanned, isContributor, isModerator, stringOrStringArrayToStringArray} from "./utility.js";

export async function onModmailReceiveEvent (event: OnTriggerEvent<ModMail>, context: TriggerContext) {
    console.log("Received modmail trigger event.");

    if (!event.messageAuthor) {
        return;
    }

    if (event.messageAuthor && event.messageAuthor.id === context.appAccountId) {
        console.log("Modmail event triggered by this app. Quitting.");
        return;
    }

    const conversationResponse = await context.reddit.modMail.getConversation({
        conversationId: event.conversationId,
    });

    if (!conversationResponse.conversation) {
        return;
    }

    // Ensure that the modmail has a participant i.e. is about a user, and not a sub to sub modmail or internal discussion
    if (!conversationResponse.conversation.participant || !conversationResponse.conversation.participant.name) {
        console.log("There is no participant for the modmail conversation e.g. internal mod discussion");
        return;
    }

    if (conversationResponse.conversation.participant.name !== event.messageAuthor.name) {
        console.log("Conversation author is not the same as participant - outgoing modmail");
        return;
    }

    const messagesInConversation = Object.values(conversationResponse.conversation.messages);

    // Check that there's no other messages from the author!
    if (messagesInConversation.filter(msg => msg.author && msg.author.isOp).length > 1) {
        console.log("Not the first message from this user in the chain. Quitting");
    }

    let participant: User | undefined;
    try {
        // Doing this in a try/catch because otherwise the user might be shadowbanned.
        participant = await context.reddit.getUserByUsername(conversationResponse.conversation.participant.name);
    } catch {
        // Ignore - leave participant variable undefined.
    }

    const firstMessage = messagesInConversation[0];

    const subject = conversationResponse.conversation.subject ?? "";
    const body = firstMessage.bodyMarkdown ?? "";
    const subreddit = await context.reddit.getCurrentSubreddit();

    const rulesYaml = await context.settings.get<string>("rules");
    const rules = getRules(rulesYaml);

    let matchedRules = await Promise.all(rules.map(rule => checkRule(context, subreddit, rule, subject, body, participant)));

    // Sort by priority descending, take top 1.
    matchedRules = matchedRules.filter(x => x !== undefined).sort((a, b) => (b?.priority ?? 0) - (a?.priority ?? 0));

    if (matchedRules.length === 0) {
        console.log("No rules matched.");
        return;
    }

    const firstMatchedRule = matchedRules[0] as ResponseRule;

    if (firstMatchedRule.reply) {
        let replyMessage = firstMatchedRule.reply;

        const signoff = await context.settings.get<string>("signoff");
        if (signoff) {
            replyMessage += `\n\n${signoff}`;
        }

        await context.reddit.modMail.reply({
            body: replyMessage,
            conversationId: event.conversationId,
            isInternal: false,
            isAuthorHidden: true,
        });
    }

    if (firstMatchedRule.mute) {
        await context.reddit.modMail.muteConversation({
            conversationId: event.conversationId,
            numHours: firstMatchedRule.mute * 24,
        });
    }

    if (firstMatchedRule.archive) {
        await context.reddit.modMail.archiveConversation(event.conversationId);
    }
}

async function checkRule (context: TriggerContext, subreddit: Subreddit, rule: ResponseRule, subject: string, body: string, participant: User | undefined): Promise<ResponseRule | undefined> {
    if (rule.subject) {
        const valuesToCheck = stringOrStringArrayToStringArray(rule.subject);
        if (valuesToCheck && !valuesToCheck.some(val => subject.includes(val))) {
            console.log("Subject does not match.");
            return;
        }
    }

    if (rule.subject_regex) {
        const valuesToCheck = stringOrStringArrayToStringArray(rule.subject_regex);
        if (valuesToCheck) {
            const regexes = valuesToCheck.map(x => new RegExp(x));
            if (!regexes.some(x => x.test(subject))) {
                console.log("Subject regex does not match");
                return;
            }
        }
    }

    if (rule.body) {
        const valuesToCheck = stringOrStringArrayToStringArray(rule.body);
        if (valuesToCheck && !valuesToCheck.some(val => body.includes(val))) {
            console.log("Body does not match.");
            return;
        }
    }

    if (rule.body_regex) {
        const valuesToCheck = stringOrStringArrayToStringArray(rule.body_regex);
        if (valuesToCheck) {
            const regexes = valuesToCheck.map(x => new RegExp(x));
            if (!regexes.some(x => x.test(body))) {
                console.log("Body regex does not match");
                return;
            }
        }
    }

    if (rule.author) {
        if (participant) {
            // Most checks need the user to be not shadowbanned.
            const thresholdChecks: boolean[] = [];
            if (rule.author.post_karma) {
                thresholdChecks.push(meetsNumericThreshold(participant.linkKarma, rule.author.post_karma));
            }
            if (rule.author.comment_karma) {
                thresholdChecks.push(meetsNumericThreshold(participant.commentKarma, rule.author.comment_karma));
            }
            if (rule.author.combined_karma) {
                thresholdChecks.push(meetsNumericThreshold(participant.linkKarma + participant.commentKarma, rule.author.combined_karma));
            }
            if (rule.author.account_age) {
                thresholdChecks.push(meetsDateThreshold(participant.createdAt, rule.author.account_age));
            }

            if (thresholdChecks.length > 0) {
                // Satisfy Any Threshold: If no check came back true, quit.
                if (rule.author.satisfy_any_threshold && !thresholdChecks.includes(true)) {
                    console.log("Satisfy Any Threshold: No threshold checks passed.");
                    return;
                } else if (!rule.author.satisfy_any_threshold && thresholdChecks.includes(false)) {
                    console.log("Satisfy Any Threshold: Not all threshold checks passed.");
                    return;
                }
            }

            if (rule.author.is_banned !== undefined) {
                const userIsBanned = await isBanned(context, subreddit.name, participant.username);
                if (rule.author.is_banned !== userIsBanned) {
                    console.log("User banned check failed, skipping rule.");
                    return;
                }
            }

            if (rule.author.is_contributor !== undefined) {
                const userIsContributor = await isContributor(context, subreddit.name, participant.username);
                if (rule.author.is_contributor !== userIsContributor) {
                    console.log("Contributor check failed, skipping rule.");
                    return;
                }
            }

            if (rule.author.is_moderator !== undefined) {
                const userIsModerator = await isModerator(context, subreddit.name, participant.username);
                if (rule.author.is_moderator !== userIsModerator) {
                    console.log("Moderator check failed, skipping rule.");
                    return;
                }
            }
        }

        if (rule.author.is_shadowbanned !== undefined) {
            if (rule.author.is_shadowbanned !== (participant === undefined)) {
                console.log("Shadowban check failed, skipping rule.");
                return;
            }
        }
    }

    if (rule.mod_action) {
        const moderators = stringOrStringArrayToStringArray(rule.mod_action.moderator_name);

        console.log(moderators);

        let modLog = await context.reddit.getModerationLog({
            subredditName: subreddit.name,
            moderatorUsernames: moderators,
            limit: 100,
        }).all();

        console.log(modLog.length);

        if (rule.mod_action.action_within) {
            modLog = modLog.filter(x => rule.mod_action && rule.mod_action.action_within && meetsDateThreshold(x.createdAt, rule.mod_action.action_within, ">"));
            console.log(`After removing old entries: ${modLog.length} log entries still found`);
        }

        if (rule.mod_action.action_reason) {
            const reasons = stringOrStringArrayToStringArray(rule.mod_action.action_reason);
            if (reasons) {
                modLog = modLog.filter(logEntry => !reasons.some(reason => `${logEntry.details ?? ""} ${logEntry.description ?? ""}`.toLowerCase().includes(reason)));
                console.log(`After removing non-matching reasons: ${modLog.length} log entries still found`);
            }
        }

        if (modLog.length === 0) {
            console.log("No matching mod log entry!");
            return;
        }
    }

    return rule;
}

function meetsNumericThreshold (input: number, threshold: string): boolean {
    const regex = /^(<|>|<=|>=|=)?\s?(\d+)$/;
    const matches = threshold.match(regex);
    if (!matches || matches.length !== 3) {
        return false;
    }

    const operator = matches[1];
    const value = parseInt(matches[2]);

    switch (operator) {
        case "":
        case "=":
            return input === value;
        case "<":
            return input < value;
        case "<=":
            return input <= value;
        case ">":
            return input > value;
        case ">=":
            return input >= value;
        default:
            return false;
    }
}

function meetsDateThreshold (input: Date, threshold: string, defaultOperator?: string): boolean {
    const regex = /^(<|>|<=|>=)?\s?(\d+)\s(minutes|hours|days|weeks|months|years)$/;
    const matches = threshold.match(regex);
    if (!matches || matches.length !== 4) {
        return false;
    }

    let operator: string | undefined = matches[1];
    if (!operator && defaultOperator) {
        operator = defaultOperator;
    }
    const value = parseInt(matches[2]);
    const interval = matches[3];

    let duration: Duration | undefined;
    switch (interval) {
        case "minutes":
            duration = {minutes: value};
            break;
        case "hours":
            duration = {hours: value};
            break;
        case "days":
            duration = {days: value};
            break;
        case "weeks":
            duration = {weeks: value};
            break;
        case "months":
            duration = {months: value};
            break;
        case "years":
            duration = {years: value};
            break;
    }

    if (!duration) {
        return false;
    }

    switch (operator) {
        case "":
        case "=":
            return add(input, duration) === new Date();
        case "<":
            return add(input, duration) < new Date();
        case "<=":
            return add(input, duration) <= new Date();
        case ">":
            return add(input, duration) > new Date();
        case ">=":
            return add(input, duration) >= new Date();
        default:
            return false;
    }
}
