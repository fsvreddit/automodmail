/* eslint-disable camelcase */
import {ScheduledJobEvent, TriggerContext, User} from "@devvit/public-api";
import {ModMail} from "@devvit/protos";
import {ResponseRule, SearchOption, parseRules} from "./config.js";
import {formatDistanceToNow, addSeconds, subMinutes, subHours, subDays, subWeeks, subMonths, subYears, formatRelative} from "date-fns";
import {ThingPrefix, isBanned, isContributor, replaceAll} from "./utility.js";
import {Language, languageFromString} from "./i18n.js";
import pluralize from "pluralize";
import _ from "lodash";
import RegexEscape from "regex-escape";
import {AppSetting, defaultSignoff} from "./settings.js";
import markdownEscape from "markdown-escape";

export const numericComparatorPattern = "^(<|>|<=|>=|=)?\\s?(\\d+)$";
export const dateComparatorPattern = "^(<|>|<=|>=)?\\s?(\\d+)\\s(minute|hour|day|week|month|year)s?$";

interface RuleMatchContext {
    ruleMatched: boolean,
    priority: number,
    reply?: string,
    mute?: number,
    archive?: boolean,
    unban?: boolean,
    approve_user?: boolean,
    set_flair?: {
        override_flair?: boolean,
        set_flair_text?: string,
        set_flair_css_class?: string,
        set_flair_template_id?: string,
    },
    modActionDate?: Date,
    modActionTargetPermalink?: string,
    modActionTargetKind?: "post" | "comment",
    verboseLogs: string[],
}

interface ModmailAction {
    conversationId: string,
    username: string,
    reply?: string,
    mute?: number
    archive?: boolean,
    unban?: boolean,
    approve_user?: boolean,
    set_flair?: {
        override_flair?: boolean,
        set_flair_text?: string,
        set_flair_css_class?: string,
        set_flair_template_id?: string,
    },
}

/**
 * Handles the Devvit trigger that fires on any new Modmail Receive events.
 * @param event The trigger event
 * @param context Context
 */
