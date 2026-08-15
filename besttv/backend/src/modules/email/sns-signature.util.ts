import { createVerify, X509Certificate } from 'crypto';
import { get as httpsGet } from 'https';

/**
 * AWS SNS message signature шалгагч (гар аргаар, нэмэлт npm багцгүй).
 *
 * SNS notification бүр SHA1/SHA256-RSA гарын үсэгтэй ирдэг. Бид:
 *   1) SigningCertURL зөв AWS домэйн эсэхийг шалгана (хуурамч cert хамгаалалт).
 *   2) Cert-ийг (кэштэй) татаж public key-г гаргана.
 *   3) Message-ийн талбаруудаас канон string угсарч (AWS spec дагуу) signature
 *      шалгана. Хуурамч webhook-оос хамгаална.
 *
 * Ref: https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-messages.html
 */

// Татаж авсан cert-ийг кэшилнэ (URL → PEM). SNS байнга нэг cert ашигладаг.
const certCache = new Map<string, string>();

// SNS notification-ийн talбарууд (канон string-д орох дараалал).
type SnsMessage = {
  Type?: string;
  MessageId?: string;
  Token?: string;
  TopicArn?: string;
  Message?: string;
  SubscribeURL?: string;
  Timestamp?: string;
  Subject?: string;
  SignatureVersion?: string;
  Signature?: string;
  SigningCertURL?: string;
  [k: string]: unknown;
};

/** SigningCertURL зөвхөн AWS-ийн sns домэйнаас байх ёстой (HTTPS). */
function isValidCertUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    // sns.<region>.amazonaws.com эсвэл sns.<region>.amazonaws.com.cn (Хятад region)
    const host = u.hostname.toLowerCase();
    return (
      /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/.test(host) &&
      u.pathname.endsWith('.pem')
    );
  } catch {
    return false;
  }
}

/** Cert-ийг URL-ээс татна (кэштэй). */
function fetchCert(url: string): Promise<string> {
  const cached = certCache.get(url);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    httpsGet(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(
          new Error(`SigningCert татаж чадсангүй: HTTP ${res.statusCode}`),
        );
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        certCache.set(url, body);
        resolve(body);
      });
    }).on('error', reject);
  });
}

/**
 * Канон string угсарна (AWS spec — талбар нэрс цагаан толгойн дарааллаар,
 * "key\nvalue\n" хэлбэрээр). Type-аас хамаарч талбарын жагсаалт өөр.
 */
function buildStringToSign(msg: SnsMessage): string {
  const fieldsFor = (type: string): string[] => {
    if (type === 'Notification') {
      // Subject заримдаа байхгүй — байвал л оруулна.
      return msg.Subject !== undefined
        ? ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']
        : ['Message', 'MessageId', 'Timestamp', 'TopicArn', 'Type'];
    }
    // SubscriptionConfirmation / UnsubscribeConfirmation
    return [
      'Message',
      'MessageId',
      'SubscribeURL',
      'Timestamp',
      'Token',
      'TopicArn',
      'Type',
    ];
  };

  const fields = fieldsFor(msg.Type ?? '');
  let out = '';
  for (const f of fields) {
    const v = msg[f];
    // SNS spec — талбарууд бүгд string. String бус (object/number) утгыг алгасна.
    if (typeof v !== 'string') continue;
    out += `${f}\n${v}\n`;
  }
  return out;
}

/**
 * SNS message-ийн гарын үсгийг шалгана. Алдаа/хуурамч бол false.
 * SignatureVersion '1'(SHA1) ба '2'(SHA256) дэмжинэ.
 */
export async function verifySnsSignature(msg: SnsMessage): Promise<boolean> {
  try {
    if (!msg.Signature || !msg.SigningCertURL) return false;
    if (!isValidCertUrl(msg.SigningCertURL)) return false;

    const algo = msg.SignatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1';
    const stringToSign = buildStringToSign(msg);

    const pem = await fetchCert(msg.SigningCertURL);
    // X509-аас public key гаргана (cert PEM-ээс шууд verify хийж болохгүй).
    const publicKey = new X509Certificate(pem).publicKey;

    const verifier = createVerify(algo);
    verifier.update(stringToSign, 'utf8');
    verifier.end();
    return verifier.verify(publicKey, msg.Signature, 'base64');
  } catch {
    return false;
  }
}
