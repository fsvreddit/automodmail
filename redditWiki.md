# Modmail Automator

Like AutoModerator, just for modmail.

This app allows subreddit moderators to define rules using YAML to autorespond to incoming modmails, and optionally archive the modmail afterwards. 

The intended use case in most cases is as a "first line" response to common questions, with users invited to reply and ask for more assistance if the autoresponder doesn't answer their question. This app will only ever respond to the first modmail in the chain.

The app supports a wide variety of different checks on three main categories of data: The modmail itself (subject and body), account properties (including age and karma) and recent mod actions made against the user.

If you're familiar with AutoModerator, you'll be able to work with this tool.

## General principles

Like AutoModerator, more than one rule can be specified. If you have more than one rule, separate the rules with ---

Comments are supported. To make a comment on a rule, use a # symbol and anything from that point onwards on the line will be considered a comment.

Strings may be enclosed in quotes but this is not mandatory. So the following are all valid:

    subject: "hello"
    subject: 'hello'
    subject: hello

If you need a string to start with a > character, you must enclose it in quotes because > is a special character in YAML denoting the start of a multi-line string.

## Modmail properties

`subject` matches the subject of the incoming modmail, and performs a match on the term or terms included. Likewise `body` matches the body of the incoming modmail.

`subject_regex` and `body_regex` likewise check the subject and body, but this time using regular expressions, which ignore case.

All four of these modmail properties checks can take a single value or an array of values. The following are all valid:

    subject: "Ban appeal"

    body: ["shadowbanned", "comments not showing"]

    subject: 
        - shadowbanned
        - comments not showing

All four of these can also support negation e.g. `~subject`. If you use negation, then none of the search terms may match. You can use normal and negated properties together e.g. `body` and `~body` may appear in the same rule, but `body` cannot appear twice.

### Modifiers

`subject` and `body` have optional modifiers to change how the text is matched. These are the same as AutoModerator minus full-text.

* `subject (includes)` will find the text anywhere - e.g. "and" will match the subject "sandwich". This is the default behaviour if no modifier is used.
* `subject (includes-word)` will only match if the search term matches an entire word.
* `subject (starts_with)` will only match text at the start of the subject.
* `subject (ends_with)` will only match text at the start of the subject.
* `subject (full_exact)` will match the entire subject completely.
* `subject (regex)` will match using a regular expression. Unlike AutoModerator, this cannot be used in conjunction with one of the other modifiers above but it can be used with the case-sensitive modifier below.

Additionally, you can specify case-sensitive searching (e.g. `body (includes-word, case_sensitive)`).

Previous versions of this app used different checks `subject_regex` and `body_regex` instead of modifiers. Old rules that use these will continue to work but I recommend moving to the new syntax.

## Account properties

Account properties come under the `author` value, just like in AutoModerator. Two broad categories (threshold checks and other account properties) are supported, and both can be specified in the same rule.

### Threshold checks

The tool supports four threshold checks: `post_karma`, `comment_karma`, `combined_karma` and `account_age`. Due to limitations of the Community Apps platform, it is not possible to include subreddit karma checks.

`post_karma`, `comment_karma`, `combined_karma` can have numeric comparators specified, not just exact values. For example, the following are all valid:

    author:
        post_karma: "< 100"
        comment_karma: "= 100"

`account age` additionally can include time units, with valid units being `minute`, `hour`, `day`, `week`, `month` and `year`. Time units can be singular or plural. Comparison operators supported are >, <, >= and <=. So the following are all valid:

    account_age: "< 1 year"

    account_age: "< 6 months"

    account_age: "> 2 week"

    account_age: "> 3 days"

Along with the four threshold checks, like AutoModerator this app supports the `satisfy_any_threshold` check. If `satisfy_any_threshold` is set to "true", the rule will pass if any of the checks pass, but if it is set to "false" then all must match e.g. this ruleset would pass if either the account age was under a year old, or the comment karma under 1000. If `satisfy_any_threshold` isn't specified, it defaults to false.

    author:
        account_age: "< 1 year"
        comment_karma: "< 1000"
        satisfy_any_threshold: "true"

It is unlikely that "=" checks will be useful for many rules, especially for dates.

### Other account properties

The app supports several other properties about users.

`flair_text` and `flair_css_class` are simple text checks that match the flair text or CSS class **exactly**. This can be useful if you use flairs to categorise users. E.g.

    author:
        flair_text: "Helpful"

