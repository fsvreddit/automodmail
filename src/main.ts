import { Devvit } from "@devvit/public-api";
import { actOnMessageAfterDelay, onModmailReceiveEvent } from "./autoresponder.js";
import { appSettings, saveRulesToWikiPage } from "./settings.js";
import { handleDeletedComment, handleDeletedPost } from "./deletions.js";

Devvit.addSettings(appSettings);

Devvit.addTrigger({
    event: "ModMail",
    onEvent: onModmailReceiveEvent,
});

Devvit.addTrigger({
    event: "CommentDelete",
    onEvent: handleDeletedComment,
});

Devvit.addTrigger({
    event: "PostDelete",
    onEvent: handleDeletedPost,
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
