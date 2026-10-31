import { createSlice } from '@reduxjs/toolkit';
export const labelColor = 'red';
const slice = createSlice({ name: 'nav', initialState: {}, reducers: {} });
export const { open, close } = slice.actions;
export default slice.reducer;
