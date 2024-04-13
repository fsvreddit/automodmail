Like Automoderator, just for modmail. Allows sub mods to configure rules written in YAML to enable autoresponders, automate ban appeals and more. 

For full documentation, please see [this wiki page](https://www.reddit.com/r/fsvapps/wiki/auto-modmail).

Modmail Automator is open source. You can find it on Github [here](https://github.com/fsvreddit/automodmail).

## Version History

### v1.5

- Add `subject+body` check, as well as negated equivalent `~subject+body`
- Add `approve_user` action
- Add `is_reply` check, enabling rules that act on replies.
- Add `is_participant` check, enabling rules that only act on the user the modmail thread is about
- Add `still_in_queue` property to mod_action checks, allowing you to react differently depending on whether a matching item is currently modqueued or  not
- Add `{{mod_action_relative_time}}` placeholder for reply messages

### v1.4

- Adds ability to use modifiers such as regex, case_sensitive, includes etc. on `flair_text` and `flair_css_class` checks, as well as negated equivalents (`~flair_text`, `~flair_css_class`)
- Adds `rule_friendly_name` property to rules to allow easier reading of verbose output
- Fixes formatting issues if username or sub name contain markdown special characters

### v1.3

Bug fixes:
- Fixed ~body rule checks that were broken
- Fixed (includes-word) acting like (includes) was specified
- Add support for "addremovalreason" mod action types

### v1.2

- Exempts all admins from rules unless you specifically opt-in to it
- Allows both negated and positive checks on the same rule (e.g. subject: and ~subject:)
- Allows author ~name checks.
