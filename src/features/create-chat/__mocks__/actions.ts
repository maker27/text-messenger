import { fn } from 'storybook/test';

import type * as actions from '../actions';

export const createChat = fn<typeof actions.createChat>();
