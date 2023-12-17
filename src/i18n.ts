import {Locale} from "date-fns";
import {enUS, es, fr, pt, ro, it, de, tr, nl, da, sv, fi, pl, ru, hr, nb} from "date-fns/locale";

interface Language {
    languageName: string,
    isoCode: string,
    locale: Locale,
}

export const languageList: Language[] = [
    {languageName: "English", isoCode: "en", locale: enUS},
    {languageName: "dansk", isoCode: "da", locale: da},
    {languageName: "Deutsch", isoCode: "de", locale: de},
    {languageName: "español", isoCode: "es", locale: es},
    {languageName: "suomi", isoCode: "fi", locale: fi},
    {languageName: "français", isoCode: "fr", locale: fr},
    {languageName: "hrvatski", isoCode: "hr", locale: hr},
    {languageName: "italiano", isoCode: "it", locale: it},
    {languageName: "Nederlands", isoCode: "nl", locale: nl},
    {languageName: "Bokmål", isoCode: "nb", locale: nb},
    {languageName: "polski", isoCode: "pl", locale: pl},
    {languageName: "português", isoCode: "pt", locale: pt},
    {languageName: "română", isoCode: "ro", locale: ro},
    {languageName: "русский", isoCode: "ru", locale: ru},
    {languageName: "Svenska", isoCode: "sv", locale: sv},
    {languageName: "Türkçe", isoCode: "tr", locale: tr},
];

export function localeFromString (localeString: string): Locale {
    const language = languageList.find(language => language.isoCode === localeString);
    if (language) {
        return language.locale;
    } else {
        throw `Language code ${localeString} not supported`;
    }
}
