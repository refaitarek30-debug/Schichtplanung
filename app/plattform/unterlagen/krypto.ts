/**
 * Verschlüsselung für den Tresor – läuft nur im Browser (WebCrypto).
 *
 * Master-Passwort --PBKDF2 (SHA-256, 600 000 Runden)--> Schlüssel zum
 * Verpacken. Damit ist ein zufälliger Datenschlüssel (AES-GCM 256)
 * verpackt. Der Datenschlüssel verschlüsselt Einträge und Dateien. So
 * lässt sich das Master-Passwort ändern, ohne alles neu zu verschlüsseln.
 *
 * Format eines Geheimtextes: base64(iv[12] | geheimtext+tag).
 * Der Server sieht nie das Master-Passwort oder einen Klartext.
 */

export const RUNDEN = 600_000;

export interface SchluesselZeile {
  salz: string;
  runden: number;
  schluessel: string;
}

function zuB64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

function ausB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}

async function verpacker(passwort: string, salz: Uint8Array<ArrayBuffer>, runden: number): Promise<CryptoKey> {
  const basis = await crypto.subtle.importKey("raw", new TextEncoder().encode(passwort), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salz, iterations: runden },
    basis,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function zu(schluessel: CryptoKey, klar: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const geheim = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, schluessel, klar));
  const aus = new Uint8Array(12 + geheim.length);
  aus.set(iv);
  aus.set(geheim, 12);
  return aus;
}

async function auf(schluessel: CryptoKey, daten: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: daten.subarray(0, 12) }, schluessel, daten.subarray(12)));
}

async function verpacken(passwort: string, roh: Uint8Array<ArrayBuffer>): Promise<SchluesselZeile> {
  const salz = crypto.getRandomValues(new Uint8Array(16));
  const k = await verpacker(passwort, salz, RUNDEN);
  return { salz: zuB64(salz), runden: RUNDEN, schluessel: zuB64(await zu(k, roh)) };
}

async function rohAuspacken(passwort: string, z: SchluesselZeile): Promise<Uint8Array<ArrayBuffer>> {
  const k = await verpacker(passwort, ausB64(z.salz), z.runden);
  return auf(k, ausB64(z.schluessel));
}

function datenSchluessel(roh: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", roh, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Neuer Tresor: zufälliger Datenschlüssel, verpackt mit dem Master-Passwort. */
export async function tresorNeu(passwort: string): Promise<{ zeile: SchluesselZeile; schluessel: CryptoKey }> {
  const roh = crypto.getRandomValues(new Uint8Array(32));
  const zeile = await verpacken(passwort, roh);
  return { zeile, schluessel: await datenSchluessel(roh) };
}

/** Öffnen. Falsches Passwort → Fehler (AES-GCM prüft die Echtheit). */
export async function tresorOeffnen(passwort: string, z: SchluesselZeile): Promise<CryptoKey> {
  return datenSchluessel(await rohAuspacken(passwort, z));
}

/** Master-Passwort ändern: derselbe Datenschlüssel, neu verpackt. */
export async function masterAendern(alt: string, neu: string, z: SchluesselZeile): Promise<SchluesselZeile> {
  return verpacken(neu, await rohAuspacken(alt, z));
}

export async function jsonZu<T>(schluessel: CryptoKey, wert: T): Promise<string> {
  return zuB64(await zu(schluessel, new TextEncoder().encode(JSON.stringify(wert))));
}

export async function jsonAuf<T>(schluessel: CryptoKey, text: string): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await auf(schluessel, ausB64(text)))) as T;
}

export async function dateiZu(schluessel: CryptoKey, datei: Blob): Promise<Blob> {
  return new Blob([await zu(schluessel, new Uint8Array(await datei.arrayBuffer()))], { type: "application/octet-stream" });
}

export async function dateiAuf(schluessel: CryptoKey, geheim: ArrayBuffer, typ: string): Promise<Blob> {
  return new Blob([await auf(schluessel, new Uint8Array(geheim))], { type: typ });
}

/** Zufälliges, starkes Passwort (für neue Zugänge). */
export function passwortVorschlag(laenge = 20): string {
  const zeichen = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_.!?";
  const zufall = crypto.getRandomValues(new Uint32Array(laenge));
  return Array.from(zufall, (z) => zeichen[z % zeichen.length]).join("");
}
