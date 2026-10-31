import { createSlice } from '@reduxjs/toolkit';

const slice = createSlice({ name: 'nav', initialState: {}, reducers: {} });
export const { open, close } = slice.actions;

export const color = 'red';