export async function onModmailReceiveEvent (event: ModMail, context: TriggerContext) {
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

    if (!conversationResponse.conversation || !conversationResponse.conversation.id) {
        return;
    }

    // Ensure that the modmail has a participant i.e. is about a user, and not a sub to sub modmail or internal discussion
    if (!conversationResponse.conversation.participant || !conversationResponse.conversation.participant.name) {
        console.log("There is no participant for the modmail conversation e.g. internal mod discussion");
        return;
    }

    const participantName = conversationResponse.conversation.participant.name;

    const messagesInConversation = Object.values(conversationResponse.conversation.messages);

    const firstMessage = messagesInConversation[0];
    if (!firstMessage.id) {
        return;
    }

    const isFirstMessage = event.messageId.includes(firstMessage.id);
    const currentMessage = messagesInConversation.find(message => message.id && event.messageId.includes(message.id));

    if (!currentMessage) {
        console.log("Cannot find current message!");
        return;
    }

    if (!currentMessage.author) {
        console.log("First message's author is not defined.");
        return;
    }

    if (isFirstMessage && currentMessage.author.name !== participantName) {
        console.log("Outgoing modmail, first message. Quitting.");
        return;
    }

    const isFirstUserReply = !isFirstMessage && currentMessage.id === messagesInConversation.find(message => message.id !== firstMessage.id && message.author && message.author.name === participantName)?.id;

    console.log({
        isFirstMessage,
        isFirstUserReply,
        firstMessageId: firstMessage.id,
        currentMessageId: currentMessage.id,
    });

    const {isAdmin, isMod} = currentMessage.author;

    const settings = await context.settings.getAll();

    const rulesYaml = settings[AppSetting.Rules] as string ?? "";
    let rules = parseRules(rulesYaml);

    // Narrow down to eligible rules
    if (isFirstMessage) {
        rules = rules.filter(rule => !rule.is_reply && !rule.is_first_user_reply);
    } else {
        rules = rules.filter(rule => rule.is_reply || rule.is_first_user_reply && isFirstUserReply);
    }

    rules = rules.filter(rule => !rule.author || (rule.author && !rule.author.is_moderator || rule.author.is_moderator && isMod));
    rules = rules.filter(rule => !rule.author || rule.author && (rule.author.is_participant === undefined || rule.author.is_participant === currentMessage.author?.isParticipant));

    if (rules.length === 0) {
        console.log("No eligible rules exist for a message in this state. Quitting.");
        return;
    }

    let participant: User | undefined;
    try {
        // Doing this in a try/catch because otherwise the user might be shadowbanned.
        participant = await context.reddit.getUserByUsername(conversationResponse.conversation.participant.name);
    } catch {
        // Ignore - leave participant variable undefined.
    }

    const subject = conversationResponse.conversation.subject ?? "";
    const body = currentMessage.bodyMarkdown ?? "";
    const subreddit = await context.reddit.getCurrentSubreddit();

    const processedRules: RuleMatchContext[] = [];
    // Sort rules by priority descending.
    rules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    for (const rule of rules) {
        // eslint-disable-next-line no-await-in-loop
        const ruleResult = await checkRule(context, subreddit.name, rule, subject, body, conversationResponse.conversation.participant.name, participant, isMod, isAdmin);
        processedRules.push(ruleResult);

        if (ruleResult.ruleMatched) {
            // Stop processing more rules - we have a match.
            break;
        }
    }

    const rulesWithDebugInfo = processedRules.filter(x => x.verboseLogs.length > 0);
    if (rulesWithDebugInfo.length > 0) {
        let debugOutput = "Modmail Automator logs\n\n";

        for (const rule of rulesWithDebugInfo) {
            debugOutput += "---\n\n";
            debugOutput += `Priority: ${rule.priority}\n\n`;
            debugOutput += `Rule matched: ${JSON.stringify(rule.ruleMatched)}\n\n`;
            debugOutput += rule.verboseLogs.map(x => `* ${x}`).join("\n");
            debugOutput += "\n\n";

            if (rule.ruleMatched) {
                debugOutput += "Actions to take if this is the highest priority match:\n\n";
                if (rule.reply) {
                    debugOutput += "* Reply to user\n";
                }
                if (rule.archive) {
                    debugOutput += "* Archive message\n";
                }
                if (rule.mute) {
                    debugOutput += `* Mute for ${rule.mute} ${pluralize("day", rule.mute)} (note that Reddit may ignore this figure and mute for 3 days regardless)\n`;
                }
                if (rule.unban) {
                    debugOutput += "* Unban user\n";
                }
                if (rule.set_flair) {
                    debugOutput += "* Set Flair\n";
                }
                debugOutput += "\n";
            }
        }

        await context.reddit.modMail.reply({
            body: debugOutput,
            conversationId: conversationResponse.conversation.id,
            isInternal: true,
            isAuthorHidden: false,
        });
    }

    const matchedRule = processedRules.find(x => x.ruleMatched);

    if (!matchedRule) {
        console.log("No rules matched.");
        return;
    }

    console.log("Matched a rule.");

    const action: ModmailAction = {
        conversationId: conversationResponse.conversation.id,
        username: event.messageAuthor.name,
        archive: matchedRule.archive,
        mute: matchedRule.mute,
        unban: matchedRule.unban,
        approve_user: matchedRule.approve_user,
        set_flair: matchedRule.set_flair,
    };

    if (matchedRule.reply) {
        let replyMessage = matchedRule.reply;

        const signoff = settings[AppSetting.Signoff] as string ?? defaultSignoff;
        const includeSignoffForMods = settings[AppSetting.IncludeSignoffForMods] as boolean ?? false;
        if (signoff && (!isMod || includeSignoffForMods)) {
            replyMessage += `\n\n${signoff}`;
        }

        replyMessage = replaceAll(replyMessage, "{{author}}", markdownEscape(event.messageAuthor.name));
        replyMessage = replaceAll(replyMessage, "{{subreddit}}", markdownEscape(subreddit.name));
        let language: Language | undefined;
        if (matchedRule.modActionDate || matchedRule.modActionTargetKind) {
            const localeResult = settings[AppSetting.Locale] as string[] ?? ["enUS"];
            language = languageFromString(localeResult[0]);
        }

        if (matchedRule.modActionDate && language) {
            replyMessage = replaceAll(replyMessage, "{{mod_action_timespan_to_now}}", formatDistanceToNow(matchedRule.modActionDate, {locale: language.locale}));
            replyMessage = replaceAll(replyMessage, "{{mod_action_relative_time}}", formatRelative(matchedRule.modActionDate, new Date(), {locale: language.locale}));
        }
        if (matchedRule.modActionTargetPermalink) {
            replyMessage = replaceAll(replyMessage, "{{mod_action_target_permalink}}", matchedRule.modActionTargetPermalink);
        }
        if (matchedRule.modActionTargetKind && language) {
            const settingsKey = matchedRule.modActionTargetKind === "post" ? AppSetting.PostString : AppSetting.CommentString;
            let targetKind = settings[settingsKey] as string ?? "";
            if (!targetKind) {
                targetKind = matchedRule.modActionTargetKind === "post" ? language.postWord : language.commentWord;
            }

            replyMessage = replaceAll(replyMessage, "{{mod_action_target_kind}}", targetKind);
        }

        action.reply = replyMessage;
    }

    const sendAfterDelay = settings[AppSetting.SecondsDelayBeforeSend] as number ?? 0;
    if (sendAfterDelay) {
        console.log(`Delayed action enabled. Will action modmail in ${sendAfterDelay} ${pluralize("second", sendAfterDelay)}`);
        await context.scheduler.runJob({
            name: "actOnMessageAfterDelay",
            data: {action},
            runAt: addSeconds(new Date(), sendAfterDelay),
        });
    } else {
        await actOnRule(action, context);
    }
}

