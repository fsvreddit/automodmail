# Modmail Automator

Like AutoModerator, just for modmail.

This app allows subreddit moderators to define rules using YAML to autorespond to incoming modmails, and optionally archive the modmail afterwards. 

The intended use case in most cases is as a "first line" response to common questions, with users invited to reply and ask for more assistance if the autoresponder doesn't answer their question. By default, the app will only respond to the first modmail in the chain but rules can be authored to act on replies.

The app supports a wide variety of different checks on three main categories of data: The modmail itself (subject and body), account properties (including age and karma) and recent mod actions made against the user.

If you're familiar with AutoModerator, you'll be able to work with this tool.

## General principles

Like AutoModerator, more than one rule can be specified. If you have more than one rule, separate the rules with ---

Comments are supported. To make a comment on a rule, use a # symbol and anything from that point onwards on the line will be considered a comment.

Strings may be enclosed in quotes but this is not mandatory. So the following are all valid:

    subject: hello
    subject: 'hello'
    subject: "hello"

I personally recommend single quotes, especially where regexes are involved, unless the string you want has single quotes in it itself.

If you need a string to start with a > character, you must enclose it in quotes because > is a special character in YAML denoting the start of a multi-line string.

## Modmail properties

`is_reply` checks to see if the message is a reply or the original message, taking a value of true or false. If this is not entered, the rule will only act on the initial message. `is_first_user_reply` works similarly, but will only handle the first reply from the user that the modmail thread is about. This can be useful to allow autoresponses once but not indefinitely.

`subject` matches the subject of the incoming modmail, and performs a match on the term or terms included. Likewise `body` matches the body of the incoming modmail.

All four of these modmail properties checks can take a single value or an array of values. The following are all valid:

    subject: 'Ban appeal'

    body: ['shadowbanned', 'comments not showing']

    subject: 
        - shadowbanned
        - comments not showing

All four of these can also support negation e.g. `~subject`. If you use negation, then none of the search terms may match. You can use normal and negated properties together e.g. `body` and `~body` may appear in the same rule, but `body` cannot appear twice.

Like Automod, you can also use `subject+body`, `~subject+body`, `body+subject` or `~body+subject` to check both fields at the same time. For `subject+body`, a check passes if either subject or body match. for `~subject+body`, the check passes if neither matches.

'Body' refers to the message body of the latest message when is_reply is true.

### Modifiers

`subject` and `body` have optional modifiers to change how the text is matched. These are the same as AutoModerator minus full-text.

* `subject (includes)` will find the text anywhere - e.g. 'and' will match the subject 'sandwich'. This is the default behaviour if no modifier is used.
* `subject (includes-word)` will only match if the search term matches an entire word.
* `subject (starts-with)` will only match text at the start of the subject.
* `subject (ends-with)` will only match text at the start of the subject.
* `subject (full-exact)` will match the entire subject completely.
* `subject (regex)` will match using a regular expression. Unlike AutoModerator, this cannot be used in conjunction with one of the other modifiers above but it can be used with the case-sensitive modifier below. 

Note: This app uses Javascript regex syntax, not Python. Avoid using double quotes with regexes. Like AutoMod, The YAML parser that I am using does not handle \ escape characters well. Single quotes are preferred.

Additionally, you can specify case-sensitive searching (e.g. `body (includes-word, case-sensitive)`).

Previous versions of this app used different checks `subject_regex` and `body_regex` instead of modifiers. Old rules that use these will continue to work but I recommend moving to the new syntax.

## Account properties

Account properties come under the `author` value, just like in AutoModerator. Two broad categories (threshold checks and other account properties) are supported, and both can be specified in the same rule.

If a user is shadowbanned, most account checks cannot be performed - only the `name` and `is_shadowbanned` checks will work. A rule will always be skipped for shadowbanned users if other account checks are specified.

Author checks apply to the user that the modmail thread is about, not the person writing the modmail (in case of rules that can apply when a mod responds).

### Threshold checks

The tool supports four threshold checks: `post_karma`, `comment_karma`, `combined_karma` and `account_age`. Due to limitations of the Community Apps platform, it is not possible to include subreddit karma checks.

