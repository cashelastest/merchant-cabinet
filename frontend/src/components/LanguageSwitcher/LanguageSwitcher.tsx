import { useTranslation } from 'react-i18next';
import styles from './LanguageSwitcher.module.css';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <select
      className={styles.select}
      value={i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
    >
      <option value="en">English</option>
      <option value="ru">Русский</option>
      <option value="uk">Українська</option>
    </select>
  );
}
