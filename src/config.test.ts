import {parseRules} from "./config.js";

test("Simple valid", () => {
    const input = `---
subject: [Foo]
mute: 28
---`;

    parseRules(input);
});

test("Mute for noninteger duration", () => {
    const input = `---
subject: [Foo]
mute: 1.4
---`;

    const t = () => {
        parseRules(input);
    };

    expect(t).toThrow();
});

test("Nonexistent test", () => {
    const input = `---
subject: [Foo]
subreddit_name: testsub
mute: 3
---`;

    const t = () => {
        parseRules(input);
    };

    expect(t).toThrow();
});

test("Valid regex", () => {
    const input = `---
subject (regex): ["abc[de]f"]
mute: 28
---`;

    parseRules(input);
});

test("Invalid regex", () => {
    const input = `---
subject (regex): ["abc[def"]
mute: 28
---`;

    const t = () => {
        parseRules(input);
    };

    expect(t).toThrow();
});

test("String not array of string works due to type coercion", () => {
    const input = `---
subject: Hello
mute: 28
---`;

    const rules = parseRules(input);
    const subject = rules[0].subject;
    if (subject) {
        expect(subject).toHaveLength(1);
        expect(subject[0]).toEqual("Hello");
    } else {
        throw new Error("Didn't parse correctly.");
    }
});

test("Numeric comparator valid", () => {
    const input = `---
subject: Hello
author:
    post_karma: "> 100"
mute: 28
---`;

    parseRules(input);
});

test("Numeric comparator invalid", () => {
    const input = `---
subject: Hello
author:
    post_karma: "> banana"
mute: 28
---`;

    const t = () => {
        parseRules(input);
    };

    expect(t).toThrow();
});

test("Date comparator valid", () => {
    const input = `---
subject: Hello
author:
    account_age: "15 minutes"
mute: 28
---`;

    parseRules(input);
});

test("Date comparator invalid", () => {
    const input = `---
subject: Hello
author:
    account_age: "15 minues"
mute: 28
---`;

    const t = () => {
        parseRules(input);
    };

    expect(t).toThrow();
});

test("Real Mod Action", () => {
    const input = `---
subject: Hello
mod_action:
    mod_action_type: "banuser"
    action_within: "15 minutes"
mute: 28
---`;

    parseRules(input);
});

test("Nonexistent Mod Action", () => {
    const input = `---
subject: Hello
mod_action:
    mod_action_type: "huguser"
    action_within: "15 minutes"
mute: 28
---`;

    const t = () => {
        parseRules(input);
    };

    expect(t).toThrow();
});

test("Negated subject", () => {
    const input = `---
~subject: Hello
mod_action:
    mod_action_type: "banuser"
    action_within: "15 minutes"
mute: 28
---`;

    const rules = parseRules(input);
    expect(rules[0].notsubject).toBeDefined();
    expect(rules[0].notsubject_options).toBeDefined();
    expect(rules[0].notsubject_options?.negate).toBeTruthy();
});

test("Negated invalid check on rule", () => {
    const input = `---
subject: Hello
mod_action:
    ~mod_action_type: "banuser"
    action_within: "15 minutes"
mute: 28
---`;

    const t = () => {
        parseRules(input);
    };

    expect(t).toThrow();
});

test("Comments handled properly", () => {
    const input = `---
subject: Hello # This is a comment and shouldn't show.
mute: 28
---`;

    const rules = parseRules(input);
    expect(rules[0].subject).toEqual(["Hello"]);
});

test("Search Options (subject)", () => {
    const input = `---
subject (regex): Hello
mute: 28
---`;

    const rules = parseRules(input);
    expect(rules[0].subject).toEqual(["Hello"]);
    expect(rules[0].subject_options).toBeDefined();
    expect(rules[0].subject_options?.search_method === "regex");
    expect(rules[0].subject_options?.negate === false);
    expect(rules[0].subject_options?.case_sensitive === false);
});

test("Search Options (body)", () => {
    const input = `---
body (full-exact, case_sensitive): Hello
mute: 28
---`;

    const rules = parseRules(input);
    expect(rules[0].body).toBeDefined();
    expect(rules[0].body).toEqual(["Hello"]);
    expect(rules[0].body_options).toBeDefined();
    expect(rules[0].body_options?.search_method === "full-exact");
    expect(rules[0].body_options?.negate === false);
    expect(rules[0].body_options?.case_sensitive === true);
});

