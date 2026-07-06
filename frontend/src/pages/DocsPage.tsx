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
        <h1>Creating a Payout Request</h1>

        <section>
          <h2>Overview</h2>
          <p>
            A payout request represents a withdrawal transaction in the BPay Merchant Cabinet system. This endpoint allows you to create new payout requests with recipient bank details.
          </p>
        </section>

        <section>
          <h2>Endpoint</h2>
          <div className={styles.codeBlock}>
            <code>POST /api/v1/payout/</code>
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
  "amount": 150.00,
  "currency": "USD",
  "card_holder": "Test User",
  "card_number": "5555555555554444",
  "phone_number": "+1234567890",
  "bank_name": "Test Bank"
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
                <td>amount</td>
                <td>decimal</td>
                <td>Yes</td>
                <td>Amount to withdraw (must be positive)</td>
              </tr>
              <tr>
                <td>currency</td>
                <td>string</td>
                <td>Yes</td>
                <td>Currency code (e.g., "USD", "USDT", "EUR")</td>
              </tr>
              <tr>
                <td>card_holder</td>
                <td>string</td>
                <td>No</td>
                <td>Name of the card holder</td>
              </tr>
              <tr>
                <td>card_number</td>
                <td>string</td>
                <td>No</td>
                <td>Bank card number</td>
              </tr>
              <tr>
                <td>phone_number</td>
                <td>string</td>
                <td>No</td>
                <td>Recipient's phone number</td>
              </tr>
              <tr>
                <td>bank_name</td>
                <td>string</td>
                <td>No</td>
                <td>Name of the recipient's bank</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Example Request</h2>
          <div className={styles.codeBlock}>
            <pre>{`curl -X POST https://merchant.bpay-processing.com/api/v1/payout/ \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
  "amount": 150.00,
  "currency": "USD",
  "card_holder": "Test User",
  "card_number": "5555555555554444",
  "phone_number": "+1234567890",
  "bank_name": "Test Bank"
}'`}</pre>
          </div>
        </section>

        <section>
          <h2>Response</h2>
          <p>On success, the API returns a 200 OK status with the created payout details:</p>
          <div className={styles.codeBlock}>
            <pre>{`{
  "id": 42,
  "amount": 150.0,
  "currency": "USD",
  "card_holder": "Test User",
  "card_number": "5555555555554444",
  "phone_number": "+1234567890",
  "bank_name": "Test Bank",
  "receipt_url": null,
  "status": "pending",
  "created_at": "2026-07-06T10:30:00Z",
  "redirect_url": ""
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
                <td>Payout created successfully</td>
              </tr>
              <tr>
                <td>400</td>
                <td>Invalid request parameters (e.g., negative amount)</td>
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
          <h2>Payout Statuses</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Status</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>pending</td>
                <td>Payout request created, awaiting processing</td>
              </tr>
              <tr>
                <td>processing</td>
                <td>Payout is being processed</td>
              </tr>
              <tr>
                <td>completed</td>
                <td>Payout has been successfully completed</td>
              </tr>
              <tr>
                <td>failed</td>
                <td>Payout processing failed</td>
              </tr>
              <tr>
                <td>cancelled</td>
                <td>Payout was cancelled</td>
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
