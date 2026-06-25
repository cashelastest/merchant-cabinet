import { useTranslation } from 'react-i18next';
import styles from './LanguageSwitcher.module.css';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'ru', label: 'Русский' },
    { code: 'uk', label: 'Українська' },
  ];

  return (
    <div className={styles.switcher}>
      {languages.map((lang) => (
        <button
          key={lang.code}
          className={`${styles.btn} ${i18n.language === lang.code ? styles.active : ''}`}
          onClick={() => i18n.changeLanguage(lang.code)}
          title={lang.label}
        >
          {lang.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
