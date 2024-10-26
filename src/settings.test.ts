import { AppSettingName, AppSettings } from "./settings.js";

test("Settings interface matches enum", () => {
    const enumValues = Object.values(AppSettingName) as string[];

    const object: AppSettings = {
        rules: "",
        backupToWikiPage: false,
        commentString: "",
        includeSignoffForMods: false,
        locale: [""],
        secondsDelayBeforeSend: 0,
        postString: "",
        signoff: "",
    };

    const interfaceKeys = Object.keys(object);

    console.log(enumValues, interfaceKeys);

    const mappings = interfaceKeys.map(key => ({ key, isMapped: enumValues.includes(key) }));
    const expected = interfaceKeys.map(key => ({ key, isMapped: true }));

    expect(enumValues.length).toEqual(interfaceKeys.length);
    expect(mappings).toEqual(expected);
});
