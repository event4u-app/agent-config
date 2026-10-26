import { isoDay } from './shared/date.js';

export const orderDay = (o) => isoDay(o.createdAt);
