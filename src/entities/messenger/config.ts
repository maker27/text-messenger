import type { MessengerConfig, MessengerId } from './model';

export const MESSENGERS = {
  max: {
    id: 'max',
    allowedCountryCodes: ['7', '375'],
    chatIdStrategy: 'checkAccount',
    maxMessageLength: 4000,
    title: 'MAX',
    typeInstance: 'v3',
  },
  telegram: {
    id: 'telegram',
    allowedCountryCodes: null,
    chatIdStrategy: 'checkAccount',
    maxMessageLength: 4096,
    title: 'Telegram',
    typeInstance: 'telegram',
  },
  whatsapp: {
    id: 'whatsapp',
    allowedCountryCodes: null,
    chatIdStrategy: 'checkWhatsapp',
    maxMessageLength: 20000,
    title: 'WhatsApp',
    typeInstance: 'whatsapp',
  },
} as const satisfies Record<MessengerId, MessengerConfig>;