async function actOnRule (action: ModmailAction, context: TriggerContext) {
    if (action.reply) {
        await context.reddit.modMail.reply({
            body: action.reply,
            conversationId: action.conversationId,
            isInternal: false,
            isAuthorHidden: true,
        });
        console.log("Replied to modmail");
    }

    if (action.mute) {
        await context.reddit.modMail.muteConversation({
            conversationId: action.conversationId,
            numHours: action.mute * 24,
        });
        console.log("User muted");
    }

    if (action.archive) {
        await context.reddit.modMail.archiveConversation(action.conversationId);
        console.log("Conversation archived");
    }

    if (action.unban || action.approve_user || action.set_flair) {
        const subreddit = await context.reddit.getCurrentSubreddit();

        if (action.unban) {
            await context.reddit.unbanUser(action.username, subreddit.name);
            console.log("User unbanned");
        }

        if (action.approve_user) {
            await context.reddit.approveUser(action.username, subreddit.name);
            console.log("User has been added as approved user");
        }

        if (action.set_flair) {
            let canSetFlair = true;
            if (!action.set_flair.override_flair) {
                const user = await context.reddit.getUserByUsername(action.username);
                const currentFlair = await user.getUserFlairBySubreddit(subreddit.name);
                if (currentFlair) {
                    canSetFlair = false;
                }
            }

            if (canSetFlair) {
                await context.reddit.setUserFlair({
                    subredditName: subreddit.name,
                    username: action.username,
                    text: action.set_flair.set_flair_text,
                    cssClass: action.set_flair.set_flair_css_class,
                    flairTemplateId: action.set_flair.set_flair_template_id,
                });
                console.log("New flair set");
            } else {
                console.log("User already has a flair, cannot set.");
            }
        }
    }
}

export async function actOnMessageAfterDelay (event: ScheduledJobEvent, context: TriggerContext) {
    if (!event.data) {
        console.log("Scheduler job's data not assigned");
        return;
    }

    const action = event.data.action as ModmailAction;
    await actOnRule(action, context);
}

function logDebug (verboseLogsEnabled: boolean | undefined, reason: string, verboseLogOutput: string[]) {
    console.log(reason);
    if (verboseLogsEnabled) {
        verboseLogOutput.push(reason);
    }
}

/**
 * Checks if a rule matches the modmail contents and user/modlog context
 * @param context Reddit TriggerContext object
 * @param subreddit The subreddit object
 * @param rule The rule object
 * @param subject The subject line from the modmail
 * @param body The body text from the modmail
 * @param participant A user object, or undefined if a shadowbanned/suspended user
 * @returns An object that describes if the rule matched, and if so provides extra context for the rule actions and how it matched
 */
