import {parseRules} from "./config.js";

test("Simple valid", () => {
    const input = `---
subject: [Foo]
mute: 28
---`;

    parseRules(input);
});

test("Both subject and subject_regex", () => {
    const input = `---
subject: [Foo]
subject_regex: [Bar]
mute: 28
---`;

    const t = () => {
        parseRules(input);
    };

    expect(t).toThrow();
});

test("Mute for noninteger duration", () => {
    const input = `---
subject: [Foo]
subject_regex: [Bar]
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
mute: 1.4
---`;

    const t = () => {
        parseRules(input);
    };

    expect(t).toThrow();
});

test("Valid regex", () => {
    const input = `---
subject_regex: ["abc[de]f"]
mute: 28
---`;

    parseRules(input);
});

test("Invalid regex", () => {
    const input = `---
subject_regex: ["abc[def"]
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
        expect(subject.length).toEqual(1);
        expect(subject[0]).toEqual("Hello");
    } else {
        throw "Didn't parse correctly.";
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

test("Real Mod Action", () => {
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