test("Invalid search option", () => {
    const input = `---
body (reverse-order): Hello
mute: 28
---`;

    const t = () => {
        parseRules(input);
    };

    expect(t).toThrow();
});

test("Legacy name regex", () => {
    const input = `---
subject: Hello
author:
    name_regex: "steve"
mute: 28
---`;

    const rules = parseRules(input);

    expect(rules[0].author).toBeDefined();
    expect(rules[0].author?.name_options).toBeDefined();
    expect(rules[0].author?.name_options?.search_method).toEqual("regex");
});

test("New name regex", () => {
    const input = `---
subject: Hello
author:
    name (regex): "steve"
mute: 28
---`;

    const rules = parseRules(input);

    expect(rules[0].author).toBeDefined();
    expect(rules[0].author?.name_options).toBeDefined();
    expect(rules[0].author?.name_options?.search_method).toEqual("regex");
});

test("Negated name", () => {
    const input = `---
subject: Hello
author:
    ~name: "spez"
mute: 28
---`;

    const rules = parseRules(input);

    expect(rules[0].author).toBeDefined();
    expect(rules[0].author?.notname).toEqual(["spez"]);
    expect(rules[0].author?.notname_options).toBeDefined();
    expect(rules[0].author?.notname_options?.negate).toBeTruthy();
});

test("Both subject and ~subject", () => {
    const input = `---
subject: Hello
~subject: Goodbye
mute: 28
---`;

    const rules = parseRules(input);

    expect(rules[0].subject).toEqual(["Hello"]);
    expect(rules[0].subject_options?.negate).toBeFalsy();
    expect(rules[0].notsubject).toEqual(["Goodbye"]);
    expect(rules[0].notsubject_options?.negate).toBeTruthy();
});

test("Both body and ~body", () => {
    const input = `---
body: Hello
~body: Goodbye
mute: 28
---`;

    const rules = parseRules(input);

    expect(rules[0].body).toEqual(["Hello"]);
    expect(rules[0].body_options?.negate).toBeFalsy();
    expect(rules[0].notbody).toEqual(["Goodbye"]);
    expect(rules[0].notbody_options?.negate).toBeTruthy();
});

test("Both author name and ~name", () => {
    const input = `---
author:
    name: "spez"
    ~name: "PossibleCrit"
mute: 28
---`;

    const rules = parseRules(input);

    expect(rules[0].author).toBeDefined();
    expect(rules[0].author?.name).toEqual(["spez"]);
    expect(rules[0].author?.name_options?.negate).toBeFalsy();
    expect(rules[0].author?.notname).toEqual(["PossibleCrit"]);
    expect(rules[0].author?.notname_options?.negate).toBeTruthy();
});

test("Set Flair", () => {
    const input = `---
author:
    name: "spez"
    set_flair:
        override_flair: true
        set_flair_text: "flairy flair"
        set_flair_css_class: "user"
mute: 28
---`;

    const rules = parseRules(input);
    expect(rules[0].author).toBeDefined();
    expect(rules[0].author?.set_flair).toBeDefined();
    expect(rules[0].author?.set_flair?.set_flair_text).toEqual("flairy flair");
    expect(rules[0].author?.set_flair?.set_flair_css_class).toEqual("user");
});

test("Action reason with options subject", () => {
    const input = `---
subject: Removed
mod_action:
    moderator_name: "AutoModerator"
    mod_action_type: "removecomment"
    action_reason (regex): "^Match Thread -"
    action_within: "15 minutes"
mute: 28
---`;

    const rules = parseRules(input);
    expect(rules[0].mod_action).toBeDefined();
    expect(rules[0].mod_action?.action_reason).toBeDefined();
    expect(rules[0].mod_action?.action_reason).toEqual(["^Match Thread -"]);
    expect(rules[0].mod_action?.action_reason_options).toBeDefined();
    expect(rules[0].mod_action?.action_reason_options?.search_method).toEqual("regex");
});
