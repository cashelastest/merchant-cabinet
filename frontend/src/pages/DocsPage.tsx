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
            This endpoint requires authentication using a Bearer token. Include your authentication token in the Authorization header:
          </p>
          <div className={styles.codeBlock}>
            <code>Authorization: Bearer {'{your_access_token}'}</code>
          </div>
        </section>

        <section>
          <h2>Request Body</h2>
          <div className={styles.codeBlock}>
            <pre>{`{
  "from_xml": "string",
  "to_xml": "string",
  "to_values": {
    "outAmount": number,
    "cardHolder": "string",
    "cardNumber": "string",
    "phoneNumber": "string",
    "bankName": "string",
    "country": "string",
    "usdtWallet": "string"
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
                <td>from_xml</td>
                <td>string</td>
                <td>Yes</td>
                <td>Source currency/method code (e.g., "USDT")</td>
              </tr>
              <tr>
                <td>to_xml</td>
                <td>string</td>
                <td>Yes</td>
                <td>Destination currency/method code</td>
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
              <tr>
                <td>usdtWallet</td>
                <td>string</td>
                <td>No</td>
                <td>USDT wallet address (TRC20)</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Example Request</h2>
          <div className={styles.codeBlock}>
            <pre>{`curl -X POST https://merchant.bpay-processing.com/api/v1/deals \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d {
  "from_xml": "USDT",
  "to_xml": "UAH",
  "to_values": {
    "outAmount": 100.50,
    "cardHolder": "John Doe",
    "cardNumber": "1234",
    "phoneNumber": "+380991234567",
    "bankName": "PrivatBank",
    "country": "UA"
  }
}`}</pre>
          </div>
        </section>

        <section>
          <h2>Response</h2>
          <p>On success, the API returns a 201 Created status with the created deal details:</p>
          <div className={styles.codeBlock}>
            <pre>{`{
  "id": 123,
  "uid": "unique-deal-id",
  "from_xml": "USDT",
  "to_xml": "UAH",
  "from_name": "USDT Tether",
  "to_name": "Ukrainian Hryvnia",
  "to_values": {
    "outAmount": 100.50,
    "cardHolder": "John Doe",
    "cardNumber": "1234",
    "phoneNumber": "+380991234567",
    "bankName": "PrivatBank",
    "country": "UA"
  },
  "status": "pending",
  "created_at": "2026-07-06T10:30:00Z",
  "accepted_by": null,
  "accepted_at": null,
  "received_at": null
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
                <td>201</td>
                <td>Deal created successfully</td>
              </tr>
              <tr>
                <td>400</td>
                <td>Invalid request parameters</td>
              </tr>
              <tr>
                <td>401</td>
                <td>Unauthorized (missing or invalid token)</td>
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
