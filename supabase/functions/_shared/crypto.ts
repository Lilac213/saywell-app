import { encodeBase64, decodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

export class CryptoService {
  private key: CryptoKey | null = null;

  private async getKey(): Promise<CryptoKey> {
    if (this.key) return this.key;

    const keyString = Deno.env.get("ENCRYPTION_KEY");
    if (!keyString) {
      throw new Error("ENCRYPTION_KEY is not set");
    }

    // Derive a 32-byte key from the input string using SHA-256
    // This allows using any string as a key, even if it's not exactly 32 bytes
    const encoder = new TextEncoder();
    const keyBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(keyString));

    this.key = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );

    return this.key;
  }

  async encrypt(plaintext: string): Promise<string> {
    if (!plaintext) return plaintext;
    
    const key = await this.getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encoded = encoder.encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoded
    );

    // Combine IV and Ciphertext
    const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return encodeBase64(combined);
  }

  async decrypt(encryptedText: string): Promise<string> {
    if (!encryptedText) return encryptedText;

    try {
      const key = await this.getKey();
      const combined = decodeBase64(encryptedText);

      if (combined.length < 12) {
        throw new Error("Invalid encrypted data length");
      }

      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error("Decryption failed:", error);
      throw new Error("Decryption failed");
    }
  }
}

export const cryptoService = new CryptoService();
