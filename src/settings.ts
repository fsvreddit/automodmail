import { JSONObject, ScheduledJobEvent, SettingsFormField, SettingsFormFieldValidatorEvent, TriggerContext, User, WikiPage, WikiPagePermissionLevel } from "@devvit/public-api";
import { languageList } from "./i18n.js";
import { parseRules } from "./config.js";
import { addSeconds } from "date-fns";

export enum AppSettingName {
    Rules = "rules",
    BackupToWikiPage = "backupToWikiPage",
    Signoff = "signoff",
    IncludeSignoffForMods = "includeSignoffForMods",
    SecondsDelayBeforeSend = "secondsDelayBeforeSend",
    Locale = "locale",
    PostString = "postString",
    CommentString = "commentString",
}

export interface AppSettings {
    rules?: string;
    backupToWikiPage: boolean;
    signoff?: string;
    includeSignoffForMods: boolean;
    secondsDelayBeforeSend: number;
    locale: [string];
    postString?: string;
    commentString?: string;
}

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
function selectFieldHasOptionChosen (event: SettingsFormFieldValidatorEvent<string[]>): void | string {
    if (!event.value || event.value.length !== 1) {
        return "You must choose an option";
    }
}

export const defaultSignoff = "*This is an automatic response. If you need more assistance, please reply to this message and a human moderator will review your request.*";

export const appSettings: SettingsFormField[] = [
    {
        type: "paragraph",
        name: AppSettingName.Rules,
        label: "Enter YAML autoresponse rules",
        helpText: "Please see documentation here for syntax: https://www.reddit.com/r/fsvapps/wiki/auto-modmail",
        lineHeight: 10,
        onValidate: async (event, context) => {
            try {
                parseRules(event.value);

                await context.scheduler.runJob({
                    name: "saveRulesToWikiPage",
                    runAt: addSeconds(new Date(), 5),
                    data: context.userId ? { userId: context.userId } : undefined,
                });
            } catch (error) {
                if (error instanceof Error) {
                    return `Error parsing rules: ${error.message}`;
                } else {
                    return "Error parsing rules";
                }
            }
        },
    },
    {
        type: "boolean",
        name: AppSettingName.BackupToWikiPage,
        label: "Backup rules to wiki page",
        helpText: "Backs up rules to the wiki page 'automodmailrules', visible to subreddit mods only",
        defaultValue: false,
    },
    {
        type: "paragraph",
        name: AppSettingName.Signoff,
        label: "Enter text to accompany all autoresponses",
        helpText: "It is recommended that you use this to inform your users that the reply was automated.",
        defaultValue: defaultSignoff,
    },
    {
        type: "boolean",
        name: AppSettingName.IncludeSignoffForMods,
        label: "Include the text configured above when processing actions triggered by mod messages",
        helpText: "If this is disabled, the text will only be included when this app is reacting to messages from users.",
        defaultValue: true,
    },
    {
        type: "number",
        name: AppSettingName.SecondsDelayBeforeSend,
        label: "Number of seconds to wait before acting on modmails",
        helpText: "Acts on modmails after a delay, may be useful if you need other modmail bots to run first.",
        defaultValue: 0,
    },
    {
        type: "group",
        label: "Language Options",
        fields: [
            {
                type: "select",
                name: AppSettingName.Locale,
                label: "Language to use for output",
                helpText: "Affects {{mod_action_timespan_to_now}}, {{mod_action_relative_time}} and {{mod_action_target_kind}} placeholders at the present time",
                multiSelect: false,
                options: languageList.map(language => ({ label: language.languageName, value: language.isoCode })),
                defaultValue: ["en"],
                onValidate: selectFieldHasOptionChosen,
            },
            {
                type: "string",
                name: AppSettingName.PostString,
                label: "Override text for 'post'",
                helpText: "If you prefer to use a different term to the default for the chosen language, enter it here.",
            },
            {
                type: "string",
                name: AppSettingName.CommentString,
                label: "Override text for 'comment'",
                helpText: "If you prefer to use a different term to the default for the chosen language, enter it here.",
            },
        ],
    },
];

export async function saveRulesToWikiPage (event: ScheduledJobEvent<JSONObject | undefined>, context: TriggerContext) {
    const settings = await getAllSettings(context);
    const currentRules = settings.rules;
    if (!currentRules || !settings.backupToWikiPage) {
        return;
    }

    const wikiPageName = "automodmailrules";

    const subreddit = await context.reddit.getCurrentSubreddit();
    let wikiPage: WikiPage | undefined;
    try {
        wikiPage = await context.reddit.getWikiPage(subreddit.name, wikiPageName);
    } catch {
        //
    }

    if (wikiPage && wikiPage.content.trim() === currentRules.trim()) {
        // Rules haven't changed.
        return;
    }

    let reason: string | undefined;
    const userId = event.data?.userId as string | undefined;
    if (userId) {
        let user: User | undefined;
        try {
            user = await context.reddit.getUserById(userId);
        } catch {
            //
        }

        if (user) {
            reason = `Rules updated by /u/${user.username}`;
        }
    }

    const wikiUpdateOptions = {
        content: currentRules,
        page: wikiPageName,
        subredditName: subreddit.name,
        reason,
    };

    if (wikiPage) {
        await context.reddit.updateWikiPage(wikiUpdateOptions);
    } else {
        await context.reddit.createWikiPage(wikiUpdateOptions);
        await context.reddit.updateWikiPageSettings({
            listed: true,
            page: wikiPageName,
            permLevel: WikiPagePermissionLevel.MODS_ONLY,
            subredditName: subreddit.name,
        });
    }
}

export async function getAllSettings (context: TriggerContext): Promise<AppSettings> {
    return await context.settings.getAll<AppSettings>();
}
