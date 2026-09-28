'use server';

import { cookies } from 'next/headers';

import type { Chat } from '@/entities/chat/model';
import { formatPhoneNumber, parsePhoneNumber } from '@/entities/chat/phone-number';
import { MESSENGERS } from '@/entities/messenger/config';
import { messengerIdSchema } from '@/entities/messenger/model';
import { createGreenApiClient } from '@/server/green-api/client';
import { readSession } from '@/server/session/session';
import type { GreenApiError, PhoneNumberErrorCode } from '@/shared/errors/model';
import type { Result } from '@/shared/errors/result';

export type CreateChatError =
  GreenApiError | { code: 'invalidInput' } | { code: 'phoneNumber'; reason: PhoneNumberErrorCode };

export async function createChat(
  messengerId: unknown,
  _previousState: unknown,
  formData: unknown,
): Promise<Result<Chat, CreateChatError>> {
  const parsedMessengerId = messengerIdSchema.safeParse(messengerId);
  const phone = formData instanceof FormData ? formData.get('phone') : null;
  if (!parsedMessengerId.success || typeof phone !== 'string') {
    return { error: { code: 'invalidInput' }, ok: false };
  }
  const messenger = MESSENGERS[parsedMessengerId.data];
  const session = await readSession(await cookies(), messenger.id);
  if (!session.ok) {
    return session;
  }
  const phoneNumber = parsePhoneNumber(phone, messenger.allowedCountryCodes);
  if (!phoneNumber.ok) {
    return { error: { code: 'phoneNumber', reason: phoneNumber.error }, ok: false };
  }
  const chatId = await createGreenApiClient(messenger, session.data.credentials).resolveChatId(
    phoneNumber.data,
  );
  if (!chatId.ok) {
    return chatId;
  }
  return {
    data: { chatId: chatId.data, lastMessageAt: null, title: formatPhoneNumber(phoneNumber.data) },
    ok: true,
  };
}
