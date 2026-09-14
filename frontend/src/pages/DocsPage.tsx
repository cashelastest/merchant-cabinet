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
          Создаёт заявку и сразу отдаёт её подходящему мерчанту: она появляется в его
          кабинете в реальном времени, без перезагрузки страницы. Мерчант выполняет
          выплату по реквизитам из <code>to_values</code> и прикладывает чек.
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
          Сервер перебирает мерчантов по возрастанию их ID и отдаёт заявку первому,
          у кого <code>to_xml</code> есть в списке валют в настройках. Если такого
          мерчанта нет, заявка не создаётся и возвращается <code>404</code>.
        </p>
        <div className={styles.note}>
          Если одну и ту же валюту выплаты обслуживают несколько мерчантов, заявка
          всегда достаётся тому, у кого меньше ID.
        </div>

        <h2 id="statuses">Статусы заявок</h2>
        <table className={styles.table}>
          <thead>
            <tr><th>Статус</th><th>Описание</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>pending</code></td>
              <td>Заявка создана и ждёт, пока мерчант возьмёт её в работу. Значение для новых заявок.</td>
            </tr>
            <tr>
              <td><code>in_progress</code></td>
              <td>Мерчант принял заявку и выполняет выплату.</td>
            </tr>
            <tr>
              <td><code>accepted</code></td>
              <td>Выплата подтверждена мерчантом. Финальный статус, изменению не подлежит.</td>
            </tr>
            <tr>
              <td><code>refused</code></td>
              <td>Мерчант отказался от заявки. Финальный статус, изменению не подлежит.</td>
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
                недопустимый <code>status</code> или неразобранный <code>created_at</code>.
              </td>
            </tr>
          </tbody>
        </table>
      </main>
    </div>
  );
}
