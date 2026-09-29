import { messengerIdSchema } from '@/entities/messenger/model';
import { loadChatHistory } from '@/features/chat-history/server';
import { parseRouteChatId } from '@/server/green-api/chat-id';
import type { GreenApiError } from '@/shared/errors/model';

const HttpStatus = {
  BAD_GATEWAY: 502,
  // Nginx convention for a request the client abandoned; nobody reads this response.
  CLIENT_CLOSED_REQUEST: 499,
  NOT_FOUND: 404,
  OK: 200,
  TOO_MANY_REQUESTS: 429,
  UNAUTHORIZED: 401,
} as const;

function getErrorStatus({ code }: GreenApiError) {
  switch (code) {
    case 'rateLimited':
      return HttpStatus.TOO_MANY_REQUESTS;
    case 'realModeDisabled':
    case 'unauthorized':
      return HttpStatus.UNAUTHORIZED;
    default:
      return HttpStatus.BAD_GATEWAY;
  }
}

export async function GET(
  request: Request,
  { params }: RouteContext<'/api/[messenger]/chats/[chatId]/history'>,
) {
  const { chatId: chatIdSegment, messenger } = await params;
  const messengerId = messengerIdSchema.safeParse(messenger);
  const chatId = messengerId.success ? parseRouteChatId(messengerId.data, chatIdSegment) : null;
  if (!messengerId.success || chatId === null) {
    return new Response(null, { status: HttpStatus.NOT_FOUND });
  }

  try {
    const history = await loadChatHistory(messengerId.data, chatId, request.signal);
    return Response.json(history, {
      headers: { 'Cache-Control': 'no-store' },
      status: history.ok ? HttpStatus.OK : getErrorStatus(history.error),
    });
  } catch (error) {
    if (request.signal.aborted) {
      return new Response(null, { status: HttpStatus.CLIENT_CLOSED_REQUEST });
    }
    throw error;
  }
}
