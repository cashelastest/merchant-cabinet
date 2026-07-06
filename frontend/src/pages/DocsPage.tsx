import { useNavigate } from 'react-router-dom';
import styles from './DocsPage.module.css';

export default function DocsPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <div className={styles.nav}>
        <button onClick={() => navigate('/')} className={styles.backBtn}>← Back</button>
      </div>

      <article className={styles.article}>
        <h1>Creating a Deal</h1>

        <section>
          <h2>Overview</h2>
          <p>
            A deal represents a transaction request in the BPay Merchant Cabinet system. This endpoint allows you to create new deals that will be processed according to your business rules.
          </p>
        </section>

        <section>
          <h2>Endpoint</h2>
          <div className={styles.codeBlock}>
            <code>POST /api/v1/deals</code>
          </div>
        </section>

        <section>
          <h2>Authentication</h2>
          <p>
            This endpoint requires authentication using your API Key. Include your API Key in the X-API-Key header:
          </p>
          <div className={styles.codeBlock}>
            <code>X-API-Key: {'{your_api_key}'}</code>
          </div>
        </section>

        <section>
          <h2>Request Body</h2>
          <div className={styles.codeBlock}>
            <pre>{`{
  "uid": number,
  "secret": "string",
  "from_xml": "string",
  "from_name": "string",
  "from_image_url": "string",
  "to_xml": "string",
  "to_name": "string",
  "to_image_xml": "string",
  "status": "string",
  "created_at": "2026-07-06T10:30:00Z",
  "to_values": {
    "outAmount": number,
    "cardHolder": "string",
    "cardNumber": "string",
    "phoneNumber": "string",
    "bankName": "string",
    "country": "string"
  }
}`}</pre>
          </div>

          <h3>Parameters</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Type</th>
                <th>Required</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>uid</td>
                <td>number</td>
                <td>Yes</td>
                <td>Unique identifier for the deal</td>
              </tr>
              <tr>
                <td>secret</td>
                <td>string</td>
                <td>Yes</td>
                <td>Secret token for verification</td>
              </tr>
              <tr>
                <td>from_xml</td>
                <td>string</td>
                <td>Yes</td>
                <td>Source currency/method code (e.g., "USDT")</td>
              </tr>
              <tr>
                <td>from_name</td>
                <td>string</td>
                <td>Yes</td>
                <td>Display name of the source currency</td>
              </tr>
              <tr>
                <td>from_image_url</td>
                <td>string</td>
                <td>Yes</td>
                <td>URL to the source currency icon</td>
              </tr>
              <tr>
                <td>to_xml</td>
                <td>string</td>
                <td>Yes</td>
                <td>Destination currency/method code</td>
              </tr>
              <tr>
                <td>to_name</td>
                <td>string</td>
                <td>Yes</td>
                <td>Display name of the destination currency</td>
              </tr>
              <tr>
                <td>to_image_xml</td>
                <td>string</td>
                <td>Yes</td>
                <td>URL to the destination currency icon</td>
              </tr>
              <tr>
                <td>status</td>
                <td>string</td>
                <td>Yes</td>
                <td>Initial status of the deal (typically "pending")</td>
              </tr>
              <tr>
                <td>created_at</td>
                <td>string (ISO 8601)</td>
                <td>Yes</td>
                <td>Creation timestamp in ISO 8601 format</td>
              </tr>
              <tr>
                <td>to_values</td>
                <td>object</td>
                <td>Yes</td>
                <td>Transaction details (see table below)</td>
              </tr>
            </tbody>
          </table>

          <h3>to_values Parameters</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Type</th>
                <th>Required</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>outAmount</td>
                <td>number</td>
                <td>Yes</td>
                <td>Amount to be transferred</td>
              </tr>
              <tr>
                <td>cardHolder</td>
                <td>string</td>
                <td>No</td>
                <td>Name of the card holder</td>
              </tr>
              <tr>
                <td>cardNumber</td>
                <td>string</td>
                <td>No</td>
                <td>Card number (last 4 digits typically)</td>
              </tr>
              <tr>
                <td>phoneNumber</td>
                <td>string</td>
                <td>No</td>
                <td>Recipient's phone number</td>
              </tr>
              <tr>
                <td>bankName</td>
                <td>string</td>
                <td>No</td>
                <td>Name of the bank</td>
              </tr>
              <tr>
                <td>country</td>
                <td>string</td>
                <td>No</td>
                <td>Country code or name</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Example Request</h2>
          <div className={styles.codeBlock}>
            <pre>{`curl -X POST https://merchant.bpay-processing.com/api/v1/deal/ \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
  "uid": 12345,
  "secret": "your-secret-key",
  "from_xml": "USDT",
  "from_name": "USDT Tether",
  "from_image_url": "https://...",
  "to_xml": "UAH",
  "to_name": "Ukrainian Hryvnia",
  "to_image_xml": "https://...",
  "status": "pending",
  "created_at": "2026-07-06T10:30:00Z",
  "to_values": {
    "outAmount": 100.50,
    "cardHolder": "John Doe",
    "cardNumber": "1234",
    "phoneNumber": "+380991234567",
    "bankName": "PrivatBank",
    "country": "UA"
  }
}'`}</pre>
          </div>
        </section>

        <section>
          <h2>Response</h2>
          <p>On success, the API returns a 200 OK status with the deal ID:</p>
          <div className={styles.codeBlock}>
            <pre>{`{
  "id": 123
}`}</pre>
          </div>
        </section>

        <section>
          <h2>Status Codes</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>200</td>
                <td>Deal created successfully</td>
              </tr>
              <tr>
                <td>400</td>
                <td>Invalid request parameters</td>
              </tr>
              <tr>
                <td>401</td>
                <td>Unauthorized (missing or invalid API key)</td>
              </tr>
              <tr>
                <td>422</td>
                <td>Validation error</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Error Response</h2>
          <div className={styles.codeBlock}>
            <pre>{`{
  "detail": "Error message describing what went wrong"
}`}</pre>
          </div>
        </section>
      </article>
    </div>
  );
}
