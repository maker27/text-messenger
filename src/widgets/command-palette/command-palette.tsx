'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Autocomplete,
  Dialog,
  Header,
  Input,
  type Key,
  Menu,
  MenuItem,
  MenuSection,
  Modal,
  ModalOverlay,
  SearchField,
  Text,
  useFilter,
} from 'react-aria-components';

import { getChatPath } from '@/entities/chat/chat-path';
import { MESSENGER_ORDER, MESSENGERS } from '@/entities/messenger/config';
import type { MessengerId } from '@/entities/messenger/model';
import { useLogout } from '@/features/login/use-logout';
import {
  useMessengerSession,
  useSessionChats,
} from '@/features/messenger-session/messenger-session-provider';
import { THEME_ORDER, ThemeLabel } from '@/features/theme-select/use-theme';
import type { Theme } from '@/shared/theme/theme';

import { useHotkeys } from './use-hotkeys';

const ITEM_CLASS_NAME =
  'flex cursor-default flex-col rounded-md px-3 py-2 text-sm outline-none data-focused:bg-surface-muted';
const SECTION_HEADER_CLASS_NAME = 'px-3 pt-2 pb-1 text-xs font-medium text-text-muted';
const PHONE_QUERY_PATTERN = /^[\d\s()+-]*\d[\d\s()+-]*$/;
const NON_DIGIT_PATTERN = /\D/g;

function matchesPhoneDigits(textValue: string, inputValue: string) {
  return (
    PHONE_QUERY_PATTERN.test(inputValue) &&
    textValue.replace(NON_DIGIT_PATTERN, '').includes(inputValue.replace(NON_DIGIT_PATTERN, ''))
  );
}

interface CommandPaletteProps {
  activeMessenger: MessengerId | null;
  tabPaths: Record<MessengerId, string>;
  onThemeChange: (theme: Theme) => void;
}

export function CommandPalette({ activeMessenger, tabPaths, onThemeChange }: CommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const isPhoneFocusPendingRef = useRef(false);
  const { contains } = useFilter({ sensitivity: 'base' });
  const filterItem = (textValue: string, inputValue: string, { key }: { key: Key }) =>
    contains(textValue, inputValue) ||
    matchesPhoneDigits(textValue, inputValue) ||
    matchesPhoneDigits(String(key), inputValue);
  const messengers = [
    usePaletteMessenger('max'),
    usePaletteMessenger('whatsapp'),
    usePaletteMessenger('telegram'),
  ];
  const signedInMessengers = messengers.filter(({ hasSession }) => hasSession);
  const isNewChatAvailable = signedInMessengers.some(
    ({ messengerId }) => messengerId === activeMessenger,
  );

  useHotkeys({
    onPaletteOpen: () => {
      setIsOpen(true);
    },
    onTabSelect: (messengerId) => {
      setIsOpen(false);
      openPath(tabPaths[messengerId]);
    },
  });

  // The phone field is hidden on a narrow chat screen, so the list screen is opened first.
  useEffect(() => {
    if (isOpen || !isPhoneFocusPendingRef.current || activeMessenger === null) {
      return;
    }

    const messengerPath = `/${activeMessenger}`;
    const phoneInput = document.querySelector<HTMLInputElement>(
      `section[data-messenger="${activeMessenger}"] input[name="phone"]`,
    );
    phoneInput?.focus();

    if (phoneInput !== document.activeElement && pathname !== messengerPath) {
      router.push(messengerPath);
      return;
    }

    isPhoneFocusPendingRef.current = false;
  }, [activeMessenger, isOpen, pathname, router]);

  function openPath(path: string) {
    if (path !== pathname) {
      router.push(path);
    }
  }

  function runCommand(command: () => void) {
    setIsOpen(false);
    command();
  }

  function handleNewChatAction() {
    runCommand(() => {
      isPhoneFocusPendingRef.current = true;
    });
  }

  return (
    <ModalOverlay
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[15vh]"
      isDismissable
      isOpen={isOpen}
      onOpenChange={setIsOpen}
    >
      <Modal className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
        <Dialog aria-label="Палитра команд" className="flex flex-col outline-none">
          <Autocomplete filter={filterItem}>
            <SearchField aria-label="Поиск команды" autoFocus className="border-b border-border">
              <Input
                className="w-full bg-transparent px-4 py-3 outline-none placeholder:text-text-muted"
                placeholder="Мессенджер, чат или команда"
              />
            </SearchField>
            <Menu
              className="max-h-80 overflow-y-auto p-2 outline-none"
              renderEmptyState={() => (
                <p className="px-3 py-6 text-center text-sm text-text-muted">Ничего не найдено</p>
              )}
            >
              <MenuSection>
                <Header className={SECTION_HEADER_CLASS_NAME}>Мессенджеры</Header>
                {MESSENGER_ORDER.map((messengerId) => (
                  <MenuItem
                    key={messengerId}
                    className={ITEM_CLASS_NAME}
                    id={`messenger:${messengerId}`}
                    onAction={() => {
                      runCommand(() => {
                        openPath(tabPaths[messengerId]);
                      });
                    }}
                  >
                    {MESSENGERS[messengerId].title}
                  </MenuItem>
                ))}
              </MenuSection>
              {signedInMessengers.some(({ chats }) => chats.length > 0) && (
                <MenuSection>
                  <Header className={SECTION_HEADER_CLASS_NAME}>Чаты</Header>
                  {signedInMessengers.flatMap(({ chats, messengerId }) =>
                    chats.map(({ chatId, title }) => (
                      <MenuItem
                        key={`${messengerId}:${chatId}`}
                        className={ITEM_CLASS_NAME}
                        id={`chat:${messengerId}:${chatId}`}
                        textValue={title}
                        onAction={() => {
                          runCommand(() => {
                            openPath(getChatPath(messengerId, chatId));
                          });
                        }}
                      >
                        <Text className="truncate" slot="label">
                          {title}
                        </Text>
                        <Text className="text-xs text-text-muted" slot="description">
                          {MESSENGERS[messengerId].title}
                        </Text>
                      </MenuItem>
                    )),
                  )}
                </MenuSection>
              )}
              <MenuSection>
                <Header className={SECTION_HEADER_CLASS_NAME}>Действия</Header>
                {isNewChatAvailable && (
                  <MenuItem
                    className={ITEM_CLASS_NAME}
                    id="new-chat"
                    onAction={handleNewChatAction}
                  >
                    Новый чат
                  </MenuItem>
                )}
                {THEME_ORDER.map((theme) => (
                  <MenuItem
                    key={theme}
                    className={ITEM_CLASS_NAME}
                    id={`theme:${theme}`}
                    onAction={() => {
                      runCommand(() => {
                        onThemeChange(theme);
                      });
                    }}
                  >
                    {`Тема: ${ThemeLabel[theme]}`}
                  </MenuItem>
                ))}
                {signedInMessengers.map(({ logOut, messengerId }) => (
                  <MenuItem
                    key={messengerId}
                    className={ITEM_CLASS_NAME}
                    id={`logout:${messengerId}`}
                    onAction={() => {
                      runCommand(logOut);
                    }}
                  >
                    {`Выйти из ${MESSENGERS[messengerId].title}`}
                  </MenuItem>
                ))}
              </MenuSection>
            </Menu>
          </Autocomplete>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function usePaletteMessenger(messengerId: MessengerId) {
  const { session } = useMessengerSession(messengerId);
  const chats = useSessionChats(messengerId);
  const { logOut } = useLogout(messengerId);

  return { chats, hasSession: session !== null, logOut, messengerId };
}
