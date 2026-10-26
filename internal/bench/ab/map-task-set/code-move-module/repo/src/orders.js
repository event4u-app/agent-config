import { isoDay } from './lib/date.js';

export const orderDay = (o) => isoDay(o.createdAt);
