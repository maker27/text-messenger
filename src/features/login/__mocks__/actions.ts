import { fn } from 'storybook/test';

import type * as actions from '../actions';

export const login = fn<typeof actions.login>();

export const logout = fn<typeof actions.logout>();