There are also four true/false checks on account properties that may be useful: `is_contributor`, `is_moderator`, `is_shadowbanned` and `is_banned`. E.g.

    author:
        is_banned: "true"

You can also check the account name. `name` matches the user name and supports the same modifiers as `subject` and `body` as mentioned above. For example:

    author:
        name: "BadUser1234"

    author:
        name: ["BadUser1", "BadUser2"]

    author:
        name (regex, case-sensitive): "^ThrowRA"

Previous versions of this app used a different check (`name_regex`) for regular expression searches. If you have this syntax is in any existing rules then these will continue to work but I recommend moving to the new syntax for simplicity.

## Mod Action checks

Sometimes users write in after an action has been taken against them. These checks allow you to autorespond if a user is writing in about a recent action. These come under the `mod_action` property.

Sub properties are:

`moderator_name`: the name (or names) of the moderator who took the action. This is case sensitive. 

`mod_action_type`: the type of mod action taken. This must be one of the following: "banuser", "unbanuser", "spamlink", "removelink", "approvelink", "spamcomment", "removecomment", "approvecomment", "editflair", "lock", "unlock", "muteuser", "unmuteuser"

`action_within`: The timeframe that the mod action was taken in relative to the date/time of the modmail. E.g. `action_within: 30 minutes`. Like account age, supported time units are `minute`, `hour`, `day`, `week`, `month` and `year`, with both singular and plural forms supported.

`action_reason`: Text to match against the action_reason, if one is set (e.g. on `removecomment` or `removepost` mod actions). This is not case sensitive, checks substrings and both single and arrays are supported e.g.

    action_reason: ["ban evasion", "crowd control"]

    action_reason: "low karma"

**Note**: The app will only look back through the most recent 200 mod actions that match the specified moderator name(s) and/or mod actions. As a result, mod action checks are usually only suitable for fairly recent actions especially if you have a subreddit with a busy mod log. 

## Priority

Like AutoModerator, this app supports the `priority` attribute against rules. Rules without a priority are treated as priority 0. If more than one rule matches the incoming modmail, the actions on the rule with the highest priority are taken and others ignored.

`priority: 10`

Like with AutoModerator, "highest priority" means the rule with the highest numeric value, so Priority 10 would run before Priority 1, and rules without priority would run before Priority -1.

## Moderator and Admin Exemptions

Rules will not match if a moderator of a sub or an admin writes in to modmail unless this is specified against the rule.

`moderators_exempt: false`

If you specify `moderators_exempt: true`, this will behave as if `moderators_exempt` isn't specified at all.

`admins_exempt: false` has the same effect for admins.

## Actions to take

If all checks on a rule pass, there are a number of actions that can be taken: `reply`, `mute` and `archive`.

`reply` replies to the user with the text specified. The following formats are all supported:

    reply: "Here's some text to reply with"
    
    reply: |
        Here's a multiline reply.

        Like AutoModerator, this format is supported too.

`mute` mutes the author from modmail, and should be used sparingly (such as on rules that are used as a spam filter of sorts). Takes a number between 1 and 28 for the number of dates to mute for e.g. `mute: 7`. Note: Due to an issue with the Community Apps platform, all mutes will be for three days until the issue is fixed.

`archive` archives the modmail after sending a reply. You cannot use `archive` without a `reply` or `mute`. E.g. `archive: "true"`.

`unban` unbans the user (if they were already banned). E.g. `unban: "true"`.

### Placeholders on replies

The following placeholders are all supported:

`{{author}}` - the username for the user writing in, without the leading /u/

`{{subreddit}}` - the subreddit the modmail was sent to.

