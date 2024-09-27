import {Locale} from "date-fns";
import {enUS, enGB, es, fr, pt, ro, it, de, tr, nl, da, sv, fi, pl, ru, hr, nb} from "date-fns/locale";

export interface Language {
    languageName: string,
    isoCode: string,
    locale: Locale,
    postWord: string,
    commentWord: string,
}

export const languageList: Language[] = [
    {languageName: "English (US)", isoCode: "en", locale: enUS, postWord: "post", commentWord: "comment"},
    {languageName: "English (UK)", isoCode: "enGB", locale: enGB, postWord: "post", commentWord: "comment"},
    {languageName: "dansk", isoCode: "da", locale: da, postWord: "indlæg", commentWord: "kommentar"},
    {languageName: "Deutsch", isoCode: "de", locale: de, postWord: "Beitrag", commentWord: "Kommentar"},
    {languageName: "español", isoCode: "es", locale: es, postWord: "publicación", commentWord: "comentario"},
    {languageName: "suomi", isoCode: "fi", locale: fi, postWord: "viesti", commentWord: "kommentti"},
    {languageName: "français", isoCode: "fr", locale: fr, postWord: "post", commentWord: "commentaire"},
    {languageName: "hrvatski", isoCode: "hr", locale: hr, postWord: "objava", commentWord: "komentar"},
    {languageName: "italiano", isoCode: "it", locale: it, postWord: "post", commentWord: "inviato"},
    {languageName: "Nederlands", isoCode: "nl", locale: nl, postWord: "post", commentWord: "reactie"},
    {languageName: "Bokmål", isoCode: "nb", locale: nb, postWord: "post", commentWord: "kommentar"},
    {languageName: "polski", isoCode: "pl", locale: pl, postWord: "post", commentWord: "komentarz"},
    {languageName: "português", isoCode: "pt", locale: pt, postWord: "post", commentWord: "comentário"},
    {languageName: "română", isoCode: "ro", locale: ro, postWord: "post", commentWord: "comentariu"},
    {languageName: "русский", isoCode: "ru", locale: ru, postWord: "пост", commentWord: "комментарий"},
    {languageName: "Svenska", isoCode: "sv", locale: sv, postWord: "inlägg", commentWord: "kommentar"},
    {languageName: "Türkçe", isoCode: "tr", locale: tr, postWord: "gönder", commentWord: "yorum"},
];

/**
 * Converts an ISO language code to the corresponding date-fns locale object for supported languages.
 * @param localeString The ISO country code
 * @returns A date-fns Locale object
 */
export function languageFromString (localeString: string): Language {
    const language = languageList.find(language => language.isoCode === localeString);
    if (language) {
        return language;
    } else {
        throw new Error(`Language code ${localeString} not supported`);
    }
}