`post_karma`, `comment_karma`, `combined_karma` can have numeric comparators specified, not just exact values. For example, the following are all valid:

    author:
        post_karma: '< 100'
        comment_karma: '= 100'

`account age` additionally can include time units, with valid units being `minute`, `hour`, `day`, `week`, `month` and `year`. Time units can be singular or plural. Comparison operators supported are >, <, >= and <=. So the following are all valid:

    account_age: '< 1 year'

    account_age: '< 6 months'

    account_age: '> 2 week'

    account_age: '> 3 days'

Along with the four threshold checks, like AutoModerator this app supports the `satisfy_any_threshold` check. If `satisfy_any_threshold` is set to 'true', the rule will pass if any of the checks pass, but if it is set to 'false' then all must match e.g. this ruleset would pass if either the account age was under a year old, or the comment karma under 1000. If `satisfy_any_threshold` isn't specified, it defaults to false.

    author:
        account_age: '< 1 year'
        comment_karma: '< 1000'
        satisfy_any_threshold: 'true'

It is unlikely that '=' checks will be useful for many rules, especially for dates.

### Other account properties

The app supports several other properties about users.

`flair_text` and `flair_css_class` are simple text checks that match the user's flair text or CSS class similarly to other text matching rules. `~flair_text` and `~flair_css_class` are also supported:

    author:
        flair_text: 'Helpful'

    author:
        ~flair_text (regex): ['^verified', '^approved']

    author:
        flair_css_class (full-exact): 'bot'

There are also five true/false checks on account properties that may be useful: `is_participant`, `is_contributor`, `is_moderator`, `is_shadowbanned` and `is_banned`. E.g.

    author:
        is_banned: 'true'

The 'participant' is the user who the modmail thread is about. Most rules will never need to check this value, but it may be useful if you want to define rules that act on replies to previous modmails.

You can also check the account name. `name` matches the user name and supports the same modifiers as `subject` and `body` as mentioned above. For example:

    author:
        name: 'BadUser1234'

    author:
        ~name: ['BadUser1', 'BadUser2']

    author:
        name (regex, case-sensitive): '^ThrowRA'

Early versions of this app used a different check (`name_regex`) for regular expression searches. If you have this syntax is in any existing rules then these will continue to work but I recommend moving to the new syntax for simplicity.

## Mod Action checks

Sometimes users write in after an action has been taken against them. These checks allow you to autorespond if a user is writing in about a recent action. These come under the `mod_action` property.

Sub properties are:

`moderator_name`: the name (or names) of the moderator who took the action. This is case sensitive. 

`mod_action_type`: the type (or types) of mod action taken. This must be one of the following: 'banuser', 'unbanuser', 'spamlink', 'removelink', 'approvelink', 'spamcomment', 'removecomment', 'approvecomment', 'editflair', 'lock', 'unlock', 'muteuser', 'unmuteuser', 'addremovalreason'

`action_within`: The timeframe that the mod action was taken in relative to the date/time of the modmail. E.g. `action_within: 30 minutes`. Like account age, supported time units are `minute`, `hour`, `day`, `week`, `month` and `year`, with both singular and plural forms supported.

`action_reason`: Text to match against the action_reason, if one is set (e.g. on `removecomment` or `removepost` mod actions) e.g.

    action_reason: ['ban evasion', 'crowd control']

    action_reason (regex, case_sensitive): '^Match Day'

    action_reason: 'low karma'

`still_in_queue`: True or false. Checks to see if a post or comment matching the mod action is still in the mod queue.

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

## Subreddit checks

This app supports the `sub_visibility` check, with possible values 'public', 'private' and 'restricted'. You can use this to automate responses or approval processes on private or restricted subs, or to reply and archive when a subreddit is closed without having to comment out the rule every time a sub is closed or reopened.

## Actions to take

If all checks on a rule pass, there are a number of actions that can be taken: `reply`, `mute` and `archive`.

`reply` replies to the user with the text specified. The following formats are all supported:

    reply: 'Here's some text to reply with'
    
    reply: |
        Here's a multiline reply.

        Like AutoModerator, this format is supported too.

`private_reply` works similarly to `reply`, but leaves a private moderator note on the modmail rather than a public response. 

