export type MessengerId = 'max' | 'telegram' | 'whatsapp';

export interface MessengerConfig {
  id: MessengerId;
  allowedCountryCodes: readonly string[] | null;
  chatIdStrategy: 'checkAccount' | 'checkWhatsapp';
  maxMessageLength: number;
  title: string;
  typeInstance: string;
}
