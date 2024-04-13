import {SettingsFormField} from "@devvit/public-api";
import {languageList} from "./i18n.js";
import {parseRules} from "./config.js";

export enum AppSetting {
    Rules = "rules",
    Signoff = "signoff",
    IncludeSignoffForMods = "includeSignoffForMods",
    SecondsDelayBeforeSend = "secondsDelayBeforeSend",
    Locale = "locale",
    PostString = "postString",
    CommentString = "commentString",
}

export const appSettings: SettingsFormField[] = [
    {
        type: "paragraph",
        name: AppSetting.Rules,
        label: "Enter YAML autoresponse rules",
        helpText: "Please see documentation here for syntax: https://www.reddit.com/r/fsvapps/wiki/auto-modmail",
        onValidate: ({value}) => {
            try {
                parseRules(value);
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
        type: "paragraph",
        name: AppSetting.Signoff,
        label: "Enter text to accompany all autoresponses",
        helpText: "It is recommended that you use this to inform your users that the reply was automated.",
        defaultValue: "*This is an automatic response. If you need more assistance, please reply to this message and a human moderator will review your request.*",
    },
    {
        type: "boolean",
        name: AppSetting.IncludeSignoffForMods,
        label: "Include signoff when processing actions triggered by mod messages",
        defaultValue: true,
    },
    {
        type: "number",
        name: AppSetting.SecondsDelayBeforeSend,
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
                name: AppSetting.Locale,
                label: "Language to use for output",
                helpText: "Affects {{mod_action_timespan_to_now}} and {{mod_action_target_kind}} placeholders at the present time",
                multiSelect: false,
                options: languageList.map(language => ({label: language.languageName, value: language.isoCode})),
                defaultValue: ["en"],
            },
            {
                type: "string",
                name: AppSetting.PostString,
                label: "Override text for 'post'",
                helpText: "If you prefer to use a different term to the default for the chosen language, enter it here.",
            },
            {
                type: "string",
                name: AppSetting.CommentString,
                label: "Override text for 'comment'",
                helpText: "If you prefer to use a different term to the default for the chosen language, enter it here.",
            },
        ],
    },
];

