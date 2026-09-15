import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './DocsPage.module.css';

const BASE_URL = 'https://merchant.bpay-processing.com/api/v1';

const CURL_EXAMPLE = `curl -X POST ${BASE_URL}/deal/ \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
  "uid": 100234,
  "secret": "your-secret-key",
  "to_values": {
    "cardHolder": "OLEKSANDR KOVALENKO",
    "cardNumber": "4149 6090 1234 5678",
    "phoneNumber": "+380 67 123-45-67",
    "bankName": "PrivatBank",
    "outAmount": 15750.50
  },
  "to_xml": "UAH",
  "rate": 41.25,
  "status": "pending",
  "created_at": "2026-09-10T10:30:00"
}'`;

const RESPONSE_EXAMPLE = `{
  "id": 174
}`;

const ERROR_EXAMPLE = `{
  "detail": "No user found for payout currency UAH"
}`;

function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (insecure context) — the text stays selectable
    }
  };

  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span>{label}</span>
        <button className={styles.copyBtn} onClick={copy}>
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
      <pre>{code}</pre>
    </div>
  );
}

export default function DocsPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>BPay <span>Merchant</span></div>
        <nav>
          <div className={styles.navGroupTitle}>Начало работы</div>
          <a href="#overview">Обзор</a>
          <a href="#auth">Аутентификация</a>

          <div className={styles.navGroupTitle}>Эндпоинты</div>
          <a href="#create">Создание заявки на выплату</a>

          <div className={styles.navGroupTitle}>Справочник</div>
          <a href="#routing">Подбор мерчанта</a>
          <a href="#statuses">Статусы заявок</a>
          <a href="#errors">Коды ошибок</a>
        </nav>
        <button className={styles.backBtn} onClick={() => navigate('/')}>
          ← В кабинет
        </button>
      </aside>

      <main className={styles.main}>
        <h1 id="overview">BPay Merchant API</h1>
        <p className={styles.introDesc}>
          REST API для передачи заявок на выплату в кабинет мерчанта.
          Все запросы и ответы — в формате JSON, кодировка UTF-8.
        </p>

        <h3>Base URL</h3>
        <div className={styles.baseUrl}>{BASE_URL}</div>

        <h2 id="auth">Аутентификация</h2>
        <p>
          Запросы к API подписываются ключом в заголовке <code>X-API-Key</code>.
        </p>
        <table className={styles.table}>
          <thead>
            <tr><th>Тип</th><th>Заголовок</th><th>Где получить</th><th>Используется для</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>API-ключ</td>
              <td><code>X-API-Key: &lt;key&gt;</code></td>
              <td>Кабинет → Настройки → раздел «API»</td>
              <td>Создание заявок на выплату</td>
            </tr>
          </tbody>
        </table>
        <div className={styles.note}>
          Ключ аутентифицирует только вызывающую сторону. На то, какому мерчанту достанется
          заявка, он не влияет — это решает валюта выплаты, см. раздел{' '}
          <a href="#routing" style={{ color: '#4a9eff' }}>Подбор мерчанта</a>.
          Ключ можно перевыпустить в настройках; старый при этом сразу перестаёт работать.
        </div>

        <h2 id="create">Создание заявки на выплату</h2>
        <p>
          Создаёт заявку и сразу показывает её всем мерчантам, которые выплачивают в
          этой валюте: она появляется в их кабинетах в реальном времени, без
          перезагрузки страницы. Заявку забирает тот, кто первым возьмёт её в работу;
          он выполняет выплату по реквизитам из <code>to_values</code> и прикладывает чек.
        </p>

        <div className={styles.endpoint}>
          <div className={styles.endpointHeader}>
            <span className={styles.badgePost}>POST</span>
            <span className={styles.endpointPath}>/deal/</span>
            <span className={styles.badgeAuth}>🔑 X-API-Key</span>
          </div>
          <div className={styles.endpointBody}>
            <h3>Заголовки</h3>
            <table className={styles.table}>
              <thead>
                <tr><th>Заголовок</th><th>Значение</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>X-API-Key</code><span className={styles.required}>required</span></td>
                  <td>API-ключ мерчанта</td>
                </tr>
                <tr>
                  <td><code>Content-Type</code><span className={styles.required}>required</span></td>
                  <td><code>application/json</code></td>
                </tr>
              </tbody>
            </table>

            <h3>Тело запроса</h3>
            <table className={styles.table}>
              <thead>
                <tr><th>Поле</th><th>Тип</th><th>Описание</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>uid</code><span className={styles.required}>required</span></td>
                  <td className={styles.type}>integer</td>
                  <td>Идентификатор заявки во внешней системе. Уникальность не проверяется.</td>
                </tr>
                <tr>
                  <td><code>secret</code><span className={styles.required}>required</span></td>
                  <td className={styles.type}>string</td>
                  <td>Секрет заявки. Сохраняется вместе с ней.</td>
                </tr>
                <tr>
                  <td><code>to_values</code><span className={styles.required}>required</span></td>
                  <td className={styles.type}>object</td>
                  <td>Реквизиты получателя и сумма выплаты. Состав — в таблице ниже.</td>
                </tr>
                <tr>
                  <td><code>to_xml</code><span className={styles.required}>required</span></td>
                  <td className={styles.type}>string</td>
                  <td>
                    <strong>Валюта выплаты.</strong> По ней подбирается мерчант — значение
                    должно совпадать с валютой в его настройках. Например <code>UAH</code>.
                  </td>
                </tr>
                <tr>
                  <td><code>rate</code><span className={styles.required}>required</span></td>
                  <td className={styles.type}>number</td>
                  <td>
                    Курс: сколько единиц валюты выплаты <code>to_xml</code> даётся за 1 USDT.
                    Например, при выплате в гривне — <code>41.25</code>, при выплате в USDT — <code>1</code>.
                    Больше нуля; хранится с точностью до 8 знаков после запятой, лишние знаки округляются.
                  </td>
                </tr>
                <tr>
                  <td><code>status</code><span className={styles.required}>required</span></td>
                  <td className={styles.type}>string</td>
                  <td>
                    Начальный статус. Для новой заявки — <code>pending</code>.
                    Допустимые значения перечислены в разделе «Статусы заявок».
                  </td>
                </tr>
                <tr>
                  <td><code>created_at</code><span className={styles.required}>required</span></td>
                  <td className={styles.type}>string</td>
                  <td>
                    Время создания в ISO 8601 без таймзоны: <code>YYYY-MM-DDTHH:MM:SS</code>.
                    Трактуется как UTC.
                  </td>
                </tr>
                <tr>
                  <td><code>user_id</code><span className={styles.optional}>optional</span></td>
                  <td className={styles.type}>integer | null</td>
                  <td>Игнорируется: мерчант определяется сервером по <code>to_xml</code>.</td>
                </tr>
              </tbody>
            </table>

            <h3>Состав to_values</h3>
            <table className={styles.table}>
              <thead>
                <tr><th>Ключ</th><th>Тип</th><th>Описание</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>outAmount</code></td>
                  <td className={styles.type}>number</td>
                  <td>Сумма к выплате в валюте <code>to_xml</code>.</td>
                </tr>
                <tr>
                  <td><code>cardHolder</code></td>
                  <td className={styles.type}>string</td>
                  <td>Держатель карты.</td>
                </tr>
                <tr>
                  <td><code>cardNumber</code></td>
                  <td className={styles.type}>string</td>
                  <td>Номер карты получателя.</td>
                </tr>
                <tr>
                  <td><code>phoneNumber</code></td>
                  <td className={styles.type}>string</td>
                  <td>Телефон получателя.</td>
                </tr>
                <tr>
                  <td><code>bankName</code></td>
                  <td className={styles.type}>string</td>
                  <td>Банк получателя.</td>
                </tr>
              </tbody>
            </table>
            <div className={styles.note}>
              Объект <code>to_values</code> принимается целиком и произвольные
              дополнительные ключи не отклоняются, но в кабинете мерчанта отображаются
              только перечисленные выше.
            </div>

            <h3>Пример запроса</h3>
            <CodeBlock label="cURL" code={CURL_EXAMPLE} />

            <h3>Пример успешного ответа</h3>
            <p><span className={styles.statusOk}>200 OK</span></p>
            <CodeBlock label="JSON" code={RESPONSE_EXAMPLE} />

            <h3>Поля ответа</h3>
            <table className={styles.table}>
              <thead>
                <tr><th>Поле</th><th>Тип</th><th>Описание</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>id</code></td>
                  <td className={styles.type}>integer</td>
                  <td>Идентификатор созданной заявки в кабинете.</td>
                </tr>
              </tbody>
            </table>

            <h3>Пример ошибки</h3>
            <CodeBlock label="JSON" code={ERROR_EXAMPLE} />
          </div>
        </div>

        <h2 id="routing">Подбор мерчанта</h2>
        <p>
          Кабинет работает на выплату, поэтому заявка адресуется по валюте, которую
          мерчант выплачивает, — по полю <code>to_xml</code>.
        </p>
        <p>
          Новая заявка сразу видна всем мерчантам, у которых <code>to_xml</code> есть в
          списке валют в настройках. Забирает её тот, кто первым возьмёт в работу, — у
          остальных она в этот момент пропадает. Если ни у одного мерчанта нет такой
          валюты, заявка не создаётся и возвращается <code>404</code>.
        </p>
        <p>
          Мерчант может отказаться от заявки. Отказ скрывает её только у этого мерчанта:
          для остальных она остаётся доступной, а статус заявки не меняется. Если
          отказывается мерчант, который уже взял заявку в работу, она возвращается в
          статус <code>pending</code> и снова становится доступной другим мерчантам —
          кроме случая, когда к ней уже приложен чек.
        </p>
        <div className={styles.note}>
          Ответ с <code>id</code> означает, что заявка принята в кабинет, а не что её уже
          взял мерчант: до этого она находится в статусе <code>pending</code>. Если от
          заявки отказались все подходящие мерчанты, она так и остаётся в <code>pending</code>.
        </div>

        <h2 id="statuses">Статусы заявок</h2>
        <table className={styles.table}>
          <thead>
            <tr><th>Статус</th><th>Описание</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>pending</code></td>
              <td>
                Заявка ждёт, пока её возьмёт кто-то из мерчантов. Значение для новых заявок;
                сюда же заявка возвращается, если взявший её мерчант от неё отказался.
              </td>
            </tr>
            <tr>
              <td><code>in_progress</code></td>
              <td>Мерчант взял заявку и выполняет выплату. У остальных мерчантов она больше не видна.</td>
            </tr>
            <tr>
              <td><code>accepted</code></td>
              <td>Выплата подтверждена мерчантом. Финальный статус, изменению не подлежит.</td>
            </tr>
            <tr>
              <td><code>refused</code></td>
              <td>
                Заявка закрыта администратором. Отказ отдельного мерчанта этот статус не ставит —
                он только скрывает заявку у этого мерчанта. Финальный статус.
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          При создании заявки допускается любое из этих значений, но обрабатывать
          в кабинете можно только заявки, созданные со статусом <code>pending</code>.
          Значение вне списка отклоняется с кодом <code>422</code>.
        </p>

        <h2 id="errors">Коды ошибок</h2>
        <table className={styles.table}>
          <thead>
            <tr><th>Код</th><th>Причина</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>200</code></td>
              <td>Заявка создана, в ответе её <code>id</code>.</td>
            </tr>
            <tr>
              <td><code>401</code></td>
              <td>
                Заголовок <code>X-API-Key</code> отсутствует или ключ недействителен.
                Заявка не создана.
              </td>
            </tr>
            <tr>
              <td><code>404</code></td>
              <td>
                Не найден мерчант с валютой выплаты из <code>to_xml</code>.
                Заявка не создана.
              </td>
            </tr>
            <tr>
              <td><code>422</code></td>
              <td>
                Ошибка валидации: отсутствует обязательное поле, неверный тип,
                недопустимый <code>status</code>, <code>rate</code> не больше нуля
                или неразобранный <code>created_at</code>.
              </td>
            </tr>
          </tbody>
        </table>
      </main>
    </div>
  );
}
