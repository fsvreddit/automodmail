import {Devvit} from "@devvit/public-api";
import {actOnMessageAfterDelay, onModmailReceiveEvent} from "./autoresponder.js";
import {appSettings} from "./settings.js";

Devvit.addSettings(appSettings);

Devvit.addTrigger({
    event: "ModMail",
    onEvent: onModmailReceiveEvent,
});

Devvit.addSchedulerJob({
    name: "actOnMessageAfterDelay",
    onRun: actOnMessageAfterDelay,
});

Devvit.configure({
    redditAPI: true,
    redis: true,
});

export default Devvit;

