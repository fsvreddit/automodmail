## Release History

### v1.9

- Add `sub_visibility` check, allowing rules to act based on whether the sub is public or private
- Allow more than one `mod_action_type` to be specified on the same rule
- Fix behaviour of `is_moderator` for mods without modmail permission
- Fix bug which prevents placeholders from being applied to user flairs
- Add `private_reply` action type

### v1.8

- Supports {{match}} placeholders on replies and when setting user flair
- Fixed a bug that prevents flairs from being set when override_flair is not specified.

### v1.7

- Supports modifiers (includes, regex, etc.) on action_reason
- New function to back up rules to a wiki page to allow history to be maintained
- Allow archive: true to be the only option on outgoing rules by moderators
- Allow rules to be run on first outgoing message

### v1.6

- Fixed a bug that meant rules with author checks would incorrectly match on shadowbanned users
- New checks: `body_shorter_than`, `body_longer_than`, `subject_shorter_than`, `subject_longer_than`.
- New action: `set_flair`.

### v1.5

- Add `subject+body` check, as well as negated equivalent `~subject+body`
- Add `approve_user` action
- Add `is_reply` and `is_first_user_reply` checks, enabling rules that act on replies.
- Add `is_participant` check, enabling rules that only act on the user the modmail thread is about
- Add `still_in_queue` property to mod_action checks, allowing you to react differently depending on whether a matching item is currently modqueued or not
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