`mute` mutes the author from modmail, and should be used sparingly (such as on rules that are used as a spam filter of sorts). Takes a number between 1 and 28 for the number of dates to mute for e.g. `mute: 7`. Note: Due to an issue with the Community Apps platform, all mutes will be for three days until the issue is fixed.

`archive` archives the modmail after sending a reply. You cannot use `archive` without a `reply` or `mute`. E.g. `archive: 'true'`.

`unban` unbans the user (if they were already banned). E.g. `unban: 'true'`.

`approve_user` adds the user as an approved submitter (if they are not already one). E.g. `approve_user: 'true'`.

You can also set a flair by adding the `set_flair` property under the `author` attribute e.g.

    author:
        set_flair:
            override_flair: true
            set_flair_text: 'Authorised'
            set_flair_css_class: 'authorised'

Properties supported for set_flair also includes `set_flair_template_id`. If override_flair is false or missing, users with existing flair won't have a new flair set.

### Placeholders on replies

The following placeholders are all supported:

`{{author}}` - the username for the user writing in, without the leading /u/

`{{subreddit}}` - the subreddit the modmail was sent to.

`{{mod_action_timespan_to_now}}` - a human readable timespan for the length of time elapsed since the detected mod action. Example output formats can be seen [here](https://date-fns.org/docs/formatDistanceToNow) and the language used can be configured in the app settings from a list of the most commonly used languages on Reddit (list based mostly on [this research](https://towardsdatascience.com/the-most-popular-languages-on-reddit-analyzed-with-snowflake-and-a-java-udtf-4e58c8ba473c)). If you would like to request another language, please send a message to /u/fsv.

`{{mod_action_relative_time}}` - a human readable relative date in words. Example output formats can be seen [here](https://date-fns.org/v3.6.0/docs/formatRelative). Like `{{mod_action_timestamp_to_now}}`, the output is localised.

`{{mod_action_target_permalink}}` - the link to the post or comment (if applicable) that the mod action was taken against.

`{{mod_action_target_kind}}` - Either "post" or "comment". Like the timespan above, this will respect the language chosen. You can also choose your own terms for "post" and "comment" in the configuration options if you need to support further languages, or if you think a better translation could have been used (if you do have any suggestions on improving translations, please contact /u/fsv!)

The four mod_action placeholders will only work if a mod_action check is present in the rule. 

Matching placeholders are also supported and work exactly like Automod's.

* `{{match}}` will be substituted with the first found match from either the subject or body. `{{match-1}}` is equivalent.
* `{{match-subject}}`, `{{match-body}}`, `{{match-subject-1}}`, `{{match-body-1}}` will be substituted with the first found match from the respective part of the modmail message.
* `{{match-2}}`, `{{match-subject-2}}`, `{{match-body-2}}` for any number higher than 1 will return the capturing group for regex searches. E.g. `{{match-2}}` returns the first capturing group from either subject or body, `{{match-body-3}}` the second from the body, and so on.

Negated searches (e.g. ~subject) will not result in matching placeholder output.

## Debug options

If you add `verbose_logs: true` to any rule, the app will reply with a private mod note with information about why each check in a rule passed or failed. This can be useful when testing rules or trying to work out why a rule isn't working. I recommend only using this for short periods, maybe even just in test subreddits, because when any rule has verbose_logs turned on the app will respond to EVERY new modmail.

More than one rule can have verbose_logs enabled at a time, but it is generally going to be most useful to enable for a single rule at a time and only while testing it.

You can also set a friendly name on rules using `rule_friendly_name: 'Rule name of your choice'` to make verbose output more helpful.

## "Signoff" for responses

In the configuration screen, you can also specify a "signoff" footer to be included on all autoresponses. It's recommended that you include one of these and use it to make users aware that the response is automatic and that they can reply to get more information from a human.

The "signoff" can be suppressed for individual rules if desired by specifying `signoff: false` in a rule. If the `signoff` attribute is omitted from the rule, the "signoff" will be included unless the "omit for moderators" option applies. 

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
    subject+body: ['ban appeal', 'why am i banned', 'why banned']
    author:
        is_banned: false
    reply: |
        Hi /u/{{author}},
        
        It looks like you're trying to appeal a ban from {{subreddit}}. You don't appear to be banned at the current time.
    archive: true
    ---

## Responding to comments appealing automod actions

For example, you might have an Automod rule that removes a comment and replies to the user explaining why the content was removed. I recommend that any rules that act on mod actions like removepost or removecomment use a very short `action_within` timespan to avoid responding to unrelated things. In this example, you might have a rule that removes links from social media platforms, with an action_reason that includes 'social links filter'.

    ---
    body: ['removed', 'not showing', 'deleted']
    mod_action:
        moderator_name: 'AutoModerator'
        mod_action_type: ['removecomment', 'removelink']
        action_within: '15 minutes',
        action_reason: 'social links filter'
    reply: | 
        Hi /u/{{author}},
        
        It looks like you're asking why your recent [{{mod_action_target_kind}}]({{mod_action_target_permalink}}) was removed. We don't allow links to social media on {{subreddit}} due to past abuse.
    archive: true
    ---

## As a spam filter

Some subreddits get a large amount of spam with predictable patterns that can be detected, that you may wish to simply keep out of view.

    ---
    subject: 'opportunity'
    body (regex): '(?:badcryptoscamsite1.com|badcryptoscamsite2.com)'
    mute: 28
    archive: true
    ---

Note: any rules that mute should be used with caution, because they may stop legitimate users from getting in touch.

## As an autoresponder for a subreddit that is closed temporarily

Occasionally, subreddits will close temporarily such as in the wake of a major incident in a country-specific sub, but often modmail will be busy with join requests. You can use this app to respond to all modmail temporarily.

    ---
    author:
        is_contributor: false # Cannot be a join request if user's already approved
    sub_visibility: 'private'
    reply: |
        Hi {{author}},

        Sorry, but {{subreddit}} is temporarily closed. We expect to reopen at 9am GMT on Monday and aren't accepting requests to join in the meantime.
    archive: true

## As an enabler for mod macros

You can use the is_reply and is_moderator functions to enable mod macros. For example:

    ---
    is_reply: true
    body: '$$karma'
    author:
        is_moderator: true
    reply: 'Your karma is too low. Learn [here](url) how to raise it.'
    archive: true

For this kind of functionality, I recommend that the messages that would trigger these are sent as private moderator notes.

## To automate approvals to private subreddits

You could use sets of rules that work together to automate approving users into a private subreddit.

    ---
    author:
        is_contributor: false
        is_banned: false
    reply: |
        This sub is private but allows members to self-approve if they agree to the rules beforehand. 

        - Rule 1
        - Rule 2

        If you agree to follow these rules, please reply with '!agree'
    archive: true
    ---
    is_reply: true
    body: '!agree'
    author:
        is_participant: true
        is_contributor: false
        is_banned: false
    reply: 'Thank you for accepting our rules. You will now be made an approved contributor to {{subreddit}}.
    approve_user: true
    archive: true
    ---

## Auto-archiving "You are an approved user" notifications

    ---
    subject (full-exact): 'you are an approved user'
    body (starts-with): 'you have been added as an approved user to'
    is_reply: false
    author:
        is_moderator: true
    archive: true
    ---

## Responding to people querying why a filtered post or comment is not showing

    ---
    subject+body: ["not showing", "not appearing", "hidden", "removed", "shadowbanned", "shadow banned", "shadowban", "showing up", "deleted", "removal", "remove", "not showing", "botban", "automod", "visible"]
    mod_action:
        moderator_name: ["AutoModerator", "reddit"]
        mod_action_type: ["removelink", "removecomment"]
        action_within: "2 hours"
        still_in_queue: true
    reply: |
        Hi {{author}},
    
        It sounds like you're querying why your recent [{{mod_action_target_kind}}]({{mod_action_target_permalink}}) from {{mod_action_timespan_to_now}} ago is not showing.
    
        Your {{mod_action_target_kind}} was filtered by Reddit or our Automod filters, and is still in our queue for review. A mod will get to it in due course and either approve or remove it.
    archive: true
    ---

# Limitations

Due to limitations in the Devvit API, I am currently unable to support the following:

* Whether the user's ban was temporary or permanent, what the ban reason was, or how long it has left to run
* Subreddit-specific comment or post karma

# Source code and licence

Modmail Automator is free and open source under the BSD three-clause licence. You can find it on Github [here](https://github.com/fsvreddit/automodmail).
