
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

  private percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/!/g, '%21')
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/\*/g, '%2A');
  }

  private async getSignature(params: Record<string, string>, method: string = 'POST'): Promise<string> {
    const sortedKeys = Object.keys(params).sort();
    const canonicalizedQueryString = sortedKeys.map(key => {
      return `${this.percentEncode(key)}=${this.percentEncode(params[key])}`;
    }).join('&');

    const stringToSign = `${method}&${this.percentEncode('/')}&${this.percentEncode(canonicalizedQueryString)}`;
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(`${this.accessKeySecret}&`);
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(stringToSign)
    );

    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  public async request(action: string, params: Record<string, any>) {
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

    const signature = await this.getSignature(commonParams);
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

  async sendSms(phoneNumber: string, signName: string, templateCode: string, templateParam: object) {
    this.endpoint = 'https://dysmsapi.aliyuncs.com';
    return this.request('SendSms', {
      'PhoneNumbers': phoneNumber,
      'SignName': signName,
      'TemplateCode': templateCode,
      'TemplateParam': JSON.stringify(templateParam)
    });
  }
}
