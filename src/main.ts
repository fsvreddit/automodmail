import { Devvit } from "@devvit/public-api";
import { actOnMessageAfterDelay, onModmailReceiveEvent } from "./autoresponder.js";
import { appSettings, saveRulesToWikiPage } from "./settings.js";

Devvit.addSettings(appSettings);

Devvit.addTrigger({
    event: "ModMail",
    onEvent: onModmailReceiveEvent,
});

Devvit.addSchedulerJob({
    name: "actOnMessageAfterDelay",
    onRun: actOnMessageAfterDelay,
});

Devvit.addSchedulerJob({
    name: "saveRulesToWikiPage",
    onRun: saveRulesToWikiPage,
});

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;