export async function checkRule (context: TriggerContext | undefined, subredditName: string, rule: ResponseRule, subject: string, body: string, username: string, participant?: User, userIsModerator?: boolean, userIsAdmin?: boolean): Promise<RuleMatchContext> {
    const result: RuleMatchContext = {
        ruleMatched: false,
        priority: rule.priority ?? 0,
        reply: rule.reply,
        mute: rule.mute,
        archive: rule.archive,
        unban: rule.unban,
        approve_user: rule.approve_user,
        set_flair: rule.author?.set_flair,
        verboseLogs: [],
    };

    if (rule.rule_friendly_name) {
        logDebug(rule.verbose_logs, `Processing rule with name "${rule.rule_friendly_name}"`, result.verboseLogs);
    }

    if (rule.moderators_exempt !== false && userIsModerator && !(rule.author && rule.author.is_moderator)) {
        logDebug(rule.verbose_logs, "Rule exempts moderators, and user is a mod.", result.verboseLogs);
        return result;
    }

    if (rule.admins_exempt !== false && userIsAdmin) {
        logDebug(rule.verbose_logs, "Rule exempts admins, and user is an admin.", result.verboseLogs);
        return result;
    }

    if (rule.subject) {
        if (!checkTextMatch(subject, rule.subject, rule.subject_options)) {
            logDebug(rule.verbose_logs, "Subject does not match.", result.verboseLogs);
            return result;
        } else {
            logDebug(rule.verbose_logs, "Subject matched successfully.", result.verboseLogs);
        }
    }

    if (rule.notsubject) {
        if (!checkTextMatch(subject, rule.notsubject, rule.notsubject_options)) {
            logDebug(rule.verbose_logs, "Negated subject matched, so rule fails", result.verboseLogs);
            return result;
        } else {
            logDebug(rule.verbose_logs, "Negated subject did not match, so check passes.", result.verboseLogs);
        }
    }

    if (rule.subject_shorter_than) {
        if (subject.length < rule.subject_shorter_than) {
            logDebug(rule.verbose_logs, "Subject is shorter than specified length, so check passes.", result.verboseLogs);
        } else {
            logDebug(rule.verbose_logs, "Subject is too long, so rule fails", result.verboseLogs);
            return result;
        }
    }

    if (rule.subject_longer_than) {
        if (subject.length > rule.subject_longer_than) {
            logDebug(rule.verbose_logs, "Subject is longer than specified length, so check passes.", result.verboseLogs);
        } else {
            logDebug(rule.verbose_logs, "Subject is too short, so rule fails", result.verboseLogs);
            return result;
        }
    }

    if (rule.body) {
        if (!checkTextMatch(body, rule.body, rule.body_options)) {
            logDebug(rule.verbose_logs, "Body does not match.", result.verboseLogs);
            return result;
        } else {
            logDebug(rule.verbose_logs, "Body matched successfully.", result.verboseLogs);
        }
    }

    if (rule.notbody) {
        if (!checkTextMatch(body, rule.notbody, rule.notbody_options)) {
            logDebug(rule.verbose_logs, "Negated body matched, so rule fails", result.verboseLogs);
            return result;
        } else {
            logDebug(rule.verbose_logs, "Negated body did not match, so check passes.", result.verboseLogs);
        }
    }

    if (rule.body_shorter_than) {
        if (body.length < rule.body_shorter_than) {
            logDebug(rule.verbose_logs, "Body is shorter than specified length, so check passes.", result.verboseLogs);
        } else {
            logDebug(rule.verbose_logs, "Body is too long, so rule fails", result.verboseLogs);
            return result;
        }
    }

    if (rule.body_longer_than) {
        if (body.length > rule.body_longer_than) {
            logDebug(rule.verbose_logs, "Body is longer than specified length, so check passes.", result.verboseLogs);
        } else {
            logDebug(rule.verbose_logs, "Body is too short, so rule fails", result.verboseLogs);
            return result;
        }
    }

    if (rule.subjectandbody) {
        if (!checkTextMatch(subject, rule.subjectandbody, rule.subjectandbody_options) && !checkTextMatch(body, rule.subjectandbody, rule.subjectandbody_options)) {
            logDebug(rule.verbose_logs, "subject+body does not match.", result.verboseLogs);
            return result;
        } else {
            logDebug(rule.verbose_logs, "subject+body matched successfully.", result.verboseLogs);
        }
    }

    if (rule.notsubjectandbody) {
        if (!checkTextMatch(subject, rule.notsubjectandbody, rule.notsubjectandbody_options) || !checkTextMatch(body, rule.notsubjectandbody, rule.notsubjectandbody_options)) {
            logDebug(rule.verbose_logs, "Negated subject+body matched, so rule fails", result.verboseLogs);
            return result;
        } else {
            logDebug(rule.verbose_logs, "Negated subject+body did not match, so check passes", result.verboseLogs);
        }
    }

    if (rule.author) {
        if (participant) {
            // Most checks need the user to be not shadowbanned.
            const thresholdChecks: boolean[] = [];
            if (rule.author.post_karma) {
                const thresholdMatched = meetsNumericThreshold(participant.linkKarma, rule.author.post_karma);
                logDebug(rule.verbose_logs, `Post karma threshold matched: ${JSON.stringify(thresholdMatched)}`, result.verboseLogs);
                thresholdChecks.push(thresholdMatched);
            }
            if (rule.author.comment_karma) {
                const thresholdMatched = meetsNumericThreshold(participant.commentKarma, rule.author.comment_karma);
                logDebug(rule.verbose_logs, `Comment karma threshold matched: ${JSON.stringify(thresholdMatched)}`, result.verboseLogs);
                thresholdChecks.push(thresholdMatched);
            }
            if (rule.author.combined_karma) {
                const thresholdMatched = meetsNumericThreshold(participant.linkKarma + participant.commentKarma, rule.author.combined_karma);
                logDebug(rule.verbose_logs, `Combined karma threshold matched: ${JSON.stringify(thresholdMatched)}`, result.verboseLogs);
                thresholdChecks.push(thresholdMatched);
            }
            if (rule.author.account_age) {
                const thresholdMatched = meetsDateThreshold(participant.createdAt, rule.author.account_age);
                logDebug(rule.verbose_logs, `Account age threshold matched: ${JSON.stringify(thresholdMatched)}`, result.verboseLogs);
                thresholdChecks.push(thresholdMatched);
            }

            if (thresholdChecks.length > 0) {
                logDebug(rule.verbose_logs, `Number of threshold checks matched: ${_.compact(thresholdChecks).length} of ${thresholdChecks.length} run`, result.verboseLogs);
                // Satisfy Any Threshold: If no check came back true, quit.)
                if (rule.author.satisfy_any_threshold && !thresholdChecks.includes(true)) {
                    logDebug(rule.verbose_logs, "Satisfy any threshold is set to true, therefore threshold checks not passed.", result.verboseLogs);
                    return result;
                } else if (!rule.author.satisfy_any_threshold && thresholdChecks.includes(false)) {
                    logDebug(rule.verbose_logs, "Satisfy any threshold is set to false or unspecified, therefore threshold checks not passed.", result.verboseLogs);
                    return result;
                }
                logDebug(rule.verbose_logs, `Satisfy any threshold is set to ${JSON.stringify(rule.author.satisfy_any_threshold)} therefore threshold checks passed.`, result.verboseLogs);
            }

            if (context && rule.author.is_banned !== undefined) {
                const userIsBanned = await isBanned(context, subredditName, participant.username);
                if (rule.author.is_banned !== userIsBanned) {
                    logDebug(rule.verbose_logs, "User banned check failed, skipping rule.", result.verboseLogs);
                    return result;
                } else {
                    logDebug(rule.verbose_logs, "User banned check matched.", result.verboseLogs);
                }
            }

            if (context && rule.author.is_contributor !== undefined) {
                const userIsContributor = await isContributor(context, subredditName, participant.username);
                if (rule.author.is_contributor !== userIsContributor) {
                    logDebug(rule.verbose_logs, "Approved User check failed, skipping rule.", result.verboseLogs);
                    return result;
                } else {
                    logDebug(rule.verbose_logs, "Approved User check matched.", result.verboseLogs);
                }
            }

            if (rule.author.is_moderator !== undefined) {
                if (rule.author.is_moderator !== userIsModerator) {
                    logDebug(rule.verbose_logs, "Moderator check failed, skipping rule.", result.verboseLogs);
                    return result;
                } else {
                    logDebug(rule.verbose_logs, "Moderator check passed.", result.verboseLogs);
                }
            }

            if (rule.author.flair_text || rule.author.flair_css_class || rule.author.flair_css_class) {
                const flair = await participant.getUserFlairBySubreddit(subredditName);
                if (!flair) {
                    logDebug(rule.verbose_logs, "User does not have flair, but flair checks exist. Skipping rule.", result.verboseLogs);
                    return result;
                }

                if (rule.author.flair_text) {
                    if (!checkTextMatch(flair.flairText ?? "", rule.author.flair_text, rule.author.flair_text_options)) {
                        logDebug(rule.verbose_logs, "Flair text does not match.", result.verboseLogs);
                        return result;
                    } else {
                        logDebug(rule.verbose_logs, "Flair text matched successfully.", result.verboseLogs);
                    }
                }

                if (rule.author.notflair_text) {
                    if (!checkTextMatch(flair.flairText ?? "", rule.author.notflair_text, rule.author.notflair_text_options)) {
                        logDebug(rule.verbose_logs, "Negated flair text matched, so rule fails", result.verboseLogs);
                        return result;
                    } else {
                        logDebug(rule.verbose_logs, "Negated flair text did not match, so check passes.", result.verboseLogs);
                    }
                }

                if (rule.author.flair_css_class) {
                    if (!checkTextMatch(flair.flairCssClass ?? "", rule.author.flair_css_class, rule.author.flair_css_class_options)) {
                        logDebug(rule.verbose_logs, "Flair CSS class does not match.", result.verboseLogs);
                        return result;
                    } else {
                        logDebug(rule.verbose_logs, "Flair CSS class matched successfully.", result.verboseLogs);
                    }
                }

                if (rule.author.notflair_css_class) {
                    if (!checkTextMatch(flair.flairCssClass ?? "", rule.author.notflair_css_class, rule.author.notflair_css_class_options)) {
                        logDebug(rule.verbose_logs, "Negated flair CSS class matched, so rule fails", result.verboseLogs);
                        return result;
                    } else {
                        logDebug(rule.verbose_logs, "Negated flair CSS class did not match, so check passes.", result.verboseLogs);
                    }
                }

                logDebug(rule.verbose_logs, "Flair matched.", result.verboseLogs);
            }
        }

        if (rule.author.name) {
            if (!checkTextMatch(username, rule.author.name, rule.author.name_options)) {
                logDebug(rule.verbose_logs, "Author name doesn't match", result.verboseLogs);
                return result;
            } else {
                logDebug(rule.verbose_logs, "Author name matches", result.verboseLogs);
            }
        }

        if (rule.author.notname) {
            if (!checkTextMatch(username, rule.author.notname, rule.author.notname_options)) {
                logDebug(rule.verbose_logs, "Negated author name matched, so rule failed", result.verboseLogs);
                return result;
            } else {
                logDebug(rule.verbose_logs, "Negated author name does not match, so check passes", result.verboseLogs);
            }
        }

        if (rule.author.is_shadowbanned !== undefined) {
            if (rule.author.is_shadowbanned !== (participant === undefined)) {
                logDebug(rule.verbose_logs, "Shadowban check failed, skipping rule.", result.verboseLogs);
                return result;
            } else {
                logDebug(rule.verbose_logs, "Shadowban check passed.", result.verboseLogs);
            }
        }

        if (!participant && (rule.author.account_age || rule.author.combined_karma || rule.author.comment_karma || rule.author.flair_css_class || rule.author.flair_text || rule.author.is_banned || rule.author.is_contributor)) {
            // Participant is undefined, and uncheckable author checks exist.
            logDebug(rule.verbose_logs, "Author is shadobanned and uncheckable author checks exist.", result.verboseLogs);
            return result;
        }
    }

    if (context && rule.mod_action && participant) {
        let modLog = await context.reddit.getModerationLog({
            subredditName,
            moderatorUsernames: rule.mod_action.moderator_name,
            type: rule.mod_action.mod_action_type,
            limit: 200,
        }).all();

        modLog = modLog.filter(x => x.target && x.target.author === participant.username);

        if (rule.mod_action.action_within) {
            modLog = modLog.filter(x => rule.mod_action && rule.mod_action.action_within && meetsDateThreshold(x.createdAt, rule.mod_action.action_within, "<"));
            console.log(`After removing old entries: ${modLog.length} log entries still found`);
        }

        if (rule.mod_action.action_reason) {
            modLog = modLog.filter(logEntry => rule.mod_action?.action_reason?.some(reason => `${logEntry.details ?? ""} ${logEntry.description ?? ""}`.toLowerCase().includes(reason.toLowerCase())));
            console.log(`After removing non-matching reasons: ${modLog.length} log entries still found`);
        }

        if (rule.mod_action.still_in_queue !== undefined) {
            const modQueue = await context.reddit.getModQueue({
                subreddit: subredditName,
                type: "all",
            }).all();

            if (rule.mod_action.still_in_queue) {
                modLog = modLog.filter(logEntry => logEntry.target && rule.mod_action?.still_in_queue === modQueue.some(queueItem => queueItem.id === logEntry.target?.id));
            }
        }

        if (modLog.length === 0) {
            logDebug(rule.verbose_logs, "No matching mod log entry!", result.verboseLogs);
            return result;
        } else {
            logDebug(rule.verbose_logs, `Found ${modLog.length} matching ${pluralize("entry", modLog.length)} in mod log.`, result.verboseLogs);
        }

        result.modActionDate = modLog[0].createdAt;
        if (modLog[0].target) {
            result.modActionTargetPermalink = modLog[0].target.permalink;
            if (modLog[0].target.id.startsWith(ThingPrefix.Comment)) {
                result.modActionTargetKind = "comment";
            } else if (modLog[0].target.id.startsWith(ThingPrefix.Post)) {
                result.modActionTargetKind = "post";
            }
        }
    }

    // All checks passed.
    result.ruleMatched = true;

    return result;
}

