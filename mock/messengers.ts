export interface MockMessenger {
  chatIdMethod: 'checkAccount' | 'checkWhatsapp';
  phonePattern: RegExp;
  statuses: readonly string[];
  typeInstance: string;
}

const INSTANCE_PREFIX_LENGTH = 4;
const INTERNATIONAL_PHONE_PATTERN = /^[1-9]\d{6,14}$/;

const MOCK_MESSENGERS = new Map<string, MockMessenger>([
  [
    '1101',
    {
      chatIdMethod: 'checkWhatsapp',
      phonePattern: INTERNATIONAL_PHONE_PATTERN,
      statuses: ['sent', 'delivered', 'read'],
      typeInstance: 'whatsapp',
    },
  ],
  [
    '3100',
    {
      chatIdMethod: 'checkAccount',
      phonePattern: /^(?:7\d{10}|375\d{9})$/,
      statuses: ['delivered', 'read'],
      typeInstance: 'v3',
    },
  ],
  [
    '4100',
    {
      chatIdMethod: 'checkAccount',
      phonePattern: INTERNATIONAL_PHONE_PATTERN,
      statuses: ['delivered', 'read'],
      typeInstance: 'telegram',
    },
  ],
]);

export function findMockMessenger(idInstance: string) {
  return MOCK_MESSENGERS.get(idInstance.slice(0, INSTANCE_PREFIX_LENGTH)) ?? null;
}
