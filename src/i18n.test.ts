import {localeFromString} from "./i18n.js";

test("Error occurs when invalid language code passed", () => {
    const t = () => {
        localeFromString("blah");
    };

    expect(t).toThrow("Language code blah not supported");
});
