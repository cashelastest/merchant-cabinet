import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import ru from './locales/ru.json';
import uk from './locales/uk.json';

const resources = { en: { translation: en }, ru: { translation: ru }, uk: { translation: uk } };

const savedLang = localStorage.getItem('preferredLanguage') || 'en';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('preferredLanguage', lng);
});

export default i18n;