`{{mod_action_timespan_to_now}}` - a human readable timespan for the length of time elapsed since the detected mod action. Example output formats can be seen [here](https://date-fns.org/docs/formatDistanceToNow) and the language used can be configured in the app settings from a list of the most commonly used languages on Reddit (list based mostly on [this research](https://towardsdatascience.com/the-most-popular-languages-on-reddit-analyzed-with-snowflake-and-a-java-udtf-4e58c8ba473c)). If you would like to request another language, please send a message to /u/fsv.

`{{mod_action_target_permalink}}` - the link to the post or comment (if applicable) that the mod action was taken against.

`{{mod_action_target_kind}}` - Either "post" or "comment". Like the timespan above, this will respect the language chosen. You can also choose your own terms for "post" and "comment" in the configuration options if you need to support further languages, or if you think a better translation could have been used (if you do have any suggestions on improving translations, please contact /u/fsv!)

The three mod_action placeholders will only work if a mod_action check is present in the rule. 

## Debug options

If you add `verbose_logs: true` to any rule, the app will reply with a private mod note with information about why each check in a rule passed or failed. This can be useful when testing rules or trying to work out why a rule isn't working. I recommend only using this for short periods, maybe even just in test subreddits, because when any rule has verbose_logs turned on the app will respond to EVERY new modmail.

More than one rule can have verbose_logs enabled at a time, but it is generally going to be most useful to enable for a single rule at a time and only while testing it.

## "Signoff" for responses

In the configuration screen, you can also specify a "signoff" footer to be included on all autoresponses. It's recommended that you include one of these and use it to make users aware that the response is automatic and that they can reply to get more information from a human.

## Delay before acting on modmails

In the configuration screen, you can specify a number of seconds before acting on modmails. This may be useful if you have other modmail bots (e.g. [Modmail Quick User Summary](https://developers.reddit.com/apps/modmail-userinfo)) that you would prefer runs first.

# Putting it all together

Here are some example rules to provide some inspiration about what is possible.

## Responding to shadowbanned users

Here's an example rule that replies to a user who might be querying why their content isn't showing up. 

    ---
    body: [removed, hidden, shadowban, invisible, deleted]
    author:
        is_shadowbanned: true
    reply: |
        Thanks for writing in. Unfortunately, your account has been shadowbanned by Reddit admin. This is not something we have any control over. 

        Until this situation is resolved, your posts and comments will be invisible. You can [appeal your shadowban](https://reddit.com/appeal) or see /r/shadowban for more information about shadowbans.
    archive: true
    ---

## Responding to ban appeals from users who aren't banned.

Here's an example of a rule that checks for keywords relating to ban appeals, but for users who might not actually be banned (more common than I wish!). If the user isn't banned, they'll receive an auto response telling them so.

    ---
    subject: ["ban appeal", "why am i banned", "why banned"]
    author:
        is_banned: false
    reply: |
        Hi /u/{{author}},
        
        It looks like you're trying to appeal a ban from {{subreddit}}. You don't appear to be banned at the current time.
    archive: true
    ---

## Responding to comments appealing automod actions

For example, you might have an Automod rule that removes a comment and replies to the user explaining why the content was removed. I recommend that any rules that act on mod actions like removepost or removecomment use a very short `action_within` timespan to avoid responding to unrelated things. In this example, you might have a rule that removes links from social media platforms, with an action_reason that includes "social links filter".

    ---
    body: ["removed", "not showing", "deleted"]
    mod_action:
        moderator_name: "AutoModerator"
        mod_action_type: "removecomment"
        action_within: "15 minutes",
        action_reason: "social links filter"
    reply: | 
        Hi /u/{{author}},
        
        It looks like you're asking why your recent [{{mod_action_target_kind}}]({{mod_action_target_permalink}}) was removed. We don't allow links to social media on {{subreddit}} due to past abuse.
    archive: true
    ---

## As a spam filter

Some subreddits get a large amount of spam with predictable patterns that can be detected, that you may wish to simply keep out of view.

    ---
    subject: "opportunity"
    body_regex: "(?:badcryptoscamsite1.com|badcryptoscamsite2.com)"
    mute: 28
    archive: true
    ---

Note: any rules that mute should be used with caution, because they may stop legitimate users from getting in touch.

## As an autoresponder for a subreddit that is closed temporarily

Occasionally, subreddits will close temporarily such as in the wake of a major incident in a country-specific sub, but often modmail will be busy with join requests. You can use this app to respond to all modmail temporarily.

    ---
    author:
        is_contributor: false # Cannot be a join request if user's already approved
    reply: |
        Hi {{author}},

        Sorry, but {{subreddit}} is temporarily closed. We expect to reopen at 9am GMT on Monday and aren't accepting requests to join in the meantime.
    archive: true

# Limitations

Due to limitations in the Devvit API, I am currently unable to support the following:

* Whether the user's ban was temporary or permanent, what the ban reason was, or how long it has left to run
* Subreddit-specific comment or post karma

# Source code and licence

Modmail Automator is free and open source under the BSD three-clause licence. You can find it on Github [here](https://github.com/fsvreddit/automodmail).