/**
 * A function to compare a number to a text input
 * @param input The numeric input
 * @param threshold The threshold to meet e.g. < 10
 * @returns True or false
 */
export function meetsNumericThreshold (input: number, threshold: string): boolean {
    const regex = new RegExp(numericComparatorPattern);
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

/**
 * A function to compare a number to a text input
 * @param input The date input
 * @param threshold The threshold to meet e.g. < 10 years
 * @param defaultOperator The operator to use if none is specified
 * @returns True or false
 */
export function meetsDateThreshold (input: Date, threshold: string, defaultOperator?: string): boolean {
    const regex = new RegExp(dateComparatorPattern);
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

    let comparisonDate: Date | undefined;
    switch (interval) {
        case "minute":
            comparisonDate = subMinutes(new Date(), value);
            break;
        case "hour":
            comparisonDate = subHours(new Date(), value);
            break;
        case "day":
            comparisonDate = subDays(new Date(), value);
            break;
        case "week":
            comparisonDate = subWeeks(new Date(), value);
            break;
        case "month":
            comparisonDate = subMonths(new Date(), value);
            break;
        case "year":
            comparisonDate = subYears(new Date(), value);
            break;
    }

    if (!comparisonDate) {
        return false;
    }

    switch (operator) {
        case "<":
            return comparisonDate < input;
        case "<=":
            return comparisonDate <= input;
        case ">":
            return comparisonDate > input;
        case ">=":
            return comparisonDate >= input;
        default:
            return false;
    }
}

export function checkTextMatch (input: string, matchText: string[], options?: SearchOption): boolean {
    if (!options) {
        options = {search_method: "includes", negate: false, case_sensitive: false};
    }

    if (options.search_method !== "regex" && !options.case_sensitive) {
        input = input.toLowerCase();
        matchText = matchText.map(item => item.toLowerCase());
    }

    let result: boolean;

    switch (options.search_method) {
        case "includes":
            result = matchText.some(x => input.includes(x));
            break;
        case "includes-word":
            result = matchText.some(x => new RegExp(`\\b${RegexEscape(x)}\\b`).test(input));
            break;
        case "starts-with":
            result = matchText.some(x => input.startsWith(x));
            break;
        case "ends-with":
            result = matchText.some(x => input.endsWith(x));
            break;
        case "full-exact":
            result = matchText.some(x => input === x);
            break;
        case "regex":
            if (options.case_sensitive) {
                result = matchText.some(x => new RegExp(x).test(input));
            } else {
                result = matchText.some(x => new RegExp(x, "i").test(input));
            }
            break;
        default:
            throw new Error(`Unexpected search method ${options.search_method ?? "undefined"}`);
    }

    if (options.negate) {
        return !result;
    } else {
        return result;
    }
}
