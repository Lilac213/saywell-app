import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

interface AliyunConfig {
  accessKeyId: string;
  accessKeySecret: string;
  endpoint?: string;
}

export class AliyunClient {
  private accessKeyId: string;
  private accessKeySecret: string;
  private endpoint: string;

  constructor(config: AliyunConfig) {
    this.accessKeyId = config.accessKeyId;
    this.accessKeySecret = config.accessKeySecret;
    this.endpoint = config.endpoint || 'https://dypnsapi.aliyuncs.com';
  }

  private getTimestamp(): string {
    return new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  }

  private getSignature(params: Record<string, string>, method: string = 'POST'): string {
    const sortedKeys = Object.keys(params).sort();
    const canonicalizedQueryString = sortedKeys.map(key => {
      return `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`;
    }).join('&');

    const stringToSign = `${method}&${encodeURIComponent('/')}&${encodeURIComponent(canonicalizedQueryString)}`;
    
    // HMAC-SHA1
    const signature = hmac('sha1', `${this.accessKeySecret}&`, stringToSign, 'utf8', 'base64');
    return signature as string;
  }

  private async request(action: string, params: Record<string, any>) {
    const timestamp = this.getTimestamp();
    const nonce = Math.random().toString(36).substring(2);

    const commonParams: Record<string, string> = {
      'Format': 'JSON',
      'Version': '2017-05-25',
      'AccessKeyId': this.accessKeyId,
      'SignatureMethod': 'HMAC-SHA1',
      'Timestamp': timestamp,
      'SignatureVersion': '1.0',
      'SignatureNonce': nonce,
      'Action': action,
      ...params
    };

    const signature = this.getSignature(commonParams);
    const requestParams = new URLSearchParams();
    for (const key in commonParams) {
      requestParams.append(key, commonParams[key]);
    }
    requestParams.append('Signature', signature);

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: requestParams
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Aliyun API Error: ${response.status} ${text}`);
    }

    return await response.json();
  }

  async sendSmsVerifyCode(phoneNumber: string) {
    return this.request('SendSmsVerifyCode', {
      'PhoneNumber': phoneNumber,
      'SceneCode': 'Register_Login' // Assuming generic scene or need config
    });
  }

  async checkSmsVerifyCode(phoneNumber: string, verifyCode: string) {
    return this.request('CheckSmsVerifyCode', {
      'PhoneNumber': phoneNumber,
      'VerifyCode': verifyCode
    });
  }
}
