import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import client from '../../api/client';
import styles from './Settings.module.css';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [twoFAError, setTwoFAError] = useState<string | null>(null);
  const [twoFASuccess, setTwoFASuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await client.get('/auth/user-settings').then((r) => r.data);
      setApiKey(data.api_key || '');
      setIs2FAEnabled(data.is_2fa_enabled || false);
    } catch {
      console.error('Failed to load settings');
    }
  };

  const handleGenerateApiKey = async () => {
    if (!window.confirm('Are you sure? This will invalidate the current API key.')) return;

    setLoading(true);
    try {
      const data = await client.post('/auth/generate-api-key', {}).then((r) => r.data);
      setApiKey(data.api_key);
      alert('API key generated successfully!');
    } catch {
      alert('Failed to generate API key');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const handleEnable2FA = async () => {
    setTwoFALoading(true);
    setTwoFAError(null);
    try {
      const data = await client.post('/auth/2fa/setup', {}).then((r) => r.data);
      setQrCodeUrl(data.qr_code_url);
      setTotpSecret(data.secret);
      setShowSetup(true);
    } catch (error: any) {
      setTwoFAError(error.response?.data?.detail || 'Failed to setup 2FA');
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      setTwoFAError('Invalid code');
      return;
    }

    setTwoFALoading(true);
    setTwoFAError(null);
    try {
      await client.post('/auth/2fa/verify-setup', { code: verifyCode }).then((r) => r.data);
      setIs2FAEnabled(true);
      setShowSetup(false);
      setVerifyCode('');
      setQrCodeUrl('');
      setTotpSecret('');
      setTwoFASuccess('Two-factor authentication enabled!');
      setTimeout(() => setTwoFASuccess(null), 5000);
    } catch (error: any) {
      setTwoFAError(error.response?.data?.detail || 'Invalid code');
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      setTwoFAError('Invalid code');
      return;
    }

    setTwoFALoading(true);
    setTwoFAError(null);
    try {
      await client.post('/auth/2fa/disable', { code: verifyCode }).then((r) => r.data);
      setIs2FAEnabled(false);
      setVerifyCode('');
      setTwoFASuccess('Two-factor authentication disabled');
      setTimeout(() => setTwoFASuccess(null), 5000);
    } catch (error: any) {
      setTwoFAError(error.response?.data?.detail || 'Invalid code');
    } finally {
      setTwoFALoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>Настройки</div>

      <div className={styles.container}>
        <h1 className={styles.title}>Настройки аккаунта</h1>

        {/* API Key Section */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>API Ключ для создания заявок</h2>
          <p className={styles.sectionDescription}>
            Используйте этот ключ для создания заявок через API
          </p>

          <div className={styles.tokenBlock}>
            <div className={styles.tokenDisplay}>
              {showApiKey ? (
                <code className={styles.tokenValue}>{apiKey}</code>
              ) : (
                <code className={styles.tokenValue}>{'•'.repeat(32)}</code>
              )}
            </div>
            <div className={styles.tokenActions}>
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className={styles.btn}
              >
                {showApiKey ? 'Скрыть' : 'Показать'}
              </button>
              <button
                onClick={() => copyToClipboard(apiKey)}
                className={styles.btn}
              >
                Копировать
              </button>
              <button
                onClick={handleGenerateApiKey}
                disabled={loading}
                className={`${styles.btn} ${styles.btnDanger}`}
              >
                {loading ? 'Генерирую...' : 'Генерировать новый'}
              </button>
            </div>
          </div>
        </div>

        {/* 2FA Section */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Двухфакторная аутентификация</h2>
          <p className={styles.sectionDescription}>
            Добавьте дополнительный уровень защиты вашего аккаунта
          </p>

          {twoFAError && <div className={styles.error}>{twoFAError}</div>}
          {twoFASuccess && <div className={styles.success}>{twoFASuccess}</div>}

          <div className={styles.twoFAStatus}>
            <div className={styles.statusIndicator}>
              <div className={`${styles.statusDot} ${is2FAEnabled ? styles.enabled : styles.disabled}`} />
              <span className={styles.statusText}>
                {is2FAEnabled ? '2FA включена' : '2FA отключена'}
              </span>
            </div>

            {!showSetup && (
              <button
                onClick={() => is2FAEnabled ? handleDisable2FA : handleEnable2FA}
                disabled={twoFALoading}
                className={`${styles.btn} ${is2FAEnabled ? styles.btnDanger : ''}`}
              >
                {twoFALoading ? 'Загрузка...' : is2FAEnabled ? 'Отключить 2FA' : 'Включить 2FA'}
              </button>
            )}
          </div>

          {showSetup && qrCodeUrl && (
            <div className={styles.setupContainer}>
              <div className={styles.qrSection}>
                <h3>1. Сканируйте QR код</h3>
                <div className={styles.qrImage}>
                  <img src={qrCodeUrl} alt="QR Code" />
                </div>
                <p className={styles.instruction}>
                  Используйте приложение Google Authenticator, Authy или похожее
                </p>
              </div>

              <div className={styles.secretSection}>
                <h3>2. Или введите ключ вручную</h3>
                <code className={styles.secretValue}>{totpSecret}</code>
              </div>

              <div className={styles.verifySection}>
                <h3>3. Подтвердите код</h3>
                <input
                  type="text"
                  className={styles.codeInput}
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  disabled={twoFALoading}
                />
                <div className={styles.setupActions}>
                  <button
                    onClick={handleVerify2FA}
                    disabled={twoFALoading}
                    className={styles.btn}
                  >
                    {twoFALoading ? 'Проверяю...' : 'Подтвердить'}
                  </button>
                  <button
                    onClick={() => {
                      setShowSetup(false);
                      setVerifyCode('');
                      setQrCodeUrl('');
                      setTotpSecret('');
                      setTwoFAError(null);
                    }}
                    className={styles.btnSecondary}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}

          {showSetup && is2FAEnabled && (
            <div className={styles.disableContainer}>
              <h3>Отключить 2FA</h3>
              <p>Введите код из приложения аутентификации</p>
              <input
                type="text"
                className={styles.codeInput}
                placeholder="000000"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                disabled={twoFALoading}
              />
              <div className={styles.setupActions}>
                <button
                  onClick={handleDisable2FA}
                  disabled={twoFALoading}
                  className={`${styles.btn} ${styles.btnDanger}`}
                >
                  {twoFALoading ? 'Отключаю...' : 'Отключить'}
                </button>
                <button
                  onClick={() => setShowSetup(false)}
                  className={styles.btnSecondary}
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
